-- Mapa anúncio → campanha.
--
-- PROBLEMA: o objeto `referral` do Click-to-WhatsApp traz `source_id`, que é o id do
-- ANÚNCIO. `campanhas.meta_campaign_id` guarda o id da CAMPANHA, e o `meta-ads-sync`
-- só busca `/campaigns`. Sem tradução, o lead que vem do anúncio não tem como
-- preencher `contatos.campanha_id` — o ROAS por campanha continuaria cego mesmo
-- com o ctwa_clid capturado.
--
-- Esta tabela é o dicionário. Populada pelo `meta-ads-sync` (que passa a buscar
-- `/ads` também) e consultada pelo ingestor no momento em que o lead chega.

CREATE TABLE IF NOT EXISTS public.meta_anuncios (
  ad_id       text PRIMARY KEY,          -- = `source_id` do referral
  adset_id    text,
  campaign_id text NOT NULL,             -- casa com campanhas.meta_campaign_id
  nome        text,
  status      text,
  sync_em     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.meta_anuncios IS
  'Dicionário ad_id → campaign_id, populado pelo meta-ads-sync. Traduz o `source_id` do referral CTWA em campanha do Mont.';

CREATE INDEX IF NOT EXISTS idx_meta_anuncios_campaign_id
  ON public.meta_anuncios (campaign_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Escrita: só service_role (o sync), que bypassa RLS — nenhuma policy de escrita.
-- Leitura: admins, para observabilidade. Mesmo padrão de meta_eventos.
ALTER TABLE public.meta_anuncios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler meta_anuncios"
  ON public.meta_anuncios
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
