REVOKE EXECUTE ON FUNCTION public.registrar_ajuste_saldo(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste_saldo(uuid, numeric) TO authenticated;
