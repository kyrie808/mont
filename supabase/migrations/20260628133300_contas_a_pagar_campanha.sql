-- Vínculo opcional de despesa (contas_a_pagar) a uma campanha de marketing.
-- Aditivo / nullable / reversível — não afeta dados existentes.
-- Fundação para um futuro módulo de marketing (custo/ROI por campanha).

ALTER TABLE public.contas_a_pagar
  ADD COLUMN campanha_id uuid NULL REFERENCES public.campanhas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_campanha
  ON public.contas_a_pagar(campanha_id);

COMMENT ON COLUMN public.contas_a_pagar.campanha_id IS
  'Vínculo opcional a campanhas(id) — base p/ custo/ROI por campanha. Set null on delete.';
