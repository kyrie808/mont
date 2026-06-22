-- Estágio 3 (parte 1/2): infra pro split de frete no fluxo de caixa.
-- Aditiva/reversível. Backup: dump-{schema,data}-20260622-025133.sql

-- Plano de contas próprio pro frete (receita pura, 100% margem).
-- Espelha RECEBIMENTO_VENDA: categoria 'variavel', automatica=true (protegido
-- contra deleção pelo trigger prevent_delete_automatic_plan).
INSERT INTO public.plano_de_contas (codigo, nome, tipo, categoria, automatica)
VALUES ('RECEBIMENTO_FRETE', 'Recebimento de Frete', 'receita', 'variavel', true)
ON CONFLICT (codigo) DO NOTHING;

-- Link explícito lançamento → pagamento (substitui o frágil match-por-valor do
-- deleteUltimoPagamento; permite deletar produto+frete de um pagamento juntos).
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS pagamento_id uuid REFERENCES public.pagamentos_venda(id);

CREATE INDEX IF NOT EXISTS idx_lancamentos_pagamento_id
  ON public.lancamentos(pagamento_id);

NOTIFY pgrst, 'reload schema';
