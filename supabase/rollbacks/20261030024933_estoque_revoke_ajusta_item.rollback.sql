-- ============================================================
-- ROLLBACK de 20261030024933_estoque_revoke_ajusta_item
--
-- Devolve o estado anterior (conferido no dump
-- supabase/backups/dumps/dump-schema-20261029-234551.sql): fn_ajusta_estoque_item
-- executável por PUBLIC, anon, authenticated e service_role.
--
-- ⚠️ Reabre a brecha (qualquer um com a chave pública altera estoque). Só rodar
-- se a baixa de estoque na entrega quebrar por causa da migration.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.fn_ajusta_estoque_item(uuid, numeric, integer)
  TO PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
