-- ============================================================
-- ROLLBACK de 20261029211837_catalogo_fecha_escrita_publica
--
-- Devolve exatamente o estado anterior (conferido no dump
-- supabase/backups/dumps/dump-schema-20261029-181459.sql):
--   • criar_pedido executável por PUBLIC, anon, authenticated e service_role;
--   • as 3 policies de INSERT público (role public, WITH CHECK true);
--   • INSERT/UPDATE/DELETE de anon nas 3 tabelas.
--
-- ⚠️ Reabre a brecha (riscos 6 e 7 do diagnóstico da Fase 0). Só rodar se o
-- checkout do catálogo quebrar por causa da migration.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.criar_pedido(
  text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb,
  text, text, text, text, text, text, text
) TO PUBLIC, anon, authenticated, service_role;

CREATE POLICY "Public insert orders" ON public.cat_pedidos      FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert items"  ON public.cat_itens_pedido FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert access" ON public.contatos         FOR INSERT WITH CHECK (true);

GRANT INSERT, UPDATE, DELETE
  ON public.cat_pedidos, public.cat_itens_pedido, public.contatos
  TO anon;

NOTIFY pgrst, 'reload schema';
