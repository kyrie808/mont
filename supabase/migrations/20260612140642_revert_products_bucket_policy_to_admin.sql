-- Reverte a policy de escrita do bucket 'products' pro estado original (admin-only).
-- O upload de imagem agora passa pela Edge Function 'upload-product-image' (service_role,
-- que bypassa RLS do Storage), então a escrita client-side direta não é mais usada —
-- restauramos a guarda original (is_admin) por least-privilege.
-- (A migração 20260612104000 havia afrouxado pra "authenticated" como tentativa de fix,
--  mas a causa-raiz era o Storage não validar o JWT do interno, não a policy.)

DROP POLICY IF EXISTS "Authenticated insert products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete products bucket" ON storage.objects;

CREATE POLICY "Admin insert products bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND (SELECT is_admin()));

CREATE POLICY "Admin update products bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products' AND (SELECT is_admin()))
  WITH CHECK (bucket_id = 'products' AND (SELECT is_admin()));

CREATE POLICY "Admin delete products bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND (SELECT is_admin()));
