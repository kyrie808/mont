-- =============================================================================
-- Fatia 4: reescrita view_relacionamento_kanban + fix view_home_alertas +
--          reescrita rpt_ltv_por_cliente + nova config de relacionamento
-- Data: 2026-05-31
--
-- NOTAS DE TIPO:
--   view_relacionamento_kanban: count()::integer pois date + bigint sem operador.
--   rpt_ltv_por_cliente: count() mantido bigint (não muda tipo de coluna existente);
--     divisão na aritmética de data usa ::integer explícito no resultado.
--   aba_atual permanece posição 6 (original) via CREATE OR REPLACE.
-- =============================================================================

-- ─── 1. Nova config de relacionamento ────────────────────────────────────────
INSERT INTO configuracoes (chave, valor)
VALUES (
  'relacionamento',
  '{"limiar_reativacao": 30, "multiplicador_sumido": 1.5}'::jsonb
)
ON CONFLICT (chave) DO NOTHING;

-- ─── 2. Remove ciclo_recompra (backup em supabase/backups/dumps/) ─────────────
DELETE FROM configuracoes WHERE chave = 'ciclo_recompra';

-- ─── 3. Reescrita view_relacionamento_kanban ──────────────────────────────────
CREATE OR REPLACE VIEW view_relacionamento_kanban
WITH (security_invoker = true)
AS
WITH compras AS (
  -- cast para integer: date + bigint não tem operador; date + integer sim
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
  -- MAX() sobre 0 linhas = NULL; COALESCE garante defaults seguros sempre
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
    -- intervalo_medio: apenas tier >=2 (média, sensível a outlier)
    CASE
      WHEN cp.total_pedidos >= 2
      THEN (cp.ultima_compra - cp.primeira_compra)::numeric
           / (cp.total_pedidos - 1)
      ELSE NULL
    END                                                      AS intervalo_medio,
    -- proxima_esperada: divisão inteira (integer/integer) -> date válido
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
  -- aba_atual na posição 6 (original) — CREATE OR REPLACE exige
  -- aba = ACAO: recompra = >=2 + 1-compra balde cheio; reativacao = 1-compra balde vazio
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
  -- novas colunas (posições 7+)
  COALESCE(m.total_pedidos, 0)      AS total_pedidos,
  m.primeira_compra,
  m.ultima_compra,
  m.dias_sem_compra,
  m.intervalo_medio,
  m.proxima_esperada,
  -- atraso: positivo=atrasado; negativo=adiantado; NULL se tier<2
  CASE
    WHEN m.proxima_esperada IS NOT NULL
    THEN CURRENT_DATE - m.proxima_esperada
    ELSE NULL
  END                               AS atraso,
  -- sumido: >=2 compras com atraso acima do multiplicador
  CASE
    WHEN m.proxima_esperada IS NOT NULL
      AND (CURRENT_DATE - m.proxima_esperada)
          >= ROUND(m.intervalo_medio * cfg.multiplicador_sumido)
    THEN true
    ELSE false
  END                               AS sumido,
  -- balde_cheio: 1 compra dentro do prazo de consumo (sem ritmo derivavel)
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

-- ─── 4. Fix view_home_alertas (brinde nao conta como compra) ─────────────────
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

-- ─── 5. Reescrita rpt_ltv_por_cliente (remove CROSS JOIN ciclo_recompra) ─────
-- total_pedidos mantido bigint (count sem cast) para nao mudar tipo de coluna existente.
-- Aritmetica de data usa cast ::integer no resultado da divisao.
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
    -- intervalo_medio: apenas tier >=2 (numeric para precisao decimal)
    CASE
      WHEN b.total_pedidos >= 2
      THEN (b.ultima_compra - b.primeira_compra)::numeric / (b.total_pedidos - 1)
      ELSE NULL
    END AS intervalo_medio,
    -- atraso: cast ::integer no resultado da divisao (bigint/bigint=bigint; date+bigint invalido)
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
  -- status_atividade derivado do ritmo do cliente (sem threshold global)
  CASE
    WHEN r.total_pedidos >= 2 THEN
      CASE
        WHEN r.atraso < 0 THEN 'ativo'
        WHEN r.atraso < ROUND(r.intervalo_medio * cfg.multiplicador_sumido) THEN 'risco'
        ELSE 'adormecido'
      END
    ELSE
      -- 1 compra: usa dias_sem_compra vs limiar_reativacao x multiplicador
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
