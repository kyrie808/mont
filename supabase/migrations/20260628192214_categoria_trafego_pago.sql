-- Categoria de despesa "Tráfego Pago" (marketing). codigo estável p/ detecção no app
-- (mesmo padrão de DESPESA_BRINDE). automatica=false → aparece no dropdown de categorias.
-- Idempotente via NOT EXISTS.

INSERT INTO public.plano_de_contas (nome, tipo, categoria, codigo, automatica, ativo)
SELECT 'Tráfego Pago', 'despesa', 'variavel', 'TRAFEGO_PAGO', false, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.plano_de_contas WHERE codigo = 'TRAFEGO_PAGO'
);
