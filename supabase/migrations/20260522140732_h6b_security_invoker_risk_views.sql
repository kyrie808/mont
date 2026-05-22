-- Ordem obrigatória: view base antes de view dependente
ALTER VIEW public.view_extrato_mensal SET (security_invoker = on);
ALTER VIEW public.view_fluxo_resumo SET (security_invoker = on);
ALTER VIEW public.vw_marketing_pedidos SET (security_invoker = on);
ALTER VIEW public.vw_admin_dashboard SET (security_invoker = on);
ALTER VIEW public.view_contas_a_pagar_dashboard SET (security_invoker = on);
ALTER VIEW public.rpt_projecao_pagamentos SET (security_invoker = on);
