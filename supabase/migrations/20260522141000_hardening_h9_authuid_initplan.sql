-- H-9 (P2-DB05): auth.uid() RAW → (SELECT auth.uid()) em 2 policies
-- Objetivo: eliminar avaliação por-linha de auth.uid() (performance, initplan)
-- Lógica de acesso: idêntica ao estado anterior — zero mudança de comportamento

-- 1. admin_users — "Admin full access on admin_users"
--    USING: a.user_id = auth.uid()  →  a.user_id = (SELECT auth.uid())
--    Nota: policy auto-referente já existia antes desta troca.
--    (SELECT auth.uid()) é escalar — não adiciona query a admin_users, sem recursão.
ALTER POLICY "Admin full access on admin_users" ON public.admin_users
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users a
      WHERE a.user_id = (SELECT auth.uid())
        AND a.role = ANY (ARRAY['admin'::text, 'super_admin'::text])
    )
  );

-- 2. interacoes — "Authenticated insert own interacoes"
--    WITH CHECK: criado_por = auth.uid()  →  criado_por = (SELECT auth.uid())
ALTER POLICY "Authenticated insert own interacoes" ON public.interacoes
  WITH CHECK (
    (criado_por = (SELECT auth.uid())) OR (criado_por IS NULL)
  );
