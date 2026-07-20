-- D4 cadência de follow-up (parte 1/2): novos estados no enum de status do kanban.
-- 'follow_up'  = tem toque devido pela cadência (venceu o passo, ainda dentro dos 5 toques)
-- 'sem_retorno'= esgotou a cadência (5 toques sem resposta) — para de cobrar.
-- ADD VALUE precisa ser commitado ANTES de ser usado (não pode na mesma txn) →
-- a view/uso vai numa migration separada (20260720160100).
ALTER TYPE public.enum_relacionamento_status ADD VALUE IF NOT EXISTS 'follow_up';
ALTER TYPE public.enum_relacionamento_status ADD VALUE IF NOT EXISTS 'sem_retorno';
