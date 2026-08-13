-- Memória do que a SECRETÁRIA enviou.
--
-- Sem esta tabela o projeto não funciona. A mensagem que a agente envia volta pelo
-- webhook da Evolution como `fromMe: true` — indistinguível da mensagem de qualquer um
-- dos quatro humanos que dividem a conta da Mont (Gilmar, Luccas, mãe e esposa).
--
-- Sem distinguir: ou ela lê a própria fala como "um humano assumiu" e se cala para
-- sempre na primeira resposta que dá, ou ignora todo `fromMe` e fica cega para a equipe,
-- falando por cima de gente atendendo cliente de verdade.
--
-- A Evolution devolve o `message_id` no envio; é ele que guardamos aqui.

CREATE TABLE IF NOT EXISTS public.wa_envios (
  message_id  text PRIMARY KEY,
  telefone_wa text NOT NULL,
  contato_id  uuid REFERENCES public.contatos(id) ON DELETE SET NULL,
  texto       text,
  enviado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wa_envios IS
  'Ids das mensagens enviadas pela secretaria de IA. Permite distinguir a voz dela da dos humanos que dividem a conta.';

CREATE INDEX IF NOT EXISTS idx_wa_envios_telefone ON public.wa_envios (telefone_wa, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_wa_envios_contato  ON public.wa_envios (contato_id);

-- Escrita: só service_role (a Edge Function). Leitura: admin, para auditoria — dá para
-- perguntar "o que a IA falou com esse cliente?" sem abrir o banco.
ALTER TABLE public.wa_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ler wa_envios" ON public.wa_envios;
CREATE POLICY "Admins podem ler wa_envios"
  ON public.wa_envios FOR SELECT TO authenticated USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
