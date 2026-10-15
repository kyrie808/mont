-- Rodada 2, item B (Luccas, 15/10/2026): envio da secretária que falha não pode sumir.
--
-- O W3 manda a resposta para o TELEFONE do cliente. Contato que o WhatsApp só conhece pelo
-- LID (ex.: 5511934417085 → exists:false; 136335482433638@lid → exists:true) recusava o
-- envio, e o nó "Enviar parte" (onError: continue) engolia o erro: o cliente ficava sem
-- resposta e ninguém sabia. Agora toda falha vira uma linha aqui; o W3 tenta de novo pelo
-- LID do wa_lid_map e registra o resultado; se nem o LID resolver, avisa a equipe.
--
-- Escrita só pela Edge Function whatsapp-secretaria (service_role). O app lê (admin).

CREATE TABLE IF NOT EXISTS public.wa_envio_falhas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em         timestamptz NOT NULL DEFAULT now(),
  telefone_wa       text NOT NULL,
  contato_id        uuid REFERENCES public.contatos(id) ON DELETE SET NULL,
  -- O que foi tentado e o que a Evolution respondeu (cortado em 500 caracteres).
  numero_tentado    text NOT NULL,
  erro              text,
  -- Segunda tentativa: o LID do wa_lid_map. NULL = não havia LID para tentar.
  lid               text,
  resolvido_por_lid boolean,
  message_id_lid    text,
  erro_lid          text,
  resolvido_em      timestamptz
);

COMMENT ON TABLE public.wa_envio_falhas IS
  'Envios da secretária (W3) que a Evolution recusou. resolvido_por_lid = a 2ª tentativa, pelo LID do wa_lid_map, entregou. NULL em lid = não havia LID; aí a equipe é avisada.';

CREATE INDEX IF NOT EXISTS idx_wa_envio_falhas_criado ON public.wa_envio_falhas (criado_em DESC);

ALTER TABLE public.wa_envio_falhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler wa_envio_falhas"
  ON public.wa_envio_falhas FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.wa_envio_falhas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.wa_envio_falhas FROM authenticated;

NOTIFY pgrst, 'reload schema';
