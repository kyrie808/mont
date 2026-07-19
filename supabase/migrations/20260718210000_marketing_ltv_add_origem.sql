-- Marketing E4.1 — anexa `origem` ao rpt_ltv_por_cliente_periodo.
--
-- A aba Marketing (cockpit de aquisição) precisa cruzar LTV/recompra/atividade com
-- o CANAL de aquisição (contatos.origem). Em vez de uma RPC nova, anexo a coluna
-- `origem` no fim do contrato existente — retrocompatível (TabClientes/TabProdutos
-- ignoram a coluna nova). Toda a lógica de ritmo/status_atividade é preservada.
--
-- ⚠️ FOOTGUN: mudar o RETURNS TABLE exige DROP + CREATE (não dá CREATE OR REPLACE).
-- Assinatura idêntica (date, date) → dropo a exata e recrio.

DROP FUNCTION IF EXISTS public.rpt_ltv_por_cliente_periodo(date, date);

CREATE FUNCTION public.rpt_ltv_por_cliente_periodo(p_desde date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS TABLE(contato_id uuid, nome text, telefone text, tipo text, status text, total_pedidos bigint, ltv_total numeric, ticket_medio numeric, primeira_compra date, ultima_compra date, dias_relacionamento integer, status_atividade text, origem text)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
    WITH cfg AS (
        SELECT COALESCE(max((valor ->> 'limiar_reativacao')::integer), 30) AS limiar_reativacao,
               COALESCE(max((valor ->> 'multiplicador_sumido')::numeric), 1.5) AS multiplicador_sumido
        FROM configuracoes WHERE chave = 'relacionamento'
    ), base AS (
        SELECT c.id AS contato_id, c.nome, c.telefone, c.tipo, c.status, c.origem,
            count(DISTINCT v.data) AS total_pedidos,
            sum(v.total - COALESCE(v.taxa_entrega, 0)) AS ltv_total,
            round(sum(v.total - COALESCE(v.taxa_entrega, 0)) / NULLIF(count(DISTINCT v.data), 0)::numeric, 2) AS ticket_medio,
            min(v.data) AS primeira_compra, max(v.data) AS ultima_compra,
            (max(v.data) - min(v.data)) AS dias_relacionamento
        FROM contatos c
        JOIN vendas v ON v.contato_id = c.id
        WHERE v.status = 'entregue' AND v.forma_pagamento <> 'brinde'
          AND (p_desde IS NULL OR v.data >= p_desde)
          AND (p_ate IS NULL OR v.data <= p_ate)
        GROUP BY c.id, c.nome, c.telefone, c.tipo, c.status, c.origem
    ), ritmo AS (
        SELECT b.*,
            (CURRENT_DATE - b.ultima_compra) AS dias_sem_compra,
            CASE WHEN b.total_pedidos >= 2
                 THEN (b.ultima_compra - b.primeira_compra)::numeric / (b.total_pedidos - 1)::numeric
                 ELSE NULL END AS intervalo_medio,
            CASE WHEN b.total_pedidos >= 2
                 THEN CURRENT_DATE - (b.ultima_compra + ((b.ultima_compra - b.primeira_compra) / (b.total_pedidos - 1))::integer)
                 ELSE NULL END AS atraso
        FROM base b
    )
    SELECT r.contato_id, r.nome, r.telefone, r.tipo, r.status,
        r.total_pedidos, r.ltv_total, r.ticket_medio,
        r.primeira_compra, r.ultima_compra, r.dias_relacionamento,
        CASE WHEN r.total_pedidos >= 2 THEN
                CASE WHEN r.atraso < 0 THEN 'ativo'
                     WHEN r.atraso::numeric < round(r.intervalo_medio * cfg.multiplicador_sumido) THEN 'risco'
                     ELSE 'adormecido' END
             ELSE
                CASE WHEN r.dias_sem_compra < cfg.limiar_reativacao THEN 'ativo'
                     WHEN r.dias_sem_compra::numeric < round(cfg.limiar_reativacao::numeric * cfg.multiplicador_sumido) THEN 'risco'
                     ELSE 'adormecido' END
        END AS status_atividade,
        r.origem
    FROM ritmo r CROSS JOIN cfg
    ORDER BY r.ltv_total DESC;
$function$;
