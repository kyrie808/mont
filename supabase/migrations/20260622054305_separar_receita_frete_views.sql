-- Separa receita de FRETE da receita de PRODUTO nas views de faturamento/lucro.
-- faturamento/lucro passam a ser SÓ PRODUTO (total - taxa_entrega); frete vira
-- coluna própria `receita_frete`. O lucro líquido total PRESERVA o frete (receita
-- 100% margem). CREATE OR REPLACE (só muda expressões + acrescenta coluna ao fim).
-- Backup: dump-{schema,data}-20260622-023834.sql

-- ── view_home_financeiro ──
CREATE OR REPLACE VIEW public.view_home_financeiro AS
WITH mensais AS (
    SELECT EXTRACT(year FROM vendas.data)::integer AS ano,
        EXTRACT(month FROM vendas.data)::integer AS mes,
        COALESCE(sum(vendas.total - COALESCE(vendas.taxa_entrega, 0)) FILTER (WHERE vendas.status = 'entregue'::text AND vendas.forma_pagamento <> 'brinde'::text), 0::numeric) AS faturamento,
        COALESCE(sum(vendas.total - COALESCE(vendas.taxa_entrega, 0)) FILTER (WHERE vendas.status = 'entregue'::text AND vendas.forma_pagamento <> 'brinde'::text) / NULLIF(count(DISTINCT ROW(vendas.contato_id, vendas.data)) FILTER (WHERE vendas.status = 'entregue'::text AND vendas.forma_pagamento <> 'brinde'::text), 0)::numeric, 0::numeric) AS ticket_medio,
        COALESCE(sum((vendas.total - COALESCE(vendas.taxa_entrega, 0)) - vendas.custo_total) FILTER (WHERE vendas.status = 'entregue'::text AND vendas.forma_pagamento <> 'brinde'::text), 0::numeric) AS lucro_estimado,
        COALESCE(sum(vendas.total - vendas.valor_pago) FILTER (WHERE vendas.status = 'entregue'::text AND vendas.pago = false AND vendas.forma_pagamento <> 'brinde'::text), 0::numeric) AS total_a_receber,
        COALESCE(sum(vendas.total) FILTER (WHERE vendas.pago = true AND vendas.status = 'entregue'::text AND vendas.forma_pagamento <> 'brinde'::text AND (vendas.origem IS NULL OR vendas.origem <> 'catalogo'::text)), 0::numeric) AS caixa_mes,
        COALESCE(count(*) FILTER (WHERE vendas.pago = true AND vendas.status = 'entregue'::text AND vendas.forma_pagamento <> 'brinde'::text AND (vendas.origem IS NULL OR vendas.origem <> 'catalogo'::text)), 0::bigint)::integer AS caixa_mes_count,
        COALESCE(sum(COALESCE(vendas.taxa_entrega, 0)) FILTER (WHERE vendas.status = 'entregue'::text AND vendas.forma_pagamento <> 'brinde'::text), 0::numeric) AS receita_frete
    FROM vendas
    GROUP BY (EXTRACT(year FROM vendas.data)), (EXTRACT(month FROM vendas.data))
), com_lag AS (
    SELECT mensais.ano, mensais.mes, mensais.faturamento, mensais.ticket_medio, mensais.lucro_estimado,
        mensais.total_a_receber, mensais.caixa_mes, mensais.caixa_mes_count, mensais.receita_frete,
        lag(mensais.faturamento) OVER (ORDER BY mensais.ano, mensais.mes) AS faturamento_anterior_val
    FROM mensais
), alertas AS (
    SELECT json_agg(json_build_object('venda_id', v.id, 'valor', v.total, 'vencimento', v.data_prevista_pagamento, 'contato_nome', c.nome, 'contato_telefone', c.telefone)) AS financeiros
    FROM vendas v
        JOIN contatos c ON c.id = v.contato_id
    WHERE v.pago = false AND v.status = 'entregue'::text AND v.data_prevista_pagamento < CURRENT_DATE AND v.forma_pagamento <> 'brinde'::text
)
SELECT ano, mes, faturamento, ticket_medio, lucro_estimado, total_a_receber,
    caixa_mes AS liquidado_mes, caixa_mes_count AS liquidado_mes_count,
    COALESCE(faturamento_anterior_val, 0::numeric) AS faturamento_anterior,
    CASE
        WHEN COALESCE(faturamento_anterior_val, 0::numeric) > 0::numeric THEN (faturamento - faturamento_anterior_val) / faturamento_anterior_val * 100::numeric
        ELSE 0::numeric
    END AS variacao_faturamento_percentual,
    COALESCE((SELECT alertas.financeiros FROM alertas), '[]'::json) AS alertas_financeiros,
    receita_frete
