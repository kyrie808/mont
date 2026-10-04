-- `atualizado_em` tem que refletir ATIVIDADE, nao criacao.
--
-- E ela que a acao `rascunhos_abandonados` usa para decidir "parado ha 30 minutos". Com a
-- coluna congelada no INSERT, um cliente montando o pedido agora num rascunho aberto ha 40
-- minutos seria avisado a equipe como abandonado no meio da conversa — e o indice
-- (status, atualizado_em DESC) ordenaria por data de criacao sem reclamar de nada.
--
-- Trigger em vez de confiar na aplicacao: a Edge Function seta a coluna em um dos
-- caminhos, mas confirmacao e reabertura tocam a linha sem setar, e caminho novo esquece.

CREATE OR REPLACE FUNCTION public.fn_wa_pedido_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_pedido_atualizado_em ON public.wa_pedido;
CREATE TRIGGER trg_wa_pedido_atualizado_em
  BEFORE UPDATE ON public.wa_pedido
  FOR EACH ROW EXECUTE FUNCTION public.fn_wa_pedido_atualizado_em();

-- Escrita nestas tabelas e SO da service_role (a Edge Function). A RLS ja nega, porque nao
-- ha policy de escrita, mas o default privilege do Supabase concede INSERT/UPDATE/DELETE a
-- anon e authenticated na criacao da tabela — e este projeto ja foi mordido por isso antes.
-- Revogar e defesa em profundidade: se algum dia alguem criar uma policy de escrita, vai
-- ter que revisar estas roles de proposito em vez de herdar acesso sem perceber.
REVOKE INSERT, UPDATE, DELETE ON public.wa_pedido FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wa_pedido_item FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
