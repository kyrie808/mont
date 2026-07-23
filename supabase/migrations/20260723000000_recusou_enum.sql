-- D4.4 coluna "Recusou" com cooldown (parte 1/2): novo estado no enum.
-- 'recusou' = cliente respondeu recusando a oferta; card entra em quarentena
-- (descansa X dias antes de poder reofertar). ADD VALUE precisa ser commitado
-- ANTES de ser usado (não pode na mesma txn) → uso/view na migration seguinte.
ALTER TYPE public.enum_relacionamento_status ADD VALUE IF NOT EXISTS 'recusou';
