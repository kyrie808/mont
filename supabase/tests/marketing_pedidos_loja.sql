-- Suíte: vw_marketing_pedidos não conta em dobro o pedido da loja pago (Parte G, 04/11/2026).
--
-- O pedido da loja pago aparecia duas vezes: como "online" (cat_pedidos pago) e como "direta"
-- (a venda com origem 'loja'). O pedido do catálogo antigo já era tratado: a venda dele fica de fora.
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION; nada é gravado.
-- cat_pedidos.numero_pedido usa uma sequência temporária (nextval escapa do rollback).
-- Pedido criado como o servidor da loja (service_role), confirmado e pago como a CONTA-TESTE.
-- Telefone fictício com o prefixo 119000019.
--   SUITE_OK     marketing_pedidos_loja 3/3 | [...]

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_tel constant text := '119000019';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;

  v_campanha uuid;
  v_balde uuid;
  v_pedido uuid;
  v_venda uuid;
  v_direta uuid;
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  base record;
  r record;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'vendas', (SELECT count(*) FROM public.vendas),
    'cat_pedidos', (SELECT count(*) FROM public.cat_pedidos),
    'numero_pedido_seq', (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%')
     OR EXISTS (SELECT 1 FROM public.cat_pedidos WHERE telefone_cliente LIKE c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato/pedido com o prefixo fictício %', c_tel;
  END IF;

  SELECT id INTO v_balde FROM public.produtos WHERE codigo = 'balde_pao_queijo_4kg' AND ativo AND visivel_catalogo;
  IF v_balde IS NULL THEN RAISE EXCEPTION 'SUITE_ABORTADA: balde não está à venda'; END IF;

  -- ── Ajustes de cenário (descartados no fim) ──
  UPDATE public.produtos SET esgotado = false WHERE id = v_balde;
  CREATE SEQUENCE public.tmp_suite_marketing_seq START 920001;
  ALTER TABLE public.cat_pedidos ALTER COLUMN numero_pedido SET DEFAULT nextval('public.tmp_suite_marketing_seq');

  SELECT coalesce(sum(total_pedidos), 0) AS pedidos, coalesce(sum(pedidos_online), 0) AS online,
         coalesce(sum(pedidos_diretos), 0) AS diretos, coalesce(sum(faturamento), 0) AS faturamento
    INTO base FROM public.vw_marketing_pedidos WHERE data_venda = hoje;

  -- Pedido da loja (como o servidor da loja).
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;
  SELECT lp.pedido_id INTO v_pedido FROM public.loja_criar_pedido(
    gen_random_uuid(), 'Cliente Suíte', c_tel || '01', '09750000', 'Rua Teste', '1', NULL, NULL,
    'São Bernardo do Campo', 'SP', jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1)),
    false, NULL) lp;
  RESET ROLE;

  -- Confirma e paga como a conta-teste (igual ao app).
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;
  v_venda := public.loja_confirmar_pedido(v_pedido, 0, hoje, 'pix');
  UPDATE public.vendas SET pago = true WHERE id = v_venda;
  RESET ROLE;

  -- ── M1: o pedido da loja pago entra uma vez só, como online ──
  casos := casos + 1;
  BEGIN
    IF (SELECT status_pagamento FROM public.cat_pedidos WHERE id = v_pedido) <> 'pago'
       OR (SELECT data FROM public.vendas WHERE id = v_venda) <> hoje THEN
      RAISE EXCEPTION 'cenário: pedido não ficou pago ou venda fora de hoje';
    END IF;
    SELECT coalesce(sum(total_pedidos), 0) AS pedidos, coalesce(sum(pedidos_online), 0) AS online,
           coalesce(sum(pedidos_diretos), 0) AS diretos, coalesce(sum(faturamento), 0) AS faturamento
      INTO r FROM public.vw_marketing_pedidos WHERE data_venda = hoje;
    IF r.pedidos - base.pedidos <> 1 OR r.online - base.online <> 1 OR r.diretos - base.diretos <> 0 THEN
      RAISE EXCEPTION 'pedido da loja contou % vez(es): online +%, direta +%',
        r.pedidos - base.pedidos, r.online - base.online, r.diretos - base.diretos;
    END IF;
    IF r.faturamento - base.faturamento <> (SELECT total FROM public.cat_pedidos WHERE id = v_pedido) THEN
      RAISE EXCEPTION 'faturamento somou % (esperado o total do pedido, %)',
        r.faturamento - base.faturamento, (SELECT total FROM public.cat_pedidos WHERE id = v_pedido);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'M1 loja paga conta uma vez (online)', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'M1 loja paga conta uma vez (online)', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── M2: venda direta paga continua entrando como direta ──
  casos := casos + 1;
  BEGIN
    SELECT coalesce(sum(total_pedidos), 0) AS pedidos, coalesce(sum(pedidos_diretos), 0) AS diretos
      INTO base FROM public.vw_marketing_pedidos WHERE data_venda = hoje;
    UPDATE public.vendas SET origem = NULL WHERE id = v_venda;
    SELECT coalesce(sum(total_pedidos), 0) AS pedidos, coalesce(sum(pedidos_diretos), 0) AS diretos
      INTO r FROM public.vw_marketing_pedidos WHERE data_venda = hoje;
    IF r.diretos - base.diretos <> 1 THEN RAISE EXCEPTION 'venda direta não entrou (+%)', r.diretos - base.diretos; END IF;
    UPDATE public.vendas SET origem = 'loja' WHERE id = v_venda;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'M2 venda direta continua direta', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'M2 venda direta continua direta', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── M3: a função órfã rpt_marketing_pedidos_periodo não existe mais ──
  casos := casos + 1;
  BEGIN
    IF to_regprocedure('public.rpt_marketing_pedidos_periodo(date, date)') IS NOT NULL THEN
      RAISE EXCEPTION 'rpt_marketing_pedidos_periodo ainda existe';
    END IF;
    IF NOT (SELECT 'security_invoker=on' = ANY (reloptions) FROM pg_class WHERE oid = 'public.vw_marketing_pedidos'::regclass) THEN
      RAISE EXCEPTION 'vw_marketing_pedidos perdeu o security_invoker';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'M3 função órfã removida; view com security_invoker', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'M3 função órfã removida; view com security_invoker', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% marketing_pedidos_loja %/% | contagens_antes=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, antes, resultados;
END
$suite$;

-- Contagens para rodar antes e depois (têm que bater):
-- SELECT (SELECT count(*) FROM public.contatos) contatos, (SELECT count(*) FROM public.vendas) vendas,
--        (SELECT count(*) FROM public.cat_pedidos) cat_pedidos,
--        (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq) numero_pedido_seq;
