-- Loja: até a contagem física, os doces seguem SÓ a chave manual de esgotado, como a massa
-- (decisão do Luccas, 02/11). O estoque do sistema está errado (ex.: doce de leite com coco 680 g
-- com estoque −1 aparecia "Esgotado" sem estar).
--
-- A configuração é a coluna loja_vitrine.usa_estoque, por produto. Ela já é lida nos dois lugares:
--   • a vitrine da loja (apps/loja/src/lib/vitrine/carregar.ts): disponivel AND (NOT usa_estoque OR estoque > 0);
--   • a gravação do pedido (loja_criar_pedido): recusa "Sem estoque suficiente" só se usa_estoque.
-- Nada de código muda: a regra do estoque continua pronta.
--
-- Religar depois da contagem: supabase/rollbacks/20261102112056_loja_doces_so_chave_manual.rollback.sql
-- (volta usa_estoque = true nos doces e na linha zero).
--
-- Backup antes: dump-*-20261102-081733.sql.

DO $$
DECLARE
  n int;
BEGIN
  UPDATE public.loja_vitrine
     SET usa_estoque = false
   WHERE secao IN ('doces', 'zero')
     AND usa_estoque;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 15 THEN
    RAISE EXCEPTION 'esperado desligar o estoque de 15 doces (13 doces + 2 zero), achei %', n;
  END IF;
END
$$;

COMMENT ON COLUMN public.loja_vitrine.usa_estoque IS
  'true = além da chave manual (disponivel), exige estoque_atual > 0 na vitrine e no pedido. '
  'Desligado em todos os doces em 02/11/2026 até a contagem física; religar pelo rollback de 20261102 loja_doces_so_chave_manual.';
