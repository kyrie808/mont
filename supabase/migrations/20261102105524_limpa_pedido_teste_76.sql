-- Limpa o teste de ponta a ponta da loja (02/11): pedido nº 76 virou a venda 4b966851 ao ser
-- confirmado no "Pedidos da loja". Backup antes: dump-*-20261102-075204.sql + CSVs
-- supabase/backups/20261102_pedido_teste_76_*.csv (pedido, itens, venda, itens da venda, contato).
--
-- 1. Exclui a venda (itens_venda caem em cascata). Ela está pendente e sem pagamento/lançamento,
--    então não há estoque nem caixa para desfazer; o gatilho devolve o pedido para "pendente".
-- 2. Descarta o pedido pela própria RPC (status "cancelado"): o registro do pedido NÃO é apagado.
-- O contato criado pelo teste não é tocado aqui: o Luccas decide o que fazer com ele.
--
-- Busca pelos ids e aborta se o estado não for exatamente o esperado.

DO $$
DECLARE
  v_pedido constant uuid := '3b30228e-8c76-4dfb-bcf8-04348a05bb61';
  v_venda  constant uuid := '4b966851-42cc-4b22-b854-c6c7b7dbcdd2';
  n int;
BEGIN
  PERFORM 1 FROM public.vendas
   WHERE id = v_venda AND cat_pedido_id = v_pedido AND origem = 'loja'
     AND status = 'pendente' AND NOT pago AND valor_pago = 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'venda de teste % não está no estado esperado', v_venda;
  END IF;
  IF EXISTS (SELECT 1 FROM public.pagamentos_venda WHERE venda_id = v_venda)
     OR EXISTS (SELECT 1 FROM public.lancamentos WHERE venda_id = v_venda)
     OR EXISTS (SELECT 1 FROM public.meta_eventos WHERE venda_id = v_venda) THEN
    RAISE EXCEPTION 'venda de teste % tem pagamento, lançamento ou evento Meta', v_venda;
  END IF;

  DELETE FROM public.vendas WHERE id = v_venda;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'esperado excluir 1 venda, excluí %', n;
  END IF;

  -- loja_descartar_pedido só aceita admin: roda como o usuário do sistema interno.
  PERFORM set_config('request.jwt.claims',
    '{"sub":"e9cbd39c-90ab-48c1-9a43-ed23eb64af4f","role":"authenticated"}', true);
  PERFORM public.loja_descartar_pedido(v_pedido);

  PERFORM 1 FROM public.cat_pedidos
   WHERE id = v_pedido AND numero_pedido = 76 AND canal = 'loja' AND status = 'cancelado';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pedido 76 não ficou cancelado';
  END IF;
END
$$;