FROM com_lag cl;

-- ── view_lucro_liquido_mensal ──
CREATE OR REPLACE VIEW public.view_lucro_liquido_mensal AS
WITH meses AS (
    SELECT date_trunc('month'::text, vendas.data::timestamp with time zone)::date AS mes
    FROM vendas
    GROUP BY (date_trunc('month'::text, vendas.data::timestamp with time zone)::date)
), desp_op AS (
    SELECT date_trunc('month'::text, lancamentos.data::timestamp with time zone)::date AS mes,
        sum(lancamentos.valor) AS despesas_operacionais
    FROM lancamentos
    WHERE lancamentos.tipo = 'saida'::text AND (lancamentos.origem <> ALL (ARRAY['migracao_historica'::text, 'compra_fabrica'::text]))
    GROUP BY (date_trunc('month'::text, lancamentos.data::timestamp with time zone)::date)
), custo_fab AS (
    SELECT date_trunc('month'::text, purchase_order_payments.payment_date)::date AS mes,
        sum(purchase_order_payments.amount) AS custo_fabrica
    FROM purchase_order_payments
    GROUP BY (date_trunc('month'::text, purchase_order_payments.payment_date)::date)
)
SELECT m.mes,
    COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0)) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) AS receita_bruta,
    COALESCE(sum(v.custo_total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) AS custo_produtos,
    COALESCE(sum((v.total - COALESCE(v.taxa_entrega, 0)) - v.custo_total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) AS lucro_bruto,
    COALESCE(d.despesas_operacionais, 0::numeric) AS despesas_operacionais,
    COALESCE(f.custo_fabrica, 0::numeric) AS custo_fabrica,
    COALESCE(sum((v.total - COALESCE(v.taxa_entrega, 0)) - v.custo_total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric)
        + COALESCE(sum(COALESCE(v.taxa_entrega, 0)) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric)
        - COALESCE(d.despesas_operacionais, 0::numeric) AS lucro_liquido,
    CASE
        WHEN sum(v.total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text) > 0::numeric THEN
            round((COALESCE(sum((v.total - COALESCE(v.taxa_entrega, 0)) - v.custo_total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric)
                + COALESCE(sum(COALESCE(v.taxa_entrega, 0)) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric)
                - COALESCE(d.despesas_operacionais, 0::numeric)) / NULLIF(sum(v.total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) * 100::numeric, 2)
        ELSE 0::numeric
    END AS margem_liquida_pct,
    COALESCE(sum(COALESCE(v.taxa_entrega, 0)) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) AS receita_frete
FROM meses m
    LEFT JOIN vendas v ON date_trunc('month'::text, v.data::timestamp with time zone)::date = m.mes
    LEFT JOIN desp_op d ON d.mes = m.mes
    LEFT JOIN custo_fab f ON f.mes = m.mes
GROUP BY m.mes, d.despesas_operacionais, f.custo_fabrica
ORDER BY m.mes DESC;

-- ── rpt_faturamento_comparativo (deriva de view_home_financeiro) ──
CREATE OR REPLACE VIEW public.rpt_faturamento_comparativo AS
SELECT ano, mes, faturamento, faturamento_anterior, variacao_faturamento_percentual,
    lucro_estimado, liquidado_mes, total_a_receber,
    CASE
        WHEN faturamento > 0::numeric THEN round(lucro_estimado / faturamento * 100::numeric, 2)
        ELSE 0::numeric
    END AS margem_bruta_pct,
    receita_frete
FROM view_home_financeiro hf
ORDER BY ano, mes;

NOTIFY pgrst, 'reload schema';
