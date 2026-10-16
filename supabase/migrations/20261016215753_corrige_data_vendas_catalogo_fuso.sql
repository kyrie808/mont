-- 4 vendas de catálogo gravadas com o dia SEGUINTE: pedidos feitos entre 22h e 23h43 de
-- Brasília (24/03, 29/03, 20/06 e 06/08/2026), quando o banco em UTC já tinha virado o dia
-- (criar_pedido usa current_date). Nenhuma cruzou mês — o faturamento mensal não muda,
-- só o dia da venda. A causa (fuso do banco) é tratada à parte em fix/fuso-brasilia.
--
-- Predicado em vez de ids: a venda de catálogo tem que estar no dia de Brasília do pedido.
-- Mudar vendas.data só dispara o trigger de auditoria (sync com cat_pedidos e CAPI
-- reagem a status/pago/forma_pagamento, não a data).
DO $$
DECLARE n int;
BEGIN
  UPDATE public.vendas v
     SET data = (cp.criado_em AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.cat_pedidos cp
   WHERE cp.id = v.cat_pedido_id
     AND v.data <> (cp.criado_em AT TIME ZONE 'America/Sao_Paulo')::date;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN
    RAISE EXCEPTION 'esperado corrigir 4 vendas de catálogo, o UPDATE pegou % — abortado', n;
  END IF;
END $$;
