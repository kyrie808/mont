-- Meta CAPI (Conversions API) — eventos offline: schema
-- Blueprint: blueprint-eventos-offline-capi-mont.md §3.1 e §3.2
-- Escopo v1: Purchase por match de telefone/hash.
-- As colunas de captura CTWA (ctwa_clid/ad_referral/ctwa_clid_em) são criadas
-- AGORA mas ainda SEM USO — não há gateway (Evolution/whatsapp-k) neste monorepo
-- para carimbá-las. Ficam prontas para o trilho de coexistence/Cloud API (fora de escopo).

-- Meta CAPI (Conversions API) — eventos offline: schema
-- Blueprint §3.1 e §3.2. Escopo v1: Purchase por match de telefone/hash.

-- 3.1 Captura do clique de anúncio (Click-to-WhatsApp) em contatos (criadas sem uso ainda)
ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS ctwa_clid    text,
  ADD COLUMN IF NOT EXISTS ad_referral  jsonb,
  ADD COLUMN IF NOT EXISTS ctwa_clid_em timestamptz;

-- 3.2 Outbox de eventos — meta_eventos
CREATE TABLE IF NOT EXISTS public.meta_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento        text NOT NULL CHECK (evento IN ('Lead','Purchase')),
  event_id      text NOT NULL UNIQUE,
  contato_id    uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  venda_id      uuid REFERENCES public.vendas(id) ON DELETE CASCADE,
  event_time    timestamptz NOT NULL,
  valor         numeric,
  moeda         text NOT NULL DEFAULT 'BRL',
  ctwa_clid     text,
  action_source text NOT NULL,
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','erro')),
  tentativas    int  NOT NULL DEFAULT 0,
  resposta_meta jsonb,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  enviado_em    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_meta_eventos_pendentes
  ON public.meta_eventos (status) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_meta_eventos_contato_id ON public.meta_eventos (contato_id);
CREATE INDEX IF NOT EXISTS idx_meta_eventos_venda_id   ON public.meta_eventos (venda_id);

-- RLS: escrita só service_role (sem policy de write); leitura só admin (observabilidade + teste).
ALTER TABLE public.meta_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ler meta_eventos" ON public.meta_eventos;
CREATE POLICY "Admins podem ler meta_eventos"
  ON public.meta_eventos
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
