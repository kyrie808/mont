-- Troca COUNT(*) por COUNT(DISTINCT contato_id) no RPC a-receber do dashboard.
-- Campo renomeado: total_vendas_abertas → total_contatos_abertos (semântica honesta).
-- Guard is_admin (H-3), SECURITY DEFINER e search_path preservados intactos.
CREATE OR REPLACE FUNCTION public.rpc_total_a_receber_dashboard()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT jsonb_build_object(
        'total_a_receber',        COALESCE(SUM(total), 0),
        'total_contatos_abertos', COUNT(DISTINCT contato_id)
    )
    FROM public.vendas
    WHERE pago = false
      AND status = 'entregue'
      AND forma_pagamento <> 'brinde'
      AND (origem IS NULL OR origem <> 'catalogo')
      AND (SELECT public.is_admin());
$function$;
