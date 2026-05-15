-- Alinha RLS de `contas` com o padrão das tabelas financeiras irmãs.
--
-- Antes deste fix, `contas` tinha apenas a policy "Admin full access"
-- (USING is_admin()). As tabelas `lancamentos` e `pagamentos_venda` já
-- contam com "Authenticated read access" (USING true) FOR SELECT.
--
-- O esquecimento da policy em `contas` causava falha silenciosa do
-- PaymentSidebar (getContas() retornava [] sempre que is_admin() retornava
-- false — sessão expirada, JWT em refresh, ou usuário authenticated
-- não-admin). Visível após o fix de race condition (commit 50a494f).
--
-- Idempotência: DROP IF EXISTS antes do CREATE garante reaplicabilidade.

DROP POLICY IF EXISTS "Authenticated read access" ON public.contas;

CREATE POLICY "Authenticated read access"
ON public.contas
FOR SELECT
TO authenticated
USING (true);
