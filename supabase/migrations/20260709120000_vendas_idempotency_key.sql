-- Idempotência na criação de venda.
-- Chave única por checkout, usada para deduplicar reenvios em sinal fraco e
-- cliques duplos (ver RPC criar_venda). Vendas antigas e de catálogo ficam
-- com NULL — por isso o índice único é PARCIAL (só vale quando NOT NULL).

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendas_idempotency_key
  ON public.vendas (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
