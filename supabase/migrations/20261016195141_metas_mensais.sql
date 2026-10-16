-- Metas fixas de faturamento por mês (decisão de 13/10/2026).
--
-- Substitui a "meta pela média" (fb0e8f6) no card Faturamento: a média cai junto com os
-- meses fracos e nunca mostra a queda de verdade. Aqui a meta é um número fixo por mês,
-- com dois degraus — mínima (não pode ficar abaixo) e alvo (onde queremos chegar).
-- A média continua no painel, só como referência.
--
-- Valores em REAIS (numeric), como todo o resto do banco.

CREATE TABLE public.metas_mensais (
  mes                date PRIMARY KEY,
  meta_minima        numeric NOT NULL,
  meta_alvo          numeric NOT NULL,
  -- Teto opcional pro A Receber (fiado em aberto, todos os meses). NULL = sem limite.
  meta_a_receber_max numeric NULL,
  observacao         text,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_mensais_mes_dia_1 CHECK (EXTRACT(day FROM mes) = 1),
  CONSTRAINT metas_mensais_minima_positiva CHECK (meta_minima > 0),
  CONSTRAINT metas_mensais_alvo_gte_minima CHECK (meta_alvo >= meta_minima),
  CONSTRAINT metas_mensais_a_receber_max_nao_negativo CHECK (meta_a_receber_max IS NULL OR meta_a_receber_max >= 0)
);

COMMENT ON TABLE public.metas_mensais IS
  'Meta de faturamento (produto, sem frete — mesma régua da view_home_financeiro) por mês. mes = dia 1.';

CREATE OR REPLACE FUNCTION public.fn_metas_mensais_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_metas_mensais_atualizado_em
  BEFORE UPDATE ON public.metas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.fn_metas_mensais_atualizado_em();

-- Meta é número de gestão: só admin lê e escreve. Há usuários autenticados que não são
-- admin (entregador), e o Dashboard já é só de admin.
ALTER TABLE public.metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY metas_mensais_select_admin ON public.metas_mensais
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY metas_mensais_insert_admin ON public.metas_mensais
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY metas_mensais_update_admin ON public.metas_mensais
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY metas_mensais_delete_admin ON public.metas_mensais
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- Default privilege do Supabase dá tudo a anon na criação; anon nunca toca nisto.
REVOKE ALL ON public.metas_mensais FROM anon;

-- Seed: outubro/2026. Mínima = voltar à média dos meses fechados (mai–set: R$ 9.331,86);
-- alvo = voltar ao nível de junho (R$ 11.229,40).
INSERT INTO public.metas_mensais (mes, meta_minima, meta_alvo, meta_a_receber_max, observacao)
VALUES ('2026-10-01', 9300, 11200, NULL, 'Mínima = média mai–set; alvo = nível de junho (decisão 13/10/2026)');

-- Sugestão de metas para p_mes, olhando o mês ANTERIOR. Só calcula, não grava nada.
--   bateu o alvo      → mínima = alvo anterior, alvo = alvo anterior × 1,12
--   bateu só a mínima → repete
--   não bateu         → repete
-- A meta nunca cai (greatest). Sem meta no mês anterior → nenhuma linha.
-- O faturado vem da própria view_home_financeiro — a mesma régua do card Faturamento.
-- Se o mês anterior ainda está em curso (Dashboard mostra nos últimos 5 dias), usa o
-- faturado até agora.
CREATE OR REPLACE FUNCTION public.sugerir_metas(p_mes date)
RETURNS TABLE (
  meta_minima numeric,
  meta_alvo numeric,
  faturado_mes_anterior numeric,
  bateu_alvo boolean,
  bateu_minima boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH ant AS (
    SELECT m.meta_minima, m.meta_alvo,
           COALESCE((
             SELECT f.faturamento
             FROM public.view_home_financeiro f
             WHERE f.ano = EXTRACT(year FROM m.mes)::int
               AND f.mes = EXTRACT(month FROM m.mes)::int
           ), 0) AS faturado
    FROM public.metas_mensais m
    WHERE m.mes = (date_trunc('month', p_mes) - interval '1 month')::date
  )
  SELECT
    CASE WHEN ant.faturado >= ant.meta_alvo
         THEN greatest(ant.meta_alvo, ant.meta_minima) ELSE ant.meta_minima END,
    CASE WHEN ant.faturado >= ant.meta_alvo
         THEN greatest(round(ant.meta_alvo * 1.12, 2), ant.meta_alvo) ELSE ant.meta_alvo END,
    ant.faturado,
    ant.faturado >= ant.meta_alvo,
    ant.faturado >= ant.meta_minima
  FROM ant;
$$;

REVOKE EXECUTE ON FUNCTION public.sugerir_metas(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sugerir_metas(date) TO authenticated;

NOTIFY pgrst, 'reload schema';
