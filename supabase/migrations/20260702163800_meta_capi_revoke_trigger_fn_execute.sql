-- fn_enfileirar_purchase_meta é trigger-only: não deve ser chamável via API REST.
-- Revoga EXECUTE de PUBLIC/anon/authenticated (o trigger dispara independente de grant).
-- Fecha os lints 0028/0029 sem afetar o funcionamento do enfileiramento.
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_purchase_meta() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_purchase_meta() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_purchase_meta() FROM authenticated;
