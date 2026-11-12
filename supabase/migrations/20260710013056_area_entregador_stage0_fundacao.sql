-- Área do Entregador — Stage 0: fundação de segurança (sem UI).
--
-- (1) Cria o conceito de "entregador" (o 1º segundo perfil de acesso), análogo a
--     admin_users; (2) associa entregas a entregadores; (3) FECHA o buraco onde
--     QUALQUER login autenticado lia todo o financeiro — remove as policies
--     "Authenticated read ..." USING(true). O admin segue lendo tudo pela policy
--     "Admin full access" (FOR ALL, USING is_admin()); o entregador (não-admin)
--     perde o SELECT direto e passa a ler só via RPCs SECURITY DEFINER (Stage 1).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela de entregadores + RLS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entregadores (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nome                text NOT NULL,
    ativo               boolean NOT NULL DEFAULT true,
    repasse_por_entrega numeric NOT NULL DEFAULT 5,
    criado_em           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;

-- Admin gerencia entregadores; o entregador só lê a própria linha.
CREATE POLICY "Admin full access entregadores" ON public.entregadores
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Entregador reads own row" ON public.entregadores
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. is_entregador() — espelha is_admin()
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_entregador(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.entregadores
        WHERE entregadores.user_id = is_entregador.check_user_id
          AND entregadores.ativo = true
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_entregador(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_entregador(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Associação entrega↔entregador + marcador de "dinheiro recebido pelo entregador"
--    (o pagamento em si vai pro Caixa; o marcador deixa a porta aberta pra um
--     extrato/conta-ponte no futuro sem redesenho)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vendas
    ADD COLUMN IF NOT EXISTS entregador_id uuid REFERENCES public.entregadores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recebido_por_entregador_id uuid REFERENCES public.entregadores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recebido_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_vendas_entregador_id
    ON public.vendas (entregador_id) WHERE entregador_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FECHAMENTO DO BURACO: remove as policies de leitura aberta (USING true).
--    Admin continua lendo via "Admin full access" (FOR ALL / is_admin()).
--    Redundantes pra admin; só serviam pra abrir leitura a não-admins.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated read access"            ON public.vendas;
DROP POLICY IF EXISTS "Authenticated read sale items"        ON public.itens_venda;
DROP POLICY IF EXISTS "Authenticated read access"            ON public.contatos;
DROP POLICY IF EXISTS "Authenticated read access"            ON public.lancamentos;
DROP POLICY IF EXISTS "Authenticated read payments"          ON public.pagamentos_venda;
DROP POLICY IF EXISTS "Authenticated read access"            ON public.contas;
DROP POLICY IF EXISTS "Authenticated read access on settings" ON public.configuracoes;
DROP POLICY IF EXISTS "Authenticated read chart of accounts" ON public.plano_de_contas;
