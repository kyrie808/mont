-- =============================================================================
-- Fix: pedido = data de atendimento distinta (count DISTINCT v.data)
--
-- CAUSA: vendas tem uma linha por ITEM, não por pedido. count(v.id) inflava
--   total_pedidos e colapsava intervalo_medio para clientes com múltiplos
--   produtos num mesmo atendimento (ex: Ewerton 2 itens em 11/12 → intervalo=0).
--
-- SEMÂNTICA aprovada: "pedido = data de atendimento distinta".
--   Dois itens entregues no mesmo dia = 1 evento de compra.
--
-- IMPACTO:
--   - total_pedidos: conta dias distintos, não linhas
--   - ticket_medio (rpt_ltv): sobe de por-item para por-evento (mais correto)
--   - intervalo_medio: calculado sobre eventos reais, não itens
--   - Clientes com itens só em 1 data viram tier 1 (ex: Ewerton → reativação)
--   - min/max data (primeira_compra/ultima_compra): inalterados
-- =============================================================================

-- ─── 1. view_relacionamento_kanban ───────────────────────────────────────────
CREATE OR REPLACE VIEW view_relacionamento_kanban
WITH (security_invoker = true)
AS
WITH compras AS (
  SELECT
    v.contato_id,
    count(DISTINCT v.data)::integer  AS total_pedidos,   -- fix: por evento, não por item
    min(v.data)                      AS primeira_compra,
    max(v.data)                      AS ultima_compra
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
LEFT JOIN fiado_aberto fa ON fa.contato_id = c.id
WHERE c.arquivado_em IS NULL;

-- ─── 2. rpt_ltv_por_cliente ──────────────────────────────────────────────────
-- total_pedidos: count(DISTINCT v.data) — mesmo critério do kanban
-- ticket_medio:  ltv_total / total_pedidos — por evento de compra, não por item
--   (bigint/bigint mantém bigint para total_pedidos; divisão em numeric para ticket)
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
    count(DISTINCT v.data)                                          AS total_pedidos,
    sum(v.total)                                                    AS ltv_total,
    round(sum(v.total) / NULLIF(count(DISTINCT v.data), 0), 2)     AS ticket_medio,
    min(v.data)                                                     AS primeira_compra,
    max(v.data)                                                     AS ultima_compra,
    max(v.data) - min(v.data)                                       AS dias_relacionamento
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
