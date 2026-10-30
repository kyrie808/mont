-- ============================================================
-- Catálogo: fecha a escrita pública (29/10/2026)
--
-- Achado do diagnóstico da Fase 0 da loja (docs/loja-black/diagnostico-fase0.md,
-- riscos 6 e 7): com a chave pública (anon) dava para chamar criar_pedido com
-- qualquer preço e inserir direto em cat_pedidos, cat_itens_pedido e contatos.
--
-- Ninguém do sistema depende desse acesso (levantamento de 29/10):
--   • criar_pedido tem um único chamador, o route handler do catálogo
--     (apps/catalogo/src/app/api/pedidos/route.ts), que usa service role desde
--     01/04/2026. A exceção "anon precisa chamar" da migration
--     20260515070200_restrict_rpc_execute_grants ficou obsoleta.
--   • As demais escritas nessas tabelas vêm de service role (rotas admin do
--     catálogo, Edge Functions), de admin autenticado (interno, coberto pelas
--     policies de admin) ou de funções SECURITY DEFINER (ignoram RLS).
--
-- Fora do escopo (fica para a Fase 2 da loja, junto com a P6): criar_pedido
-- continua sobrescrevendo nome/endereço de contato existente.
--
-- Rollback: supabase/rollbacks/20261029211837_catalogo_fecha_escrita_publica.rollback.sql
-- ============================================================

-- 1. criar_pedido: só o servidor. PUBLIC sai junto — o grant padrão de função
--    para PUBLIC alcança anon e authenticated mesmo sem grant explícito.
REVOKE EXECUTE ON FUNCTION public.criar_pedido(
  text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb,
  text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.criar_pedido(
  text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb,
  text, text, text, text, text, text, text
) TO service_role;

-- 2. INSERT público direto: sem uso. Admin segue escrevendo pelas policies
--    "Admin manage orders" / "Admin manage items" / "Admin full access".
DROP POLICY "Public insert orders" ON public.cat_pedidos;
DROP POLICY "Public insert items"  ON public.cat_itens_pedido;
DROP POLICY "Public insert access" ON public.contatos;

-- 3. Defesa em profundidade: anon não escreve nessas tabelas nem se uma
--    policy pública for recriada por engano.
REVOKE INSERT, UPDATE, DELETE
  ON public.cat_pedidos, public.cat_itens_pedido, public.contatos
  FROM anon;

NOTIFY pgrst, 'reload schema';
