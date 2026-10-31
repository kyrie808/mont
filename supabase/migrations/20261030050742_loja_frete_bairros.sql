-- ============================================================
-- Loja (apps/loja) · Fase 1 · migration 4/4: frete por bairro/cidade
--
-- Decisão P7: frete por TAXA FIXA por bairro ou cidade (como a Mont cobra
-- hoje). O cálculo por distância do catálogo não entra na loja.
-- Bairro fora da tabela → a loja manda falar no WhatsApp e não fecha pedido.
--
--   • bairro NULL = a taxa vale para a cidade inteira;
--   • dias_rota = dias da semana com entrega (0 = domingo … 6 = sábado);
--     NULL = sem restrição de dia. A regra de prazo está PENDENTE (Gilmar);
--   • cidade_norm/bairro_norm = sem acento e em minúsculas, para casar com o
--     bairro que o ViaCEP devolve.
--
-- Esquema apenas: a lista de bairros e valores está PENDENTE (Gilmar).
-- ============================================================

CREATE TABLE public.loja_frete_bairros (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cidade        text NOT NULL,
    uf            text NOT NULL DEFAULT 'SP',
    bairro        text,
    valor         numeric(10,2) NOT NULL,
    dias_rota     smallint[],
    ativo         boolean NOT NULL DEFAULT true,
    cidade_norm   text GENERATED ALWAYS AS (lower(regexp_replace(normalize(cidade, NFD), '[̀-ͯ]', '', 'g'))) STORED,
    bairro_norm   text GENERATED ALWAYS AS (lower(regexp_replace(normalize(coalesce(bairro, ''), NFD), '[̀-ͯ]', '', 'g'))) STORED,
    criado_em     timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT loja_frete_bairros_uf_check        CHECK (uf ~ '^[A-Z]{2}$'),
    CONSTRAINT loja_frete_bairros_valor_check     CHECK (valor >= 0),
    CONSTRAINT loja_frete_bairros_dias_rota_check CHECK (dias_rota IS NULL OR dias_rota <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[])
);

COMMENT ON TABLE  public.loja_frete_bairros IS 'Frete da loja: taxa fixa por bairro (ou pela cidade inteira quando bairro é NULL).';
COMMENT ON COLUMN public.loja_frete_bairros.bairro    IS 'NULL = taxa da cidade inteira.';
COMMENT ON COLUMN public.loja_frete_bairros.dias_rota IS 'Dias da semana com entrega (0 = domingo … 6 = sábado). NULL = sem restrição.';

CREATE UNIQUE INDEX loja_frete_bairros_local_key ON public.loja_frete_bairros (uf, cidade_norm, bairro_norm);

CREATE TRIGGER trigger_loja_frete_bairros_atualizado_em
    BEFORE UPDATE ON public.loja_frete_bairros
    FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

ALTER TABLE public.loja_frete_bairros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública dos bairros ativos" ON public.loja_frete_bairros
    FOR SELECT TO anon USING (ativo);
CREATE POLICY "Admin gerencia os bairros" ON public.loja_frete_bairros
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

REVOKE INSERT, UPDATE, DELETE ON public.loja_frete_bairros FROM anon;

NOTIFY pgrst, 'reload schema';
