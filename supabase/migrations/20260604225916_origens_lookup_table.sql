BEGIN;

-- 1. Tabela de lookup para origem de contatos
CREATE TABLE public.origens (
  slug   text    PRIMARY KEY,
  label  text    NOT NULL,
  ativo  boolean NOT NULL DEFAULT true,
  ordem  int     NOT NULL DEFAULT 0
);

-- 2. Seed — 3 existentes (slugs idênticos aos dados em contatos) + 4 novos canais
INSERT INTO public.origens (slug, label, ativo, ordem) VALUES
  ('direto',    'Direto',                 true, 1),
  ('indicacao', 'Indicação',              true, 2),
  ('catalogo',  'Catálogo',               true, 3),
  ('instagram', 'Instagram',              true, 4),
  ('facebook',  'Facebook / Marketplace', true, 5),
  ('ifood',     'iFood',                  true, 6),
  ('anuncio',   'Anúncio',                true, 7);

-- 3. Troca de constraint: CHECK → FK com CASCADE em update
ALTER TABLE public.contatos
  DROP CONSTRAINT contatos_origem_check;

ALTER TABLE public.contatos
  ADD CONSTRAINT contatos_origem_fkey
    FOREIGN KEY (origem)
    REFERENCES public.origens(slug)
    ON UPDATE CASCADE;

-- 4. RLS — convenção do projeto: SELECT para authenticated, escrita só admin
ALTER TABLE public.origens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read access"
  ON public.origens
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin full access"
  ON public.origens
  FOR ALL
  TO authenticated
  USING  ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

COMMIT;
