-- Fecha a superfície que o `CREATE FUNCTION` da migration anterior abriu sem pedir.
--
-- O Supabase mantém um ALTER DEFAULT PRIVILEGES que concede EXECUTE a `anon` em
-- toda função nova do schema `public`. Como `criar_venda` teve de ser recriada
-- (DROP + CREATE, para ganhar `p_status` sem virar uma segunda versão da RPC),
-- ela nasceu com `anon=X` — grant que a versão anterior NÃO tinha.
--
-- O `is_admin()` dentro da função já barraria o anônimo, então não havia brecha
-- explorável; mas função SECURITY DEFINER não fica exposta a quem não precisa.
-- ACL alvo (idêntica à de antes): postgres, authenticated, service_role.
--
-- Footgun recorrente: SEMPRE conferir `proacl` depois de recriar SECURITY DEFINER.

REVOKE ALL ON FUNCTION public.criar_venda(
    uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text
) FROM anon;
