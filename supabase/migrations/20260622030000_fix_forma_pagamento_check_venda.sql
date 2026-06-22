-- FIX crítico: o checkout (Estágio A do tracking) passou a gravar
-- forma_pagamento='venda', mas o CHECK constraint não permitia esse valor —
-- toda venda do tipo "Venda" era rejeitada. Adiciona 'venda' ao constraint.
-- Aditiva (só amplia os valores aceitos; nenhum dado existente viola).
-- Backup: dump-{schema,data}-20260622-025133.sql

ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_forma_pagamento_check;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_forma_pagamento_check
  CHECK (forma_pagamento = ANY (ARRAY['venda'::text, 'pix'::text, 'dinheiro'::text, 'cartao'::text, 'fiado'::text, 'brinde'::text, 'pre_venda'::text]));
