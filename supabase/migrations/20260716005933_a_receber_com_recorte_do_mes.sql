-- Card "A Receber" passa a mostrar o recorte do mês SEM perder o total de vista.
--
-- POR QUE O TOTAL CONTINUA SENDO O NÚMERO PRINCIPAL: 62% da dívida está fora do mês
-- corrente (R$5.089,70 em 83 vendas; a mais antiga de 06/01/2026). Escopar o card ao
-- mês jogaria a maior parte — e a mais urgente — pra fora do número em destaque.
-- Dívida não tem mês: o total lidera, o mês entra como contexto.
--
-- Ganha 2 params OPCIONAIS. Precisa de DROP antes: CREATE OR REPLACE com assinatura
-- diferente criaria um OVERLOAD, e a chamada sem args ficaria ambígua.
--
-- ROLLBACK:
--   DROP FUNCTION public.rpc_total_a_receber_dashboard(int, int);
--   -- e recriar a versão sem params (ver 20260715210200_fix_rpc_total_a_receber_parciais.sql)

DROP FUNCTION IF EXISTS public.rpc_total_a_receber_dashboard();

CREATE OR REPLACE FUNCTION public.rpc_total_a_receber_dashboard(
    p_ano integer DEFAULT NULL,
    p_mes integer DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT jsonb_build_object(
        -- Total em aberto de TODOS os meses (o número que lidera o card)
        'total_a_receber',        COALESCE(SUM(total - COALESCE(valor_pago, 0)), 0),
        'total_contatos_abertos', COUNT(DISTINCT contato_id),
        -- Recorte: quanto das vendas DO MÊS selecionado ainda falta receber.
        -- Sem p_ano/p_mes retorna 0 (compatível com chamadas antigas).
        'a_receber_mes',          COALESCE(SUM(total - COALESCE(valor_pago, 0)) FILTER (
                                      WHERE p_ano IS NOT NULL AND p_mes IS NOT NULL
                                        AND EXTRACT(year  FROM data) = p_ano
                                        AND EXTRACT(month FROM data) = p_mes
                                  ), 0)
    )
    FROM public.vendas
    WHERE pago = false
      AND status = 'entregue'
      AND forma_pagamento <> 'brinde'
      AND (origem IS NULL OR origem <> 'catalogo')
      AND (SELECT public.is_admin());
$function$;
