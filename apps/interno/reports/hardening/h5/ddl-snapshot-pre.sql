-- H-5 DDL Snapshot Pré-Apply — policy "Authenticated update access" em contatos
-- Capturado via pg_policies em 2026-05-22T09:06:58
-- Usado como rollback artifact se migration precisar ser revertida

-- Estado atual (vulnerável):
ALTER POLICY "Authenticated update access" ON public.contatos
  USING (true)
  WITH CHECK (true);

-- Equivalente pg_policies:
-- policyname: Authenticated update access
-- cmd:        UPDATE
-- roles:      {authenticated}
-- qual:       true
-- with_check: true
