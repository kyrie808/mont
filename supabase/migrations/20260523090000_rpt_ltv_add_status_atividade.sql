-- Adiciona coluna status_atividade à rpt_ltv_por_cliente
-- Classifica clientes por dias desde ultima_compra vs configuracoes.ciclo_recompra
--   ativo      : dias_desde_ultima_compra <= ciclo
--   risco      : dias <= ciclo * 2
--   adormecido : dias > ciclo * 2
-- O ciclo é por tipo: B2B usa valor->>'b2b', demais usam valor->>'b2c'

CREATE OR REPLACE VIEW rpt_ltv_por_cliente
WITH (security_invoker = true)
AS
WITH ciclo AS (
    SELECT
        (valor->>'b2b')::int AS b2b,
        (valor->>'b2c')::int AS b2c
    FROM configuracoes
    WHERE chave = 'ciclo_recompra'
)
SELECT
    c.id                                      AS contato_id,
    c.nome,
    c.telefone,
    c.tipo,
    c.status,
    count(v.id)                               AS total_pedidos,
    sum(v.total)                              AS ltv_total,
    round(avg(v.total), 2)                    AS ticket_medio,
    min(v.data)                               AS primeira_compra,
    max(v.data)                               AS ultima_compra,
    max(v.data) - min(v.data)                 AS dias_relacionamento,
    CASE
        WHEN (CURRENT_DATE - max(v.data))
             <= CASE c.tipo WHEN 'B2B' THEN ciclo.b2b ELSE ciclo.b2c END
            THEN 'ativo'
        WHEN (CURRENT_DATE - max(v.data))
             <= CASE c.tipo WHEN 'B2B' THEN ciclo.b2b ELSE ciclo.b2c END * 2
            THEN 'risco'
        ELSE 'adormecido'
    END                                       AS status_atividade
FROM contatos c
JOIN vendas v ON v.contato_id = c.id
CROSS JOIN ciclo
WHERE v.status        <> 'cancelada'
  AND v.forma_pagamento <> 'brinde'
GROUP BY c.id, c.nome, c.telefone, c.tipo, c.status, ciclo.b2b, ciclo.b2c
ORDER BY sum(v.total) DESC;
