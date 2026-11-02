-- Rollback de 20261031062241_conferencia_horaria. Antes: desativar o W7 no n8n e voltar o
-- whatsapp-analista para a versão sem extração (senão ele tenta gravar em pedidos_conversa).
BEGIN;
DROP TABLE public.alertas_operacao;
DROP TABLE public.pedidos_conversa;
NOTIFY pgrst, 'reload schema';
COMMIT;
