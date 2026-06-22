-- Aquisição do cliente: quando contatos.origem = 'anuncio', registrar fonte
-- (plataforma) e campanha. Aditiva/reversível. Colunas nullable (só preenchidas
-- para origem = 'anuncio'). Backup: dump-{schema,data}-20260622-014043.sql

-- ── Lookup de fontes (plataformas de anúncio) — espelha o shape de `origens` ──
CREATE TABLE IF NOT EXISTS public.fontes (
  slug  text PRIMARY KEY,
  label text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0
);

INSERT INTO public.fontes (slug, label, ordem) VALUES
  ('meta_ads',   'Meta Ads (Facebook/Instagram)', 1),
  ('google_ads', 'Google Ads',                    2),
  ('tiktok_ads', 'TikTok Ads',                    3)
ON CONFLICT (slug) DO NOTHING;

-- ── Campanhas (cadastráveis inline pelo formulário do cliente) ──
CREATE TABLE IF NOT EXISTS public.campanhas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL UNIQUE,
  ativo     boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- ── Colunas de aquisição no contato (nullable; FK + índice de cobertura) ──
ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS fonte       text REFERENCES public.fontes(slug),
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES public.campanhas(id);

CREATE INDEX IF NOT EXISTS idx_contatos_fonte       ON public.contatos(fonte);
CREATE INDEX IF NOT EXISTS idx_contatos_campanha_id ON public.contatos(campanha_id);

-- ── RLS — uma policy por ação (evita multiple_permissive_policies) ──
ALTER TABLE public.fontes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

-- fontes: leitura para authenticated; escrita só admin.
CREATE POLICY "fontes_select"       ON public.fontes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fontes_insert_admin" ON public.fontes FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "fontes_update_admin" ON public.fontes FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "fontes_delete_admin" ON public.fontes FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- campanhas: leitura para authenticated; escrita só admin (inclui INSERT inline do form).
CREATE POLICY "campanhas_select"       ON public.campanhas FOR SELECT TO authenticated USING (true);
CREATE POLICY "campanhas_insert_admin" ON public.campanhas FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "campanhas_update_admin" ON public.campanhas FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "campanhas_delete_admin" ON public.campanhas FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

NOTIFY pgrst, 'reload schema';
