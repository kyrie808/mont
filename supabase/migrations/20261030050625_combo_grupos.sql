-- ============================================================
-- Loja (apps/loja) · Fase 1 · migration 2/4: grupos de escolha dos combos
--
-- Combo = itens fixos (produto_componentes, já existente) + grupos de escolha.
-- Ex.: Combo Família = balde 4 kg ×1 + baldinho 1 kg ×2 (fixos)
--      + grupo "Escolha 6 doces de 680 g" (quantidade 6, pode repetir).
-- O pedido registra cada sabor escolhido como item (Fase 2).
--
-- rotulo_singular/rotulo_plural alimentam os textos da tela 03
-- ("Falta escolher 1 doce" / "Faltam 3 doces").
--
-- Esquema apenas: os grupos e as opções da Black estão PENDENTES (decisões P4).
-- ============================================================

CREATE TABLE public.combo_grupos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id        uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    titulo          text NOT NULL,
    rotulo_singular text NOT NULL,
    rotulo_plural   text NOT NULL,
    quantidade      integer NOT NULL CHECK (quantidade > 0),
    permite_repetir boolean NOT NULL DEFAULT true,
    ordem           integer NOT NULL DEFAULT 0,
    criado_em       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.combo_grupos IS 'Grupos de escolha de um combo (ex.: "Escolha 6 doces de 680 g"). Os itens fixos ficam em produto_componentes.';
COMMENT ON COLUMN public.combo_grupos.quantidade      IS 'Quantas unidades o cliente escolhe neste grupo (o botão só libera com N/N).';
COMMENT ON COLUMN public.combo_grupos.permite_repetir IS 'true = o mesmo sabor pode ser escolhido mais de uma vez.';

CREATE INDEX combo_grupos_combo_id_idx ON public.combo_grupos (combo_id);

CREATE TABLE public.combo_grupo_opcoes (
    grupo_id   uuid NOT NULL REFERENCES public.combo_grupos(id) ON DELETE CASCADE,
    produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    ordem      integer NOT NULL DEFAULT 0,
    PRIMARY KEY (grupo_id, produto_id)
);

COMMENT ON TABLE public.combo_grupo_opcoes IS 'Sabores (produtos reais) que podem ser escolhidos em cada grupo de combo.';

CREATE INDEX combo_grupo_opcoes_produto_id_idx ON public.combo_grupo_opcoes (produto_id);

ALTER TABLE public.combo_grupos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_grupo_opcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública dos grupos" ON public.combo_grupos
    FOR SELECT TO anon USING (true);
CREATE POLICY "Admin gerencia os grupos" ON public.combo_grupos
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Leitura pública das opções" ON public.combo_grupo_opcoes
    FOR SELECT TO anon USING (true);
CREATE POLICY "Admin gerencia as opções" ON public.combo_grupo_opcoes
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

REVOKE INSERT, UPDATE, DELETE ON public.combo_grupos, public.combo_grupo_opcoes FROM anon;

NOTIFY pgrst, 'reload schema';
