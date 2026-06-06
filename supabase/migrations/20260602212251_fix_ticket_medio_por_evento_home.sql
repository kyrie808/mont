-- =============================================================================
-- Fix A: ticket_medio por evento em view_home_financeiro
--
-- CAUSA: AVG(vendas.total) dividia por linhas de item, não por eventos de compra.
--   Dois itens entregues ao mesmo cliente no mesmo dia = 2 linhas = ticket menor.
--
-- SEMÂNTICA aprovada: mesmo critério da rpt_ltv (decisão #4).
--   ticket_medio = faturamento / COUNT(DISTINCT (contato_id, data))
--   = valor médio de cada evento de entrega (par cliente+data único).
--
-- IMPACTO (mai/2026):
--   AVG por linha:  R$59,54 (204 denominador)
--   por evento:     R$62,93 (193 denominador — 11 linhas = múltiplos itens no mesmo dia)
--
-- POSTURA DE SEGURANÇA: security_invoker=true preservada (confirmado via reloptions).
-- ESCOPO: SÓ a expressão ticket_medio na CTE mensais. Nenhuma outra linha alterada.
-- =============================================================================

CREATE OR REPLACE VIEW public.view_home_financeiro
WITH (security_invoker = true)
AS
WITH mensais AS (
    SELECT
        EXTRACT(year  FROM vendas.data)::integer AS ano,
        EXTRACT(month FROM vendas.data)::integer AS mes,
        COALESCE(
            SUM(vendas.total)
            FILTER (WHERE vendas.status = 'entregue' AND vendas.forma_pagamento <> 'brinde'),
            0
        ) AS faturamento,
        -- fix A: por evento (contato+data distinto), não por linha de item
        COALESCE(
            SUM(vendas.total)
            FILTER (WHERE vendas.status = 'entregue' AND vendas.forma_pagamento <> 'brinde')
            / NULLIF(
                COUNT(DISTINCT (vendas.contato_id, vendas.data))
                FILTER (WHERE vendas.status = 'entregue' AND vendas.forma_pagamento <> 'brinde'),
                0
            ),
            0
        ) AS ticket_medio,
        COALESCE(
            SUM(vendas.total - vendas.custo_total)
            FILTER (WHERE vendas.status = 'entregue' AND vendas.forma_pagamento <> 'brinde'),
            0
        ) AS lucro_estimado,
        COALESCE(
            SUM(vendas.total - vendas.valor_pago)
            FILTER (WHERE vendas.status = 'entregue' AND vendas.pago = false AND vendas.forma_pagamento <> 'brinde'),
            0
        ) AS total_a_receber,
        COALESCE(
            SUM(vendas.total)
            FILTER (WHERE vendas.pago = true AND vendas.status = 'entregue' AND vendas.forma_pagamento <> 'brinde'
                      AND (vendas.origem IS NULL OR vendas.origem <> 'catalogo')),
            0
        ) AS caixa_mes,
        COALESCE(
            COUNT(*)
            FILTER (WHERE vendas.pago = true AND vendas.status = 'entregue' AND vendas.forma_pagamento <> 'brinde'
                      AND (vendas.origem IS NULL OR vendas.origem <> 'catalogo')),
            0::bigint
        )::integer AS caixa_mes_count
    FROM public.vendas
    GROUP BY
        EXTRACT(year  FROM vendas.data),
        EXTRACT(month FROM vendas.data)
),
com_lag AS (
    SELECT
        mensais.ano,
        mensais.mes,
        mensais.faturamento,
        mensais.ticket_medio,
        mensais.lucro_estimado,
        mensais.total_a_receber,
        mensais.caixa_mes,
        mensais.caixa_mes_count,
        LAG(mensais.faturamento) OVER (ORDER BY mensais.ano, mensais.mes) AS faturamento_anterior_val
    FROM mensais
),
alertas AS (
    SELECT
        JSON_AGG(JSON_BUILD_OBJECT(
            'venda_id',        v.id,
            'valor',           v.total,
            'vencimento',      v.data_prevista_pagamento,
            'contato_nome',    c.nome,
            'contato_telefone', c.telefone
        )) AS financeiros
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    WHERE v.pago = false
      AND v.status = 'entregue'
      AND v.data_prevista_pagamento < CURRENT_DATE
      AND v.forma_pagamento <> 'brinde'
)
SELECT
    ano,
    mes,
    faturamento,
    ticket_medio,
    lucro_estimado,
    total_a_receber,
    caixa_mes                                    AS liquidado_mes,
    caixa_mes_count                              AS liquidado_mes_count,
    COALESCE(faturamento_anterior_val, 0)        AS faturamento_anterior,
    CASE
        WHEN COALESCE(faturamento_anterior_val, 0) > 0
        THEN (faturamento - faturamento_anterior_val) / faturamento_anterior_val * 100
        ELSE 0
    END                                          AS variacao_faturamento_percentual,
    COALESCE(
        (SELECT alertas.financeiros FROM alertas),
        '[]'::json
    )                                            AS alertas_financeiros
FROM com_lag cl;
