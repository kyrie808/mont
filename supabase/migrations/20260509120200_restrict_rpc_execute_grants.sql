-- ============================================================
-- Onda 1 — C2: REVOKE EXECUTE em RPCs SECURITY DEFINER de anon
-- ============================================================
-- Contexto:
--   21 funcoes SECURITY DEFINER tinham GRANT ALL TO anon/authenticated/service_role
--   (explícito) + um grant PUBLIC default do PostgreSQL.
--   fn_backfill_contatos_nome foi dropada na Fase A.
--   Para retirar acesso de anon é preciso:
--     1. REVOKE do grant explícito FROM anon  (já cobre roles com grant direto)
--     2. REVOKE FROM PUBLIC (remove herança de roles sem grant explícito)
--   authenticated e service_role mantêm EXECUTE via grants explícitos.
--
--   Categorização por quem chama (grep real em apps/*/src):
--
--   GRUPO A: Funcoes de trigger (RETURNS trigger)
--     Mecanismo de trigger não usa EXECUTE privilege do role chamador.
--     Nenhum app chama via PostgREST. REVOKE anon + authenticated + PUBLIC.
--     service_role mantém grant explícito (não precisa mas não polui).
--
--   GRUPO B: RPCs do apps/interno (authenticated chama via supabase.rpc())
--     REVOKE anon + PUBLIC. authenticated e service_role mantêm grants explícitos.
--
--   GRUPO C: RPC do apps/catalogo via supabaseAdmin (service_role)
--     REVOKE anon + PUBLIC. authenticated e service_role mantêm grants explícitos.
--
--   GRUPO D: is_admin — usada em policies RLS (TO authenticated)
--     REVOKE anon + PUBLIC.
--     authenticated PRECISA de EXECUTE para avaliar policies com is_admin().
--     Sem o grant, SELECT em configuracoes/contas falha com "permission denied".
--     authenticated mantém grant explícito.
--
--   GRUPO E: RPCs orfas — sem chamadores em nenhum app
--     REVOKE anon + authenticated + PUBLIC. Candidatas a DROP em Onda 2.
--     service_role mantém grant explícito para uso ad-hoc.
--
--   SEM ALTERACAO:
--     criar_pedido — anon precisa chamar (checkout público do catalogo).
--
-- Resolve: advisor lint anon_security_definer_function_executable para
--   18 funcoes (excluindo criar_pedido e fn_backfill_contatos_nome dropada).
-- ============================================================


-- ============================================================
-- GRUPO A: Trigger functions
-- REVOKE anon + authenticated + PUBLIC
-- (service_role mantém grant explícito — irrelevante mas deixar)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.fn_sync_cat_pedido_to_venda() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_cat_pedido_to_venda() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.handle_audit_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_audit_fields() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.handle_brinde_before_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_brinde_before_insert() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.handle_stock_on_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_stock_on_status_change() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.sync_venda_to_cat_pedido() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_venda_to_cat_pedido() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_venda_pagamento_summary() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_venda_pagamento_summary() FROM PUBLIC;


-- ============================================================
-- GRUPO B: RPCs do apps/interno
-- REVOKE anon + PUBLIC. authenticated e service_role mantêm grants explícitos.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.add_image_reference(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_image_reference(uuid, text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.criar_obrigacao_parcelada(
    text, text, numeric, date, uuid, integer, text, text
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.criar_obrigacao_parcelada(
    text, text, numeric, date, uuid, integer, text, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.registrar_despesa_manual(
    numeric, text, date, uuid, uuid
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_despesa_manual(
    numeric, text, date, uuid, uuid
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.registrar_entrada_manual(
    numeric, text, date, uuid, uuid
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_entrada_manual(
    numeric, text, date, uuid, uuid
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.registrar_pagamento_conta_a_pagar(
    uuid, numeric, date, uuid, text, text, uuid
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_pagamento_conta_a_pagar(
    uuid, numeric, date, uuid, text, text, uuid
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.registrar_pagamento_venda(
    uuid, numeric, text, date, uuid, text
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_pagamento_venda(
    uuid, numeric, text, date, uuid, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.rpc_total_a_receber_dashboard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_total_a_receber_dashboard() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_purchase_order_with_items(
    uuid, uuid, date, numeric, text, text, text, jsonb
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_purchase_order_with_items(
    uuid, uuid, date, numeric, text, text, text, jsonb
) FROM PUBLIC;


-- ============================================================
-- GRUPO C: delete_image_reference
-- Catalogo chama via supabaseAdmin (service_role). REVOKE anon + PUBLIC.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.delete_image_reference(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_image_reference(uuid) FROM PUBLIC;


-- ============================================================
-- GRUPO D: is_admin
-- REVOKE anon + PUBLIC. authenticated MANTÉM grant explícito (necessário para policies).
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;


-- ============================================================
-- GRUPO E: RPCs orfas — REVOKE anon + authenticated + PUBLIC
-- Candidatas a DROP em Onda 2.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.rpc_total_a_receber_simples() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_total_a_receber_simples() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.rpt_churn(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpt_churn(integer) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.rpt_vendas_por_periodo(date, date, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpt_vendas_por_periodo(date, date, text) FROM PUBLIC;
