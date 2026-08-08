-- Log cru de mensagens do WhatsApp — a memória de tudo que passa pelo aparelho.
--
-- Reprocessar é grátis; recuperar o que não foi salvo é impossível. Se o prompt do
-- analista melhorar daqui a 3 meses, dá pra reanalisar o histórico inteiro — mas só
-- se ele existir. Por isso o ingestor grava AQUI antes de qualquer processamento.
--
-- `payload` guarda o webhook inteiro, não só os campos que hoje sabemos ler. É o que
-- sustenta o portão 1A: a atribuição de anúncio (`ctwaClid`, `showAdAttribution`,
-- `conversionSource`, `externalAdReply`) existe SÓ no webhook ao vivo — o endpoint
-- /chat/findMessages da Evolution não devolve esses campos (issue #975). Se a gente
-- parsear errado e jogar fora, não tem segunda chance.

CREATE TABLE IF NOT EXISTS public.mensagens_whatsapp (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nulo até casar (ou se o contato for apagado depois). SET NULL em vez de CASCADE:
  -- apagar o contato não pode apagar a evidência crua, e também não pode BLOQUEAR o
  -- delete — a ordem de deleção do projeto já é delicada.
  contato_id    uuid REFERENCES public.contatos(id) ON DELETE SET NULL,

  telefone_wa   text NOT NULL,           -- forma canônica; recasa mesmo se contato_id for null
  message_id    text NOT NULL UNIQUE,    -- id da Evolution: idempotência do webhook
  direcao       text NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  conteudo      text,                    -- texto extraído; null em mídia sem legenda
  tipo_midia    text NOT NULL DEFAULT 'texto'
                CHECK (tipo_midia IN ('texto','audio','imagem','video','documento','sticker','localizacao','contato','outro')),
  referral      jsonb,                   -- atribuição do anúncio, quando houver
  payload       jsonb NOT NULL,          -- webhook cru e completo
  enviada_em    timestamptz NOT NULL,    -- hora do WhatsApp, não do insert
  processado_em timestamptz,             -- null = pendente de análise pelo W2
  criado_em     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mensagens_whatsapp IS
  'Log cru de mensagens do WhatsApp (via Evolution API). Escrita só pelo ingestor com service_role. Fonte para o analista W2 e para a captura do ctwa_clid.';
COMMENT ON COLUMN public.mensagens_whatsapp.payload IS
  'Webhook MESSAGES_UPSERT completo. Guardado inteiro de propósito: a atribuição de anúncio só existe aqui.';

CREATE INDEX IF NOT EXISTS idx_msg_wa_contato       ON public.mensagens_whatsapp (contato_id, enviada_em DESC);
CREATE INDEX IF NOT EXISTS idx_msg_wa_telefone      ON public.mensagens_whatsapp (telefone_wa, enviada_em DESC);
-- O W2 varre só o que falta processar.
CREATE INDEX IF NOT EXISTS idx_msg_wa_pendentes     ON public.mensagens_whatsapp (enviada_em) WHERE processado_em IS NULL;
-- Achar clique de anúncio é a consulta mais importante do portão 1A.
CREATE INDEX IF NOT EXISTS idx_msg_wa_com_referral  ON public.mensagens_whatsapp (criado_em DESC) WHERE referral IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Conteúdo de conversa de cliente é o dado mais sensível do sistema.
-- Escrita: só service_role (ingestor), que bypassa RLS — nenhuma policy de escrita.
-- Leitura: só admin. Nunca anon, nunca cliente.
ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler mensagens_whatsapp"
  ON public.mensagens_whatsapp
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
