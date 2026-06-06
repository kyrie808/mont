-- Adiciona a conta-teste (teste@teste.com) ao admin_users.
--
-- Conta interna EXCLUSIVA da suíte de testes (nenhum humano insere dado real por ela).
-- Necessária para que o guard is_admin() passe nos RPCs SECURITY DEFINER durante os testes,
-- e para que o cleanup por created_by (auth.uid() da conta-teste) funcione com RLS ativo.
--
-- ⚠️ Exceção de segurança deliberada e autorizada (Luccas, 06/06/2026): o gate da área do
-- cliente proíbe inserir CLIENTES em admin_users — isto NÃO é um cliente, é conta de QA.
--
-- Idempotente (não depende de constraint única em user_id).
insert into public.admin_users (user_id, role)
select u.id, 'admin'
from auth.users u
where u.email = 'teste@teste.com'
  and not exists (
    select 1 from public.admin_users a where a.user_id = u.id
  );
