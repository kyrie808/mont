-- ============================================================
-- Loja (apps/loja) · Fase 1 · migration 3/4: campanha e preços
--
-- Preço de campanha com período, sem tocar em produtos.preco (que continua
-- sendo o preço normal, inclusive o do fiado no Jarvis).
--
-- Cartão (decisões P3): o total no cartão é a SOMA do preço de crédito 1x de
-- cada item, valor guardado da tabela aprovada, nunca calculado por fórmula.
-- Débito e crédito 2x ficam guardados para o Jarvis, mas a loja não os usa.
--
-- ancora = valor do "separado: a partir de" dos combos. Nos avulsos o "de"
-- exibido é produtos.preco; ancora fica NULL.
--
-- Horários com fuso: inicio/fim são timestamptz (gravar com -03:00).
-- ============================================================

CREATE TABLE public.loja_campanhas (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      text NOT NULL,
    inicio    timestamptz NOT NULL,
    fim       timestamptz NOT NULL,
    ativa     boolean NOT NULL DEFAULT true,
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT loja_campanhas_periodo_check CHECK (fim > inicio)
);

COMMENT ON TABLE public.loja_campanhas IS 'Campanhas de preço da loja (ex.: Black da Mont 2026). Vale a campanha ativa cujo período contém o instante atual.';

CREATE TABLE public.loja_precos (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id      uuid NOT NULL REFERENCES public.loja_campanhas(id) ON DELETE CASCADE,
    produto_id       uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    preco_pix        numeric(10,2) NOT NULL,
    preco_credito_1x numeric(10,2) NOT NULL,
    preco_debito     numeric(10,2),
    preco_credito_2x numeric(10,2),
    ancora           numeric(10,2),
    criado_em        timestamptz NOT NULL DEFAULT now(),
    atualizado_em    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT loja_precos_campanha_produto_key UNIQUE (campanha_id, produto_id),
    CONSTRAINT loja_precos_pix_check        CHECK (preco_pix > 0),
    CONSTRAINT loja_precos_credito_1x_check CHECK (preco_credito_1x >= preco_pix),
    CONSTRAINT loja_precos_debito_check     CHECK (preco_debito IS NULL OR preco_debito >= preco_pix),
    CONSTRAINT loja_precos_credito_2x_check CHECK (preco_credito_2x IS NULL OR preco_credito_2x >= preco_credito_1x),
    CONSTRAINT loja_precos_ancora_check     CHECK (ancora IS NULL OR ancora > 0)
);

COMMENT ON TABLE  public.loja_precos IS 'Preço de cada produto/combo dentro de uma campanha da loja. Valores em reais.';
COMMENT ON COLUMN public.loja_precos.preco_pix        IS 'Preço à vista no Pix (o "por").';
COMMENT ON COLUMN public.loja_precos.preco_credito_1x IS 'Preço no crédito 1x, da tabela aprovada (taxa da maquininha somada). Total no cartão = soma destes valores; frete sem taxa.';
COMMENT ON COLUMN public.loja_precos.preco_debito     IS 'Tabela de débito, guardada para o Jarvis. A loja não usa.';
COMMENT ON COLUMN public.loja_precos.preco_credito_2x IS 'Tabela de crédito 2x, guardada para o Jarvis. A loja não usa.';
COMMENT ON COLUMN public.loja_precos.ancora           IS 'Combos: valor do "separado: a partir de". NULL = não exibir.';

CREATE INDEX loja_precos_produto_id_idx ON public.loja_precos (produto_id);

CREATE TRIGGER trigger_loja_precos_atualizado_em
    BEFORE UPDATE ON public.loja_precos
    FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

ALTER TABLE public.loja_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_precos    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública das campanhas ativas" ON public.loja_campanhas
    FOR SELECT TO anon USING (ativa);
CREATE POLICY "Admin gerencia as campanhas" ON public.loja_campanhas
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Leitura pública dos preços de campanhas ativas" ON public.loja_precos
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM public.loja_campanhas c WHERE c.id = campanha_id AND c.ativa));
CREATE POLICY "Admin gerencia os preços" ON public.loja_precos
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

REVOKE INSERT, UPDATE, DELETE ON public.loja_campanhas, public.loja_precos FROM anon;

NOTIFY pgrst, 'reload schema';
