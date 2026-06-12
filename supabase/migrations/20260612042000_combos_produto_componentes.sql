BEGIN;

-- Kits/Combos: produto composto com composição real.
-- Fronteira arquitetural: interno = fonte da verdade; catálogo só LÊ.
-- Por isso a RLS espelha public.produtos (leitura pública p/ o catálogo anon; escrita só admin).

-- 1. Flag de combo na tabela produtos
ALTER TABLE public.produtos
  ADD COLUMN eh_combo boolean NOT NULL DEFAULT false;

-- 2. Composição do combo (combo -> componentes + quantidade)
CREATE TABLE public.produto_componentes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id      uuid        NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  componente_id uuid        NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade    numeric     NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produto_componentes_unico    UNIQUE (combo_id, componente_id),
  CONSTRAINT produto_componentes_nao_auto CHECK  (combo_id <> componente_id)
);

CREATE INDEX idx_produto_componentes_combo      ON public.produto_componentes(combo_id);
CREATE INDEX idx_produto_componentes_componente ON public.produto_componentes(componente_id);

-- 3. RLS — espelha produtos: leitura pública (catálogo anon), escrita só admin
ALTER TABLE public.produto_componentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON public.produto_componentes
  FOR SELECT
  USING (true);

CREATE POLICY "Admin full access"
  ON public.produto_componentes
  FOR ALL
  TO authenticated
  USING  ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

COMMIT;
