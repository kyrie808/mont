-- ============================================================
-- Loja (apps/loja) · Fase 1 · migration 1/4: vitrine
--
-- O que aparece na loja, em que seção e em que ordem, e se está à venda.
-- Separado de produtos.visivel_catalogo de propósito: o catálogo segue igual.
--
-- Disponibilidade (decisões da Fase 0, P5):
--   • disponivel = chave manual "Esgotado" (operada pelo Luccas na Black);
--   • usa_estoque = true nos doces: além da chave, exige estoque − reservado > 0.
--     Massa usa só a chave (o estoque dela não é confiável).
--
-- Sem RPC de escrita: o Jarvis/Luccas administra pela policy de admin.
-- ============================================================

CREATE TABLE public.loja_vitrine (
    produto_id    uuid PRIMARY KEY REFERENCES public.produtos(id) ON DELETE CASCADE,
    secao         text NOT NULL CHECK (secao IN ('combos', 'massa', 'doces', 'zero')),
    ordem         integer NOT NULL DEFAULT 0,
    visivel       boolean NOT NULL DEFAULT false,
    disponivel    boolean NOT NULL DEFAULT true,
    usa_estoque   boolean NOT NULL DEFAULT false,
    destaque_hero boolean NOT NULL DEFAULT false,
    leva_junto    boolean NOT NULL DEFAULT false,
    nome_loja     text,
    resumo        text,
    criado_em     timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.loja_vitrine IS 'Vitrine da loja (apps/loja): seção, ordem e disponibilidade por produto. Independente de produtos.visivel_catalogo.';
COMMENT ON COLUMN public.loja_vitrine.disponivel    IS 'Chave manual: false = aparece como Esgotado.';
COMMENT ON COLUMN public.loja_vitrine.usa_estoque   IS 'true = também exige estoque_atual − reservado > 0 (doces). Massa: false.';
COMMENT ON COLUMN public.loja_vitrine.destaque_hero IS 'Produto do banner do topo. No máximo um.';
COMMENT ON COLUMN public.loja_vitrine.leva_junto    IS 'Oferta "Leva junto?" da sacola. No máximo um.';
COMMENT ON COLUMN public.loja_vitrine.nome_loja     IS 'Nome exibido na loja quando difere do nome interno (ex.: sem o sufixo "(Black)"). NULL = produtos.nome.';
COMMENT ON COLUMN public.loja_vitrine.resumo        IS 'Linha de composição do card de combo (ex.: "Balde 4 kg + 2 baldinhos 1 kg + 6 doces 680 g à escolha").';

CREATE UNIQUE INDEX loja_vitrine_um_hero       ON public.loja_vitrine ((true)) WHERE destaque_hero;
CREATE UNIQUE INDEX loja_vitrine_um_leva_junto ON public.loja_vitrine ((true)) WHERE leva_junto;

CREATE TRIGGER trigger_loja_vitrine_atualizado_em
    BEFORE UPDATE ON public.loja_vitrine
    FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

ALTER TABLE public.loja_vitrine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública da vitrine" ON public.loja_vitrine
    FOR SELECT TO anon USING (visivel);

CREATE POLICY "Admin gerencia a vitrine" ON public.loja_vitrine
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- anon só lê (ver 20261029211837_catalogo_fecha_escrita_publica).
REVOKE INSERT, UPDATE, DELETE ON public.loja_vitrine FROM anon;

NOTIFY pgrst, 'reload schema';
