-- Marketing E4.1 — RPC de promoções (brindes + descontos) period-aware.
--
-- Alavancas de marketing hoje sem NENHUM relatório. Uma linha agregada:
--   brindes  = vendas com forma_pagamento='brinde' (entregue) → qtd, R$ doado, nº clientes
--   desconto = vendas com desconto>0 (entregue, não-brinde) → qtd, R$ total concedido
-- Brinde usa `total` (valor doado); desconto usa a coluna `vendas.desconto`.
-- Period-aware pelo padrão (p_desde, p_ate). SECURITY INVOKER.

CREATE OR REPLACE FUNCTION public.rpt_promocoes_periodo(p_desde date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS TABLE(brindes_qtd bigint, brindes_valor numeric, brindes_clientes bigint, desconto_qtd bigint, desconto_total numeric)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
    SELECT
        count(*) FILTER (WHERE v.forma_pagamento = 'brinde')                              AS brindes_qtd,
        COALESCE(sum(v.total) FILTER (WHERE v.forma_pagamento = 'brinde'), 0)             AS brindes_valor,
        count(DISTINCT v.contato_id) FILTER (WHERE v.forma_pagamento = 'brinde')          AS brindes_clientes,
        count(*) FILTER (WHERE v.forma_pagamento <> 'brinde' AND v.desconto > 0)          AS desconto_qtd,
        COALESCE(sum(v.desconto) FILTER (WHERE v.forma_pagamento <> 'brinde' AND v.desconto > 0), 0) AS desconto_total
    FROM vendas v
    WHERE v.status = 'entregue'
      AND (p_desde IS NULL OR v.data >= p_desde)
      AND (p_ate IS NULL OR v.data <= p_ate);
$function$;
