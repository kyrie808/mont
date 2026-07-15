-- Limpa o estrago histórico da falha blindada na migration anterior:
-- pagamentos e entradas de caixa registrados em vendas BRINDE.
-- Regra do Gilmar (15/07): "não recebemos dinheiro ou pix de nenhum brinde".
--
-- ESTADO ANTES (medido em 15/07):
--   - 12 linhas em pagamentos_venda apontando p/ vendas brinde
--   - 6 dessas vendas com pago=true (invariante quebrada pelo trigger de pagamento)
--   - 8 lançamentos RECEBIMENTO_VENDA (entrada) = R$188,02 de dinheiro "recebido"
--     por produto DOADO (5 pré zero-day = R$163; 06/06 = R$25; 2x R$0,01 de 11/07)
--
-- PRESERVA os lançamentos DESPESA_BRINDE (origem='brinde', saída, 7 linhas = R$213):
-- esses estão CORRETOS — brinde é despesa.
--
-- ORDEM OBRIGATÓRIA: lancamentos ANTES de pagamentos_venda.
-- A FK lancamentos.pagamento_id é NO ACTION → apagar o pagamento antes falharia.
--
-- Sem efeito colateral no catálogo: as 12 vendas têm cat_pedido_id IS NULL (verificado),
-- então sync_venda_to_cat_pedido não dispara no flip de `pago`.
--
-- ROLLBACK: restaurar via dump-data-20260715-203742.sql (backup feito antes desta migration).

-- 1) Entradas de recebimento em vendas brinde (NÃO toca nas saídas DESPESA_BRINDE)
DELETE FROM public.lancamentos l
USING public.vendas v
WHERE l.venda_id = v.id
  AND v.forma_pagamento = 'brinde'
  AND l.origem = 'venda'
  AND l.tipo   = 'entrada';

-- 2) As linhas de pagamento — o trigger update_venda_pagamento_summary recalcula
--    valor_pago=0 e pago=(0 >= total)=false, restaurando a invariante nas 6 quebradas.
DELETE FROM public.pagamentos_venda p
USING public.vendas v
WHERE p.venda_id = v.id
  AND v.forma_pagamento = 'brinde';

-- 3) Rede de segurança: garante a invariante mesmo em brinde que nunca teve pagamento.
UPDATE public.vendas
SET pago = false, valor_pago = 0
WHERE forma_pagamento = 'brinde'
  AND (pago IS DISTINCT FROM false OR COALESCE(valor_pago, 0) <> 0);
