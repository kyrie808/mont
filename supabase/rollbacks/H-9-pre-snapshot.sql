-- DDL snapshot PRE H-9 (P2-DB05)
-- Capturado em: 2026-05-22
-- Propósito: rollback caso H-9 introduza regressão
-- Para reverter: executar este SQL via supabase/migrations ou MCP execute_sql

-- ============================================================
-- 1. admin_users — "Admin full access on admin_users"
-- Estado ANTES de H-9: auth.uid() cru no qual
-- ============================================================
ALTER POLICY "Admin full access on admin_users" ON public.admin_users
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users a
      WHERE a.user_id = auth.uid()
        AND a.role = ANY (ARRAY['admin'::text, 'super_admin'::text])
    )
  );

-- ============================================================
-- 2. interacoes — "Authenticated insert own interacoes"
-- Estado ANTES de H-9: auth.uid() cru no with_check
-- ============================================================
ALTER POLICY "Authenticated insert own interacoes" ON public.interacoes
  WITH CHECK (
    (criado_por = auth.uid()) OR (criado_por IS NULL)
  );
