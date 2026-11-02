-- Arquiva o contato "teste" (11977777777) criado pelo teste de ponta a ponta da loja (02/11),
-- ao confirmar o pedido 76. Não é cliente: sai do kanban de Relacionamento e do funil, como o
-- "Luccas teste" (20261015035824). Não apaga: o pedido 76 (cancelado) segue apontando para ele.
-- Backup: dump-*-20261102-075204.sql + supabase/backups/20261102_pedido_teste_76_contatos.csv.
--
-- Busca pelo id + telefone + nome e aborta se não achar exatamente um, ou se ele ganhou venda.

DO $$
DECLARE
  n int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.vendas WHERE contato_id = '77d8f91c-8cc1-47cd-aaca-20ccd98ca9ae') THEN
    RAISE EXCEPTION 'o contato de teste tem venda; não arquivar';
  END IF;

  UPDATE public.contatos
     SET arquivado_em = now()
   WHERE id = '77d8f91c-8cc1-47cd-aaca-20ccd98ca9ae'
     AND telefone_norm = '11977777777'
     AND nome = 'teste'
     AND origem_cadastro = 'loja'
     AND arquivado_em IS NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'esperado 1 contato "teste" da loja para arquivar, achei %', n;
  END IF;
END
$$;
