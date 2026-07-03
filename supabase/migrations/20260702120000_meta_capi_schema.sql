-- Meta CAPI (Conversions API) — eventos offline: schema
-- Blueprint: blueprint-eventos-offline-capi-mont.md §3.1 e §3.2
-- Escopo v1: Purchase por match de telefone/hash.
-- As colunas de captura CTWA (ctwa_clid/ad_referral/ctwa_clid_em) são criadas
-- AGORA mas ainda SEM USO — não há gateway (Evolution/whatsapp-k) neste monorepo
-- para carimbá-las. Ficam prontas para o trilho de coexistence/Cloud API (fora de escopo).

-- ── 3.1 Captura do clique de anúncio (Click-to-WhatsApp) em contatos ──────────
ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS ctwa_clid    text,        -- click id do CTWA (referral), enviado CRU à Meta
  ADD COLUMN IF NOT EXISTS ad_referral  jsonb,       -- objeto referral cru (source_id/ad id, source_url, headline)
  ADD COLUMN IF NOT EXISTS ctwa_clid_em timestamptz; -- quando o clique foi capturado

-- ── 3.2 Outbox de eventos — meta_eventos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento        text NOT NULL CHECK (evento IN ('Lead','Purchase')),
  event_id      text NOT NULL UNIQUE,                -- dedup: 'venda_<uuid>' | 'lead_<uuid>' (idempotência forçada no banco)
  contato_id    uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  venda_id      uuid REFERENCES public.vendas(id) ON DELETE CASCADE,
  event_time    timestamptz NOT NULL,
  valor         numeric,
  moeda         text NOT NULL DEFAULT 'BRL',
  ctwa_clid     text,                                -- snapshot no momento do enfileiramento
  action_source text NOT NULL,                       -- 'business_messaging' se veio de anúncio; senão 'physical_store'
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','erro')),
  tentativas    int  NOT NULL DEFAULT 0,
  resposta_meta jsonb,                               -- fbtrace_id, events_received, erros
  criado_em     timestamptz NOT NULL DEFAULT now(),
  enviado_em    timestamptz
);

-- Nota sobre ON DELETE CASCADE: deleteVenda/cleanTestData apagam vendas e contatos.
-- Uma FK simples (sem ON DELETE) BLOQUEARIA esses deletes assim que um evento fosse
-- enfileirado (regressão). CASCADE mantém o delete funcionando e limpa o evento junto.
-- Mont raramente apaga venda/contato; o registro de auditoria do que foi enviado à Meta
-- fica em resposta_meta enquanto a venda existir. Aceitável para v1.

-- Índice parcial: o worker varre só os pendentes.
CREATE INDEX IF NOT EXISTS idx_meta_eventos_pendentes
  ON public.meta_eventos (status) WHERE status = 'pendente';

-- Cobertura de índice nas FKs (guardrail supabase-mont).
CREATE INDEX IF NOT EXISTS idx_meta_eventos_contato_id ON public.meta_eventos (contato_id);
CREATE INDEX IF NOT EXISTS idx_meta_eventos_venda_id   ON public.meta_eventos (venda_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Escrita: só service_role (o worker), que bypassa RLS — nenhuma policy de INSERT/UPDATE/DELETE.
-- Leitura: admins (observabilidade + testabilidade do trigger via harness de integração,
--   que loga como a conta-teste admin). is_admin() consulta public.admin_users, então
--   cliente/anon nunca lê. Isso NÃO afrouxa a escrita — só permite auditoria read-only.
ALTER TABLE public.meta_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler meta_eventos"
  ON public.meta_eventos
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
