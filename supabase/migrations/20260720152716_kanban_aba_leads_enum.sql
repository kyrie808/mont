-- Aba "Leads" no kanban de relacionamento (parte 1/2): adiciona o valor no enum.
-- ADD VALUE precisa ser commitado ANTES de ser usado (não pode na mesma txn) →
-- a view que usa 'leads' vai numa migration separada (20260720120100).
ALTER TYPE public.enum_relacionamento_aba ADD VALUE IF NOT EXISTS 'leads';
