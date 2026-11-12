-- Corrige rpc_total_a_receber_dashboard: somava `total` e ignorava pagamentos PARCIAIS.
-- Uma venda de R$100 com R$60 já recebidos (pago=false) contava como R$100 a receber.
--
-- A view_home_financeiro JÁ calcula `SUM(total - valor_pago)` corretamente — o RPC era
-- uma segunda implementação do mesmo conceito que divergiu. Esta migration alinha as duas.
--
-- IMPACTO HOJE: ZERO. Existem só 2 parciais no banco inteiro (R$0,02) e nenhum entra no
-- filtro deste RPC (entregue + não-brinde + não-catálogo). É correção PREVENTIVA: o número
-- retornado deve permanecer idêntico (R$8.179,60 / 106 clientes em 15/07).
--
-- ROLLBACK: trocar `SUM(total - COALESCE(valor_pago, 0))` de volta por `SUM(total)`.

CREATE OR REPLACE FUNCTION public.rpc_total_a_receber_dashboard()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT jsonb_build_object(
        'total_a_receber',        COALESCE(SUM(total - COALESCE(valor_pago, 0)), 0),
        'total_contatos_abertos', COUNT(DISTINCT contato_id)
    )
    FROM public.vendas
    WHERE pago = false
      AND status = 'entregue'
      AND forma_pagamento <> 'brinde'
      AND (origem IS NULL OR origem <> 'catalogo')
      AND (SELECT public.is_admin());
$function$;
