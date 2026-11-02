-- Religa a regra do estoque nos doces da loja (desfaz 20261102112056_loja_doces_so_chave_manual).
-- Rodar SÓ depois da contagem física, com o estoque do sistema conferido, como migração nova
-- (backup antes). A partir daí um doce sem estoque aparece "Esgotado" na loja e o pedido é recusado.

UPDATE public.loja_vitrine
   SET usa_estoque = true
 WHERE secao IN ('doces', 'zero')
   AND NOT usa_estoque;

COMMENT ON COLUMN public.loja_vitrine.usa_estoque IS
  'true = além da chave manual (disponivel), exige estoque_atual > 0 na vitrine e no pedido. Massa: false.';
