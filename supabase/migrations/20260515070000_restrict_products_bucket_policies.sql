-- Originalmente preparada em 2026-05-09 (timestamp 20260509120100).
-- Renomeada para 2026-05-15 devido à aplicação da migration 20260515060529
-- ter avançado a janela cronológica do CLI. Conteúdo SQL inalterado.

-- ============================================================
-- Onda 1 — C1: bucket 'products' - restringir INSERT/UPDATE/DELETE
-- ============================================================
-- Contexto:
--   As 3 policies destrutivas criadas em 20260405045304_remote_schema.sql
--   permitem que qualquer usuario (anon ou authenticated) escreva/
--   sobrescreva/delete arquivos do bucket 'products'. A anon key
--   esta exposta no bundle JS do catalogo, entao qualquer um com
--   acesso ao site pode apagar todas as imagens de produto.
--
-- Acao:
--   - DROP das 3 policies permissivas (to public) para DELETE, INSERT, UPDATE.
--   - Recriar as 3 policies restritas: apenas authenticated + is_admin().
--   - Manter a policy SELECT publica (leitura e necessaria para o catalogo).
--
-- Callers de storage.from('products').upload / .remove:
--   - apps/interno: usa sessao autenticada (admin) → continua funcionando.
--   - apps/catalogo: usa supabaseAdmin (service_role) → bypassa RLS totalmente.
--
-- Resolve:
--   - Risco C1 do AUDIT.md (anon write em bucket products).
--   - Nota: advisor lint 'public_bucket_allows_listing' (SELECT publico)
--     e documentado mas aceito pois o catalogo publico precisa ver imagens.
-- ============================================================

-- DROP das policies permissivas originais

DROP POLICY IF EXISTS "Allow all deletes on products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow all inserts on products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates on products bucket" ON storage.objects;

-- Recriar restritas a authenticated + is_admin()

CREATE POLICY "Admin delete products bucket"
  ON storage.objects
  AS permissive
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'products'
    AND (SELECT public.is_admin())
  );

CREATE POLICY "Admin insert products bucket"
  ON storage.objects
  AS permissive
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND (SELECT public.is_admin())
  );

CREATE POLICY "Admin update products bucket"
  ON storage.objects
  AS permissive
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'products'
    AND (SELECT public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'products'
    AND (SELECT public.is_admin())
  );
