-- "Saúde do estoque" só de itens ESTOCÁVEIS: exclui combos (eh_combo=true).
--
-- Combo é bundle montado de componentes — não tem estoque físico próprio, e giro
-- (vendido/estoque) não faz sentido pra ele. Antes os 6 combos ativos apareciam como
-- "zerado · precisam de atenção", inflando a leitura. Combos SEGUEM em margem/receita
-- (são vendas reais) — só saem do relatório de estoque.
--
-- Mesma assinatura (p_desde, p_ate) e colunas de 20260716172000 — sem regen de types.

CREATE OR REPLACE FUNCTION public.rpt_giro_estoque_periodo(p_desde date DEFAULT NULL, p_ate date DEFAULT NULL)
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
          AND (p_ate IS NULL OR v.data <= p_ate)
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
      AND COALESCE(p.eh_combo, false) = false
    ORDER BY (CASE WHEN COALESCE(p.estoque_atual, 0) > 0
                   THEN round(COALESCE(vp.total_vendido, 0) / p.estoque_atual::numeric, 2)
                   ELSE NULL END) DESC NULLS LAST;
$function$;
