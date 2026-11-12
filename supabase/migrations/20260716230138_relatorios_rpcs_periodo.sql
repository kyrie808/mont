-- Relatórios: RPCs period-aware + canônicas (frete fora, só entregue, brinde fora).
--
-- Substituem as views rpt_* (que somavam `total` cru e filtravam só <>cancelada) por
-- funções com recorte de período `p_desde` (NULL = tudo; a UI passa hoje - {30,90,180,365}d).
-- Receita = PRODUTO (total - taxa_entrega); filtro status='entregue'; brinde sempre fora.
-- Magnitude da correção é pequena hoje (frete ≈ R$161), é consistência com o canon.
--
-- SECURITY INVOKER (mesmo modelo das views). Não tocam view_home_financeiro (Financeiro
-- reconcilia com o Início e usa recorte client-side das linhas mensais).

-- 1) LTV por cliente ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpt_ltv_por_cliente_periodo(p_desde date DEFAULT NULL)
RETURNS TABLE (
    contato_id uuid, nome text, telefone text, tipo text, status text,
    total_pedidos bigint, ltv_total numeric, ticket_medio numeric,
    primeira_compra date, ultima_compra date, dias_relacionamento integer,
    status_atividade text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
    WITH cfg AS (
        SELECT COALESCE(max((valor ->> 'limiar_reativacao')::integer), 30) AS limiar_reativacao,
               COALESCE(max((valor ->> 'multiplicador_sumido')::numeric), 1.5) AS multiplicador_sumido
        FROM configuracoes WHERE chave = 'relacionamento'
    ), base AS (
        SELECT c.id AS contato_id, c.nome, c.telefone, c.tipo, c.status,
            count(DISTINCT v.data) AS total_pedidos,
            sum(v.total - COALESCE(v.taxa_entrega, 0)) AS ltv_total,
            round(sum(v.total - COALESCE(v.taxa_entrega, 0)) / NULLIF(count(DISTINCT v.data), 0)::numeric, 2) AS ticket_medio,
            min(v.data) AS primeira_compra, max(v.data) AS ultima_compra,
            (max(v.data) - min(v.data)) AS dias_relacionamento
        FROM contatos c
        JOIN vendas v ON v.contato_id = c.id
        WHERE v.status = 'entregue' AND v.forma_pagamento <> 'brinde'
          AND (p_desde IS NULL OR v.data >= p_desde)
        GROUP BY c.id, c.nome, c.telefone, c.tipo, c.status
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
        END AS status_atividade
    FROM ritmo r CROSS JOIN cfg
    ORDER BY r.ltv_total DESC;
$function$;

-- 2) Margem por SKU -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpt_margem_por_sku_periodo(p_desde date DEFAULT NULL)
RETURNS TABLE (
    produto_id uuid, nome text, codigo text, unidade text,
    total_vendido numeric, receita_total numeric, custo_total numeric,
    lucro_bruto numeric, margem_pct numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
    SELECT p.id AS produto_id, p.nome, p.codigo, p.unidade,
        sum(iv.quantidade) AS total_vendido,
        sum(iv.subtotal) AS receita_total,
        sum(iv.quantidade * iv.custo_unitario) AS custo_total,
        sum(iv.subtotal) - sum(iv.quantidade * iv.custo_unitario) AS lucro_bruto,
        CASE WHEN sum(iv.subtotal) > 0
             THEN round((sum(iv.subtotal) - sum(iv.quantidade * iv.custo_unitario)) / sum(iv.subtotal) * 100, 2)
             ELSE 0 END AS margem_pct
    FROM itens_venda iv
    JOIN vendas v ON v.id = iv.venda_id
    JOIN produtos p ON p.id = iv.produto_id
    WHERE v.status = 'entregue' AND v.forma_pagamento <> 'brinde'
      AND (p_desde IS NULL OR v.data >= p_desde)
    GROUP BY p.id, p.nome, p.codigo, p.unidade
    ORDER BY (sum(iv.subtotal) - sum(iv.quantidade * iv.custo_unitario)) DESC;
$function$;

-- 3) Giro de estoque ------------------------------------------------------------------
--   status_estoque mantém o contrato {zerado, abaixo_minimo, ok} (o bug estava no front).
--   Janela recorta o "vendido" (giro = vendido no período / estoque atual).
CREATE OR REPLACE FUNCTION public.rpt_giro_estoque_periodo(p_desde date DEFAULT NULL)
RETURNS TABLE (
    produto_id uuid, nome text, codigo text,
    estoque_atual integer, estoque_minimo integer,
    total_vendido_historico numeric, total_comprado_historico bigint,
    giro_estoque numeric, status_estoque text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
    WITH vendas_por_produto AS (
        SELECT iv.produto_id, sum(iv.quantidade) AS total_vendido
        FROM itens_venda iv
        JOIN vendas v ON v.id = iv.venda_id
        WHERE v.status = 'entregue' AND v.forma_pagamento <> 'brinde'
          AND (p_desde IS NULL OR v.data >= p_desde)
        GROUP BY iv.produto_id
    ), compras_por_produto AS (
        SELECT poi.product_id AS produto_id, sum(poi.quantity) AS total_comprado
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.status <> 'cancelled'::purchase_order_status
        GROUP BY poi.product_id
    )
    SELECT p.id AS produto_id, p.nome, p.codigo, p.estoque_atual, p.estoque_minimo,
        COALESCE(vp.total_vendido, 0) AS total_vendido_historico,
        COALESCE(cp.total_comprado, 0::bigint) AS total_comprado_historico,
        CASE WHEN COALESCE(p.estoque_atual, 0) > 0
             THEN round(COALESCE(vp.total_vendido, 0) / p.estoque_atual::numeric, 2)
             ELSE NULL END AS giro_estoque,
        CASE WHEN COALESCE(p.estoque_atual, 0) = 0 THEN 'zerado'
             WHEN p.estoque_minimo IS NOT NULL AND p.estoque_atual <= p.estoque_minimo THEN 'abaixo_minimo'
             ELSE 'ok' END AS status_estoque
    FROM produtos p
    LEFT JOIN vendas_por_produto vp ON vp.produto_id = p.id
    LEFT JOIN compras_por_produto cp ON cp.produto_id = p.id
    WHERE p.ativo = true
    ORDER BY (CASE WHEN COALESCE(p.estoque_atual, 0) > 0
                   THEN round(COALESCE(vp.total_vendido, 0) / p.estoque_atual::numeric, 2)
                   ELSE NULL END) DESC NULLS LAST;
$function$;

-- 4) Distribuição por forma de pagamento ----------------------------------------------
CREATE OR REPLACE FUNCTION public.rpt_distribuicao_forma_pagamento_periodo(p_desde date DEFAULT NULL)
RETURNS TABLE (
    forma_pagamento text, total_vendas bigint, faturamento numeric,
    pct_contagem numeric, pct_faturamento numeric,
    vendas_liquidadas bigint, vendas_pendentes bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
    SELECT forma_pagamento,
        count(*) AS total_vendas,
        sum(total - COALESCE(taxa_entrega, 0)) AS faturamento,
        round(count(*)::numeric / sum(count(*)) OVER () * 100, 2) AS pct_contagem,
        round(sum(total - COALESCE(taxa_entrega, 0)) / NULLIF(sum(sum(total - COALESCE(taxa_entrega, 0))) OVER (), 0) * 100, 2) AS pct_faturamento,
        count(*) FILTER (WHERE pago = true) AS vendas_liquidadas,
        count(*) FILTER (WHERE pago = false) AS vendas_pendentes
    FROM vendas
    WHERE status = 'entregue' AND forma_pagamento <> 'brinde'
      AND (p_desde IS NULL OR data >= p_desde)
    GROUP BY forma_pagamento
    ORDER BY (sum(total - COALESCE(taxa_entrega, 0))) DESC;
$function$;

-- 5) Marketing (canal online/direto) --------------------------------------------------
--   Receita = PRODUTO: online usa cat_pedidos.subtotal; direto usa vendas.total - taxa_entrega.
--   ticket_medio é POR PEDIDO (legítimo p/ marketing; a UI rotula como tal).
CREATE OR REPLACE FUNCTION public.rpt_marketing_pedidos_periodo(p_desde date DEFAULT NULL)
RETURNS TABLE (
    data_venda date, semana_iso text, mes_iso text,
    total_pedidos bigint, faturamento numeric, ticket_medio numeric,
    pedidos_online bigint, pedidos_diretos bigint,
    faturamento_online numeric, faturamento_direto numeric,
    entregas_count bigint, retiradas_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
    WITH todas_vendas AS (
        SELECT (cp.criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS data_venda,
            'online'::text AS origem_tipo,
            cp.subtotal AS total_reais,
            cp.metodo_entrega
        FROM cat_pedidos cp
        WHERE cp.status <> 'cancelado' AND cp.status_pagamento = 'pago'
        UNION ALL
        SELECT v.data AS data_venda,
            'direta'::text AS origem_tipo,
            (v.total - COALESCE(v.taxa_entrega, 0)) AS total_reais,
            NULL::text AS metodo_entrega
        FROM vendas v
        WHERE v.status <> 'cancelada' AND v.pago = true
          AND (v.origem IS NULL OR v.origem <> 'catalogo') AND v.forma_pagamento <> 'brinde'
    )
    SELECT data_venda,
        to_char(data_venda::timestamp with time zone, 'IYYY-IW') AS semana_iso,
        to_char(data_venda::timestamp with time zone, 'YYYY-MM') AS mes_iso,
        count(*) AS total_pedidos,
        sum(total_reais) AS faturamento,
        round(avg(total_reais), 2) AS ticket_medio,
        count(*) FILTER (WHERE origem_tipo = 'online') AS pedidos_online,
        count(*) FILTER (WHERE origem_tipo = 'direta') AS pedidos_diretos,
        sum(total_reais) FILTER (WHERE origem_tipo = 'online') AS faturamento_online,
        sum(total_reais) FILTER (WHERE origem_tipo = 'direta') AS faturamento_direto,
        count(*) FILTER (WHERE metodo_entrega = 'entrega') AS entregas_count,
        count(*) FILTER (WHERE metodo_entrega = 'retirada') AS retiradas_count
    FROM todas_vendas
    WHERE (p_desde IS NULL OR data_venda >= p_desde)
    GROUP BY data_venda
    ORDER BY data_venda DESC;
$function$;
