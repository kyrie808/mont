-- Fatia 4b: correção do modelo de classificação + coluna balde_cheio

CREATE OR REPLACE VIEW view_relacionamento_kanban
WITH (security_invoker = true)
AS
WITH compras AS (
  SELECT
    v.contato_id,
    count(v.id)::integer  AS total_pedidos,
    min(v.data)           AS primeira_compra,
    max(v.data)           AS ultima_compra
  FROM vendas v
  WHERE v.status = 'entregue'
    AND v.forma_pagamento <> 'brinde'
  GROUP BY v.contato_id
),
fiado_aberto AS (
  SELECT
    v.contato_id,
    bool_or(
      v.status = 'entregue'
      AND v.forma_pagamento = 'fiado'
      AND v.pago = false
    ) AS tem_fiado_aberto
  FROM vendas v
  GROUP BY v.contato_id
),
cfg AS (
  SELECT
    COALESCE(MAX((valor ->> 'limiar_reativacao')::integer), 30)     AS limiar_reativacao,
    COALESCE(MAX((valor ->> 'multiplicador_sumido')::numeric), 1.5)  AS multiplicador_sumido
  FROM configuracoes
  WHERE chave = 'relacionamento'
),
metricas AS (
  SELECT
    cp.contato_id,
    cp.total_pedidos,
    cp.primeira_compra,
    cp.ultima_compra,
    (CURRENT_DATE - cp.ultima_compra)                        AS dias_sem_compra,
    CASE
      WHEN cp.total_pedidos >= 2
      THEN (cp.ultima_compra - cp.primeira_compra)::numeric
           / (cp.total_pedidos - 1)
      ELSE NULL
    END                                                      AS intervalo_medio,
    CASE
      WHEN cp.total_pedidos >= 2
      THEN cp.ultima_compra
           + ((cp.ultima_compra - cp.primeira_compra) / (cp.total_pedidos - 1))
      ELSE NULL
    END                                                      AS proxima_esperada
  FROM compras cp
)
SELECT
  c.id                              AS contato_id,
  c.nome,
  c.telefone,
  c.status_relacionamento,
  c.arquivado_em,
  CASE
    WHEN COALESCE(fa.tem_fiado_aberto, false)
      THEN 'cobranca'::enum_relacionamento_aba
    WHEN COALESCE(m.total_pedidos, 0) = 0
      THEN NULL
    WHEN COALESCE(m.total_pedidos, 0) = 1
      AND m.dias_sem_compra >= cfg.limiar_reativacao
      THEN 'reativacao'::enum_relacionamento_aba
    ELSE 'recompra'::enum_relacionamento_aba
  END                               AS aba_atual,
  COALESCE(m.total_pedidos, 0)      AS total_pedidos,
  m.primeira_compra,
  m.ultima_compra,
  m.dias_sem_compra,
  m.intervalo_medio,
  m.proxima_esperada,
  CASE
    WHEN m.proxima_esperada IS NOT NULL
    THEN CURRENT_DATE - m.proxima_esperada
    ELSE NULL
  END                               AS atraso,
  CASE
    WHEN m.proxima_esperada IS NOT NULL
      AND (CURRENT_DATE - m.proxima_esperada)
          >= ROUND(m.intervalo_medio * cfg.multiplicador_sumido)
    THEN true
    ELSE false
  END                               AS sumido,
  CASE
    WHEN COALESCE(m.total_pedidos, 0) = 1
      AND m.dias_sem_compra < cfg.limiar_reativacao
    THEN true
    ELSE false
  END                               AS balde_cheio
FROM contatos c
CROSS JOIN cfg
LEFT JOIN metricas     m  ON m.contato_id = c.id
LEFT JOIN fiado_aberto fa ON fa.contato_id = c.id;
