-- Fatia 4: reescrita view_relacionamento_kanban + fix view_home_alertas +
--          reescrita rpt_ltv_por_cliente + nova config de relacionamento

-- 1. Nova config de relacionamento
INSERT INTO configuracoes (chave, valor)
VALUES (
  'relacionamento',
  '{"limiar_reativacao": 30, "multiplicador_sumido": 1.5}'::jsonb
)
ON CONFLICT (chave) DO NOTHING;

-- 2. Remove ciclo_recompra
DELETE FROM configuracoes WHERE chave = 'ciclo_recompra';

-- 3. Reescrita view_relacionamento_kanban
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
      AND m.dias_sem_compra < cfg.limiar_reativacao
      THEN NULL
    WHEN COALESCE(m.total_pedidos, 0) = 1
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
  END                               AS sumido
FROM contatos c
CROSS JOIN cfg
LEFT JOIN metricas     m  ON m.contato_id = c.id
LEFT JOIN fiado_aberto fa ON fa.contato_id = c.id;

-- 4. Fix view_home_alertas
CREATE OR REPLACE VIEW view_home_alertas
WITH (security_invoker = true)
AS
WITH ultima_compra AS (
  SELECT
    contato_id,
    max(data) AS ultima_data
  FROM vendas
  WHERE status = 'entregue'
    AND forma_pagamento <> 'brinde'
  GROUP BY contato_id
)
SELECT
  c.id              AS contato_id,
  c.nome,
  c.telefone,
  uc.ultima_data    AS data_ultima_compra,
  CURRENT_DATE - uc.ultima_data AS dias_sem_compra
FROM contatos c
JOIN ultima_compra uc ON c.id = uc.contato_id
WHERE (CURRENT_DATE - uc.ultima_data) > 45
ORDER BY (CURRENT_DATE - uc.ultima_data) DESC
LIMIT 10;

-- 5. Reescrita rpt_ltv_por_cliente
CREATE OR REPLACE VIEW rpt_ltv_por_cliente
WITH (security_invoker = true)
AS
WITH cfg AS (
  SELECT
    COALESCE(MAX((valor ->> 'limiar_reativacao')::integer), 30)     AS limiar_reativacao,
    COALESCE(MAX((valor ->> 'multiplicador_sumido')::numeric), 1.5)  AS multiplicador_sumido
  FROM configuracoes
  WHERE chave = 'relacionamento'
),
base AS (
  SELECT
    c.id              AS contato_id,
    c.nome,
    c.telefone,
    c.tipo,
    c.status,
    count(v.id)            AS total_pedidos,
    sum(v.total)           AS ltv_total,
    round(avg(v.total), 2) AS ticket_medio,
    min(v.data)            AS primeira_compra,
    max(v.data)            AS ultima_compra,
    max(v.data) - min(v.data) AS dias_relacionamento
  FROM contatos c
  JOIN vendas v ON v.contato_id = c.id
  WHERE v.status <> 'cancelada'
    AND v.forma_pagamento <> 'brinde'
  GROUP BY c.id, c.nome, c.telefone, c.tipo, c.status
),
ritmo AS (
  SELECT
    b.*,
    CURRENT_DATE - b.ultima_compra AS dias_sem_compra,
    CASE
      WHEN b.total_pedidos >= 2
      THEN (b.ultima_compra - b.primeira_compra)::numeric / (b.total_pedidos - 1)
      ELSE NULL
    END AS intervalo_medio,
    CASE
      WHEN b.total_pedidos >= 2
      THEN CURRENT_DATE - (
        b.ultima_compra
        + (((b.ultima_compra - b.primeira_compra) / (b.total_pedidos - 1))::integer)
      )
      ELSE NULL
    END AS atraso
  FROM base b
)
SELECT
  r.contato_id,
  r.nome,
  r.telefone,
  r.tipo,
  r.status,
  r.total_pedidos,
  r.ltv_total,
  r.ticket_medio,
  r.primeira_compra,
  r.ultima_compra,
  r.dias_relacionamento,
  CASE
    WHEN r.total_pedidos >= 2 THEN
      CASE
        WHEN r.atraso < 0 THEN 'ativo'
        WHEN r.atraso < ROUND(r.intervalo_medio * cfg.multiplicador_sumido) THEN 'risco'
        ELSE 'adormecido'
      END
    ELSE
      CASE
        WHEN r.dias_sem_compra < cfg.limiar_reativacao THEN 'ativo'
        WHEN r.dias_sem_compra
             < ROUND(cfg.limiar_reativacao::numeric * cfg.multiplicador_sumido)
          THEN 'risco'
        ELSE 'adormecido'
      END
  END AS status_atividade
FROM ritmo r
CROSS JOIN cfg
ORDER BY r.ltv_total DESC;
