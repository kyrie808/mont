-- FIX: o CREATE OR REPLACE das views de faturamento (migration
-- 20260622024500) resetou o `security_invoker`, deixando-as como SECURITY
-- DEFINER (advisor 0010, ERROR). Restaura security_invoker=on, alinhando com
-- as demais views do projeto (view_extrato_mensal, view_liquidado_mensal etc).

ALTER VIEW public.view_home_financeiro       SET (security_invoker = on);
ALTER VIEW public.view_lucro_liquido_mensal  SET (security_invoker = on);
ALTER VIEW public.rpt_faturamento_comparativo SET (security_invoker = on);
