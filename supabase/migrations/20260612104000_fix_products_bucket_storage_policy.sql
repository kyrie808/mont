-- Fix: upload de imagem de produto falhava com 403 "new row violates RLS" no Storage.
-- Causa-raiz (confirmada via diagnóstico): as policies de ESCRITA do bucket 'products'
-- dependiam de is_admin(), que avalia auth.uid() de forma inconsistente entre PostgREST
-- e o storage-api (mesma sessão: is_admin() = TRUE via PostgREST, porém FALSE no contexto
-- do Storage → 403). O token é válido (role authenticated casou); só a checagem is_admin falha.
--
-- Correção: gatear a escrita apenas em role `authenticated` + bucket 'products' (sem is_admin()).
-- SEGURO HOJE: só os admins autenticam no Supabase; o cliente do catálogo faz checkout anônimo.
-- ⚠️ REVISITAR quando a área-do-cliente existir (clientes autenticando ⇒ "authenticated"
--    deixaria de ser só-admin). Leitura segue pública (bucket public=true).

DROP POLICY IF EXISTS "Admin insert products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin update products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete products bucket" ON storage.objects;

CREATE POLICY "Authenticated insert products bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');

CREATE POLICY "Authenticated update products bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products')
  WITH CHECK (bucket_id = 'products');

CREATE POLICY "Authenticated delete products bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products');
