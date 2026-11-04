-- Suíte: origem do clique no pedido da loja (fbp, fbc, UTMs) e Purchase da entrega com fbc/fbp
-- (migração loja_pedido_atribuicao_meta, 03/11/2026).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION. Nada é
-- gravado (pedidos, vendas, contatos, estoque, meta_eventos, ajustes de cenário).
--   SUITE_OK     loja_atribuicao_meta 7/7 | [...]
--
-- cat_pedidos.numero_pedido usa uma sequência temporária (nextval escapa do rollback).
-- Pedidos criados como o servidor da loja (service_role); confirmação e entrega como a
-- CONTA-TESTE (admin), igual ao app. Telefones fictícios com o prefixo 119000018.

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_tel constant text := '119000018';
  c_fbp constant text := 'fb.1.1762170000000.1234567890';
  c_fbc constant text := 'fb.1.1762170000000.IwAR2xYz_ab-CD.ef';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;

  v_balde uuid;
  ped_a uuid; ped_b uuid; ped_c uuid; ped_d uuid;
  venda uuid;
  itens jsonb;
  r record;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'vendas', (SELECT count(*) FROM public.vendas),
    'cat_pedidos', (SELECT count(*) FROM public.cat_pedidos),
    'cat_itens_pedido', (SELECT count(*) FROM public.cat_itens_pedido),
    'meta_eventos', (SELECT count(*) FROM public.meta_eventos),
    'estoque_total', (SELECT sum(estoque_atual) FROM public.produtos),
    'numero_pedido_seq', (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%')
     OR EXISTS (SELECT 1 FROM public.cat_pedidos WHERE telefone_cliente LIKE c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato/pedido com o prefixo fictício %', c_tel;
  END IF;

  SELECT id INTO v_balde FROM public.produtos WHERE codigo = 'balde_pao_queijo_4kg' AND ativo AND visivel_catalogo;
  IF v_balde IS NULL THEN RAISE EXCEPTION 'SUITE_ABORTADA: balde não está à venda'; END IF;
  itens := jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1));

  -- ── Ajustes de cenário (descartados no fim) ──
  UPDATE public.produtos SET estoque_atual = 100 WHERE id = v_balde;
  UPDATE public.produtos SET esgotado = false WHERE id = v_balde;
  CREATE SEQUENCE public.tmp_suite_loja_atribuicao_seq START 900101;
  ALTER TABLE public.cat_pedidos ALTER COLUMN numero_pedido SET DEFAULT nextval('public.tmp_suite_loja_atribuicao_seq');

  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;

  -- ── A1: atribuição completa é gravada no pedido ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_a FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente A', '11900001801', '09750000', 'Rua A', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
      itens, false, NULL,
      jsonb_build_object('fbp', c_fbp, 'fbc', c_fbc, 'utm_source', '  facebook ', 'utm_medium', 'paid',
                         'utm_campaign', 'black_2026', 'utm_content', 'video_1', 'utm_term', 'pao de queijo')) lp;
    SELECT * INTO r FROM public.cat_pedidos WHERE id = ped_a;
    IF r.fbp IS DISTINCT FROM c_fbp OR r.fbc IS DISTINCT FROM c_fbc OR r.utm_source IS DISTINCT FROM 'facebook'
       OR r.utm_medium IS DISTINCT FROM 'paid' OR r.utm_campaign IS DISTINCT FROM 'black_2026'
       OR r.utm_content IS DISTINCT FROM 'video_1' OR r.utm_term IS DISTINCT FROM 'pao de queijo' THEN
      RAISE EXCEPTION 'gravou %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A1 fbp/fbc/UTMs gravados', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A1 fbp/fbc/UTMs gravados', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A2: fora do formato vira NULL, UTM vazia NULL, UTM longa cortada; o pedido sai mesmo assim ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_b FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente B', '11900001802', '09750000', 'Rua B', '2', NULL, NULL, 'Santo André', 'SP',
      itens, false, NULL,
      jsonb_build_object('fbp', 'fb.1.abc.123', 'fbc', 'fb.1.1762170000000.<script>', 'utm_source', '   ',
                         'utm_campaign', repeat('x', 250))) lp;
    SELECT * INTO r FROM public.cat_pedidos WHERE id = ped_b;
    IF r.id IS NULL OR r.fbp IS NOT NULL OR r.fbc IS NOT NULL OR r.utm_source IS NOT NULL
       OR length(r.utm_campaign) IS DISTINCT FROM 200 OR r.utm_medium IS NOT NULL THEN
      RAISE EXCEPTION 'gravou %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A2 inválido vira NULL sem recusar', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A2 inválido vira NULL sem recusar', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A3: chamada da loja publicada (13 argumentos) continua funcionando, sem atribuição ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_c FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente C', '11900001803', '09750000', 'Rua C', '3', NULL, NULL, 'Diadema', 'SP',
      itens, false, NULL) lp;
    SELECT * INTO r FROM public.cat_pedidos WHERE id = ped_c;
    IF r.id IS NULL OR r.fbp IS NOT NULL OR r.fbc IS NOT NULL OR r.utm_source IS NOT NULL OR r.utm_campaign IS NOT NULL THEN
      RAISE EXCEPTION 'gravou %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A3 chamada com 13 argumentos', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A3 chamada com 13 argumentos', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A4: atribuição que não é objeto é ignorada ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_d FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente D', '11900001804', '09750000', 'Rua D', '4', NULL, NULL, 'Mauá', 'SP',
      itens, false, NULL, jsonb_build_array(c_fbp, c_fbc)) lp;
    SELECT * INTO r FROM public.cat_pedidos WHERE id = ped_d;
    IF r.id IS NULL OR r.fbp IS NOT NULL OR r.fbc IS NOT NULL THEN RAISE EXCEPTION 'gravou %', row_to_json(r); END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A4 atribuição não-objeto ignorada', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A4 atribuição não-objeto ignorada', 'ok', false, 'erro', SQLERRM);
  END;

  RESET ROLE;

  -- ── A5: permissões — só a assinatura nova existe, e só para o service_role ──
  casos := casos + 1;
  BEGIN
    IF to_regprocedure('public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text)') IS NOT NULL THEN
      RAISE EXCEPTION 'a versão de 13 argumentos ainda existe (PostgREST ficaria ambíguo)';
    END IF;
    IF has_function_privilege('anon', 'public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, jsonb, text, text, text, numeric)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, jsonb, text, text, text, numeric)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, jsonb, text, text, text, numeric)', 'EXECUTE') THEN
      RAISE EXCEPTION 'permissões de loja_criar_pedido';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A5 permissões', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A5 permissões', 'ok', false, 'erro', SQLERRM);
  END;

  -- Confirmação e entrega como a conta-teste (admin), igual ao sistema interno.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;

  -- ── A6: entrega do pedido com clique → Purchase leva o fbp/fbc do pedido ──
  casos := casos + 1;
  BEGIN
    venda := public.loja_confirmar_pedido(ped_a, 0, current_date, 'pix');
    IF EXISTS (SELECT 1 FROM public.meta_eventos WHERE venda_id = venda) THEN
      RAISE EXCEPTION 'Purchase antes da entrega';
    END IF;
    UPDATE public.vendas SET status = 'entregue' WHERE id = venda;
    SELECT * INTO r FROM public.meta_eventos WHERE event_id = 'venda_' || venda;
    IF r.id IS NULL OR r.evento <> 'Purchase' OR r.status <> 'pendente'
       OR r.fbp IS DISTINCT FROM c_fbp OR r.fbc IS DISTINCT FROM c_fbc THEN
      RAISE EXCEPTION 'evento = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A6 Purchase com fbp/fbc do pedido', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A6 Purchase com fbp/fbc do pedido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A7: pedido sem clique → Purchase normal, fbp/fbc NULL ──
  casos := casos + 1;
  BEGIN
    venda := public.loja_confirmar_pedido(ped_c, 0, current_date, 'pix');
    UPDATE public.vendas SET status = 'entregue' WHERE id = venda;
    SELECT * INTO r FROM public.meta_eventos WHERE event_id = 'venda_' || venda;
    IF r.id IS NULL OR r.fbp IS NOT NULL OR r.fbc IS NOT NULL OR r.valor IS DISTINCT FROM (SELECT total FROM public.vendas WHERE id = venda) THEN
      RAISE EXCEPTION 'evento = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A7 Purchase sem clique segue igual', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A7 Purchase sem clique segue igual', 'ok', false, 'erro', SQLERRM);
  END;

  RESET ROLE;
  RAISE EXCEPTION '% loja_atribuicao_meta %/% | contagens_antes=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END, passou, casos, antes, resultados;
END
$suite$;
