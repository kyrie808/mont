-- Marketing E4.1 — view de aquisição mensal por origem.
--
-- Alimenta a seção "Aquisição" (mix por canal + série "novos clientes/mês") e o
-- topo do funil de jornada (base de leads). Uma linha por (ano, mes, origem):
--   novos_leads       = contatos cadastrados naquele mês/origem
--   novos_compradores = quantos desses já compraram (entregue, não-brinde)
-- O front recorta por período (mês/geral) e agrega o mix.
--
-- criado_em é timestamptz → localizo em America/Sao_Paulo (mesmo padrão das outras
-- RPCs) antes de extrair ano/mês. security_invoker respeita RLS do chamador.

CREATE OR REPLACE VIEW public.rpt_aquisicao_mensal
WITH (security_invoker = 'true') AS
    WITH base AS (
        SELECT
            (c.criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS d,
            COALESCE(c.origem, 'direto') AS origem,
            EXISTS (
                SELECT 1 FROM vendas v
                WHERE v.contato_id = c.id
                  AND v.status = 'entregue' AND v.forma_pagamento <> 'brinde'
            ) AS comprou
        FROM contatos c
        WHERE c.criado_em IS NOT NULL
    )
    SELECT
        EXTRACT(YEAR  FROM d)::int  AS ano,
        EXTRACT(MONTH FROM d)::int  AS mes,
        origem,
        count(*)                        AS novos_leads,
        count(*) FILTER (WHERE comprou) AS novos_compradores
    FROM base
    GROUP BY 1, 2, 3;
