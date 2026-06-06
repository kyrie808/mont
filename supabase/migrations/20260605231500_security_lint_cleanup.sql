-- =============================================================================
-- Limpeza de lints de segurança (advisors 05/06/2026)
-- Diagnóstico completo: memória debito-arquitetural-baseline.
-- Nenhuma destas mudanças toca dados. Backup completo tirado antes
-- (supabase/backups/dumps/dump-{schema,data}-20260605-231040.sql).
-- =============================================================================

-- ─── 2a. rpc_perfil_extras: revogar anon (lint 0028) ─────────────────────────
-- Criada em 03/06 FORA do trilho de hardening de maio, ficou anon-executável.
-- Já tem guard is_admin() interno (retorna NULL pra não-admin), então o risco
-- real era baixo; revogar anon fecha o lint e restaura o default do projeto
-- (REVOKE anon/PUBLIC em toda função SECURITY DEFINER). authenticated mantém
-- EXECUTE — o apps/interno chama via sessão autenticada.
REVOKE EXECUTE ON FUNCTION public.rpc_perfil_extras(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_perfil_extras(uuid) FROM PUBLIC;

-- ─── 2b. search_path mutável (lint 0011) ─────────────────────────────────────
-- As 3 funções usam apenas built-ins (resolvidos via pg_catalog, sempre no
-- path mesmo com search_path vazio). Nenhuma referencia tabela/objeto custom,
-- então SET search_path = '' é seguro e não exige qualificação de schema.
ALTER FUNCTION public.fn_capitalize_name(text) SET search_path = '';
ALTER FUNCTION public.fn_count_words(text) SET search_path = '';
ALTER FUNCTION public.prevent_delete_automatic_plan() SET search_path = '';

-- ─── 2c. Bucket 'products': remover SELECT público amplo (lint 0025) ─────────
-- Nenhum app usa storage.list(); o catálogo exibe imagem via getPublicUrl, que
-- não depende desta policy (o bucket é público — URLs servem direto). A escrita
-- (INSERT/UPDATE/DELETE) continua admin-only desde 20260515070000.
DROP POLICY IF EXISTS "Allow public read access on products bucket" ON storage.objects;

NOTIFY pgrst, 'reload schema';
