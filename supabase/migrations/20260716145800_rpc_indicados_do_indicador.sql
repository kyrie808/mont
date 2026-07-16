-- Drill-down de indicação: os contatos que UMA pessoa trouxe, com o gasto de cada um.
-- Alimenta o expand do Ranking de Indicações e a seção "Clientes que indicou" no perfil.
--
-- Mesma fórmula produto-only da view ranking_indicacoes (manter em sincronia): gasto =
-- SUM(total - taxa_entrega) FILTER (entregue+pago+não-brinde). `comprou` distingue quem
-- converteu de quem só foi cadastrado como indicado.
--
-- SECURITY INVOKER: RLS decide (admin vê tudo), mesmo modelo das views.

CREATE OR REPLACE FUNCTION public.rpc_indicados_do_indicador(p_indicador_id uuid)
RETURNS TABLE (
    contato_id uuid,
    nome text,
    total_compras bigint,
    total_gasto numeric,
    ultima_compra date,
    comprou boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
    SELECT
        c.id AS contato_id,
        c.nome,
        count(v.id) FILTER (
            WHERE v.status = 'entregue' AND v.pago = true AND v.forma_pagamento <> 'brinde'
        ) AS total_compras,
        COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0)) FILTER (
            WHERE v.status = 'entregue' AND v.pago = true AND v.forma_pagamento <> 'brinde'
        ), 0::numeric) AS total_gasto,
        max(v.data) FILTER (
            WHERE v.status = 'entregue' AND v.pago = true AND v.forma_pagamento <> 'brinde'
        ) AS ultima_compra,
        count(v.id) FILTER (
            WHERE v.status = 'entregue' AND v.pago = true AND v.forma_pagamento <> 'brinde'
        ) > 0 AS comprou
    FROM contatos c
    LEFT JOIN vendas v ON v.contato_id = c.id
    WHERE c.indicado_por_id = p_indicador_id
    GROUP BY c.id, c.nome
    ORDER BY total_gasto DESC, c.nome;
$function$;
