-- Suíte: pedido da loja pelo WhatsApp + confirmação no sistema interno
-- (migração loja_pedido_whatsapp, 02/11/2026).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION. Nada é
-- gravado: nem pedidos, vendas, contatos, baixa de estoque ou evento da Meta, nem os AJUSTES DE
-- CENÁRIO abaixo.
--   SUITE_OK     loja_pedido 16/16 | [...]
--
-- Cenário (só dentro da transação):
--   * a campanha "Black da Mont 2026" fica ligada e valendo desde ontem;
--   * estoque dos doces usados vai a 100 (o estoque real não pode decidir o teste);
--   * cat_pedidos.numero_pedido usa uma sequência temporária, para não queimar números reais
--     (nextval escapa do rollback).
-- Cria os pedidos como o servidor da loja (service_role) e confirma como a CONTA-TESTE (admin),
-- igual ao app. Telefones fictícios com o prefixo 119000017.

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_tel constant text := '119000017';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;

  v_campanha uuid;
  v_balde uuid; v_dl uuid; v_cocada uuid;
  v_familia uuid; v_par uuid; v_dupla uuid; v_kit_top uuid;
  g_familia uuid; g_par uuid;
  esc_familia jsonb; esc_par jsonb;
  ped_a uuid; ped_b uuid; ped_c uuid; ped_d uuid; ped_e uuid;
  chave_a uuid := gen_random_uuid();
  venda_a uuid; venda_b uuid; venda_d uuid; venda_e uuid; venda_x uuid;
  v_contato_e uuid;
  n int;
  x numeric;
  r record;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'vendas', (SELECT count(*) FROM public.vendas),
    'itens_venda', (SELECT count(*) FROM public.itens_venda),
    'cat_pedidos', (SELECT count(*) FROM public.cat_pedidos),
    'cat_itens_pedido', (SELECT count(*) FROM public.cat_itens_pedido),
    'pendentes_vinculacao', (SELECT count(*) FROM public.cat_pedidos_pendentes_vinculacao),
    'meta_eventos', (SELECT count(*) FROM public.meta_eventos),
    'estoque_total', (SELECT sum(estoque_atual) FROM public.produtos),
    'campanha', (SELECT jsonb_agg(jsonb_build_array(ativa, inicio, fim)) FROM public.loja_campanhas),
    'numero_pedido_seq', (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%')
     OR EXISTS (SELECT 1 FROM public.cat_pedidos WHERE telefone_cliente LIKE c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato/pedido com o prefixo fictício %', c_tel;
  END IF;

  -- ── Identificadores ──
  SELECT id INTO v_campanha FROM public.loja_campanhas WHERE nome = 'Black da Mont 2026';
  SELECT id INTO v_balde FROM public.produtos WHERE codigo = 'balde_pao_queijo_4kg';
  SELECT id INTO v_dl FROM public.produtos WHERE codigo = 'doce_leite_tradicional_680g';
  SELECT id INTO v_cocada FROM public.produtos WHERE codigo = 'cocada_cremosa_680g';
  SELECT id INTO v_familia FROM public.produtos WHERE codigo = 'combo_black_familia';
  SELECT id INTO v_par FROM public.produtos WHERE codigo = 'combo_black_balde_doce';
  SELECT id INTO v_dupla FROM public.produtos WHERE codigo = 'combo_black_dupla_zero';
  SELECT id INTO v_kit_top FROM public.produtos WHERE codigo = 'combo_black_kit_top_morango';
  SELECT id INTO g_familia FROM public.combo_grupos WHERE combo_id = v_familia;
  SELECT id INTO g_par FROM public.combo_grupos WHERE combo_id = v_par;
  IF v_campanha IS NULL OR v_balde IS NULL OR v_dl IS NULL OR v_cocada IS NULL OR v_familia IS NULL
     OR v_par IS NULL OR v_dupla IS NULL OR v_kit_top IS NULL OR g_familia IS NULL OR g_par IS NULL THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: cenário da Black não encontrado';
  END IF;
  esc_familia := jsonb_build_array(
    jsonb_build_object('grupo_id', g_familia, 'produto_id', v_dl, 'quantidade', 3),
    jsonb_build_object('grupo_id', g_familia, 'produto_id', v_cocada, 'quantidade', 3));
  esc_par := jsonb_build_array(jsonb_build_object('grupo_id', g_par, 'produto_id', v_dl, 'quantidade', 1));

  -- ── Ajustes de cenário (descartados no fim) ──
  UPDATE public.loja_campanhas SET ativa = true, inicio = now() - interval '1 day' WHERE id = v_campanha;
  UPDATE public.produtos SET estoque_atual = 100
   WHERE id IN (SELECT produto_id FROM public.loja_vitrine WHERE usa_estoque);
  CREATE SEQUENCE public.tmp_suite_loja_pedido_seq START 900001;
  ALTER TABLE public.cat_pedidos ALTER COLUMN numero_pedido SET DEFAULT nextval('public.tmp_suite_loja_pedido_seq');

  -- ── Como o servidor da loja ──
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;

  -- ── L1: pedido com 2 baldes + Mesa Cheia no Pix = 2 × 65 + 199 = 329 ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_a FROM public.loja_criar_pedido(
      chave_a, '  Cliente   Suíte  ', '(11) 90000-1701', '09750-000', 'Rua Teste', '100', 'Ap 1', 'Centro',
      'São Bernardo do Campo', 'sp',
      jsonb_build_array(
        jsonb_build_object('produto_id', v_balde, 'quantidade', 2, 'preco', 1),
        jsonb_build_object('combo_id', v_familia, 'escolhas', esc_familia)),
      true, 'Quero receber ofertas da Mont no WhatsApp.') lp;
    SELECT * INTO r FROM public.cat_pedidos WHERE id = ped_a;
    IF r.canal <> 'loja' OR r.status <> 'pendente' OR r.total <> 329 OR r.subtotal <> 329 OR r.frete IS NOT NULL THEN
      RAISE EXCEPTION 'pedido = %', row_to_json(r);
    END IF;
    IF r.nome_cliente <> 'Cliente Suíte' OR r.telefone_cliente <> '11900001701' OR r.uf <> 'SP' OR r.cep <> '09750000' THEN
      RAISE EXCEPTION 'normalização: % / % / % / %', r.nome_cliente, r.telefone_cliente, r.uf, r.cep;
    END IF;
    IF r.endereco_entrega <> 'Rua Teste, 100 - Ap 1 - Centro, São Bernardo do Campo/SP - CEP 09750-000' THEN
      RAISE EXCEPTION 'endereço = %', r.endereco_entrega;
    END IF;
    IF NOT r.ofertas_whatsapp OR r.ofertas_texto IS NULL THEN RAISE EXCEPTION 'aceite de ofertas não gravado'; END IF;
    IF (SELECT sum(total) FROM public.cat_itens_pedido WHERE pedido_id = ped_a) <> 329 THEN
      RAISE EXCEPTION 'itens somam %', (SELECT sum(total) FROM public.cat_itens_pedido WHERE pedido_id = ped_a);
    END IF;
    IF (SELECT sum(quantidade) FROM public.cat_itens_pedido WHERE pedido_id = ped_a AND combo_id = v_familia AND produto_id IN (v_dl, v_cocada)) <> 6
       OR (SELECT count(DISTINCT combo_instancia) FROM public.cat_itens_pedido WHERE pedido_id = ped_a AND combo_id = v_familia) <> 1 THEN
      RAISE EXCEPTION 'sabores do combo não viraram itens';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L1 pedido Pix 329 com sabores', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L1 pedido Pix 329 com sabores', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L2: mesmo envio de novo devolve o mesmo pedido ──
  casos := casos + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.cat_pedidos;
    SELECT lp.pedido_id INTO ped_b FROM public.loja_criar_pedido(
      chave_a, 'Outro', '11900001799', '09750000', 'Rua', '1', NULL, NULL, 'Santo André', 'SP',
      jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1)), false, NULL) lp;
    IF ped_b IS DISTINCT FROM ped_a OR (SELECT count(*) FROM public.cat_pedidos) <> n THEN
      RAISE EXCEPTION 'criou outro pedido';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L2 envio repetido = mesmo pedido', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L2 envio repetido = mesmo pedido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L3: recusas (telefone, sabores incompletos, fora da vitrine, combo como avulso, vazio) ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(gen_random_uuid(), 'Fulano', '1234', '09750000', 'Rua', '1', NULL, NULL, 'SBC', 'SP',
        jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1)), false, NULL);
      RAISE EXCEPTION 'aceitou telefone inválido';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%WhatsApp inválido%' THEN RAISE EXCEPTION 'tel: %', SQLERRM; END IF;
    END;
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(gen_random_uuid(), 'Fulano', '11900001702', '09750000', 'Rua', '1', NULL, NULL, 'SBC', 'SP',
        jsonb_build_array(jsonb_build_object('combo_id', v_familia, 'escolhas', esc_familia - 1)), false, NULL);
      RAISE EXCEPTION 'aceitou combo incompleto';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%esperados 6%' THEN RAISE EXCEPTION 'combo: %', SQLERRM; END IF;
    END;
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(gen_random_uuid(), 'Fulano', '11900001702', '09750000', 'Rua', '1', NULL, NULL, 'SBC', 'SP',
        jsonb_build_array(jsonb_build_object('combo_id', v_kit_top, 'escolhas', '[]'::jsonb)), false, NULL);
      RAISE EXCEPTION 'aceitou combo fora da vitrine';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%indisponível%' THEN RAISE EXCEPTION 'kit top: %', SQLERRM; END IF;
    END;
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(gen_random_uuid(), 'Fulano', '11900001702', '09750000', 'Rua', '1', NULL, NULL, 'SBC', 'SP',
        jsonb_build_array(jsonb_build_object('produto_id', v_dupla, 'quantidade', 1)), false, NULL);
      RAISE EXCEPTION 'aceitou combo como avulso';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%indisponível%' THEN RAISE EXCEPTION 'avulso: %', SQLERRM; END IF;
    END;
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(gen_random_uuid(), 'Fulano', '11900001702', '09750000', 'Rua', '1', NULL, NULL, 'SBC', 'SP',
        '[]'::jsonb, false, NULL);
      RAISE EXCEPTION 'aceitou sacola vazia';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L3 recusas da loja', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L3 recusas da loja', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L4: estoque do doce menor que o pedido recusa ──
  casos := casos + 1;
  BEGIN
    RESET ROLE;
    UPDATE public.produtos SET estoque_atual = 2 WHERE id = v_cocada;
    SET LOCAL ROLE service_role;
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(gen_random_uuid(), 'Fulano', '11900001702', '09750000', 'Rua', '1', NULL, NULL, 'SBC', 'SP',
        jsonb_build_array(jsonb_build_object('combo_id', v_familia, 'escolhas', esc_familia)), false, NULL);
      RAISE EXCEPTION 'aceitou 3 cocadas com 2 no estoque';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%Sem estoque suficiente%' THEN RAISE EXCEPTION 'estoque: %', SQLERRM; END IF;
    END;
    RESET ROLE;
    UPDATE public.produtos SET estoque_atual = 100 WHERE id = v_cocada;
    SET LOCAL ROLE service_role;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L4 estoque insuficiente recusa', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L4 estoque insuficiente recusa', 'ok', false, 'erro', SQLERRM);
  END;

  -- Pedidos para os casos de confirmação.
  SELECT lp.pedido_id INTO ped_b FROM public.loja_criar_pedido(gen_random_uuid(), 'Cliente B', '11900001703', '09750000', 'Rua B', '2', NULL, 'Centro', 'Santo André', 'SP',
    jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1), jsonb_build_object('combo_id', v_dupla, 'escolhas', '[]'::jsonb)), false, NULL) lp;
  SELECT lp.pedido_id INTO ped_c FROM public.loja_criar_pedido(gen_random_uuid(), 'Cliente C', '11900001704', '09750000', 'Rua C', '3', NULL, NULL, 'Diadema', 'SP',
    jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1)), false, NULL) lp;
  SELECT lp.pedido_id INTO ped_d FROM public.loja_criar_pedido(gen_random_uuid(), 'Cliente D', '11900001705', '09750000', 'Rua D', '4', NULL, NULL, 'Mauá', 'SP',
    jsonb_build_array(jsonb_build_object('combo_id', v_par, 'escolhas', esc_par)), false, NULL) lp;
  SELECT lp.pedido_id INTO ped_e FROM public.loja_criar_pedido(gen_random_uuid(), 'Cliente E', '11900001706', '09750000', 'Rua Nova', '50', NULL, 'Rudge Ramos', 'São Bernardo do Campo', 'SP',
    jsonb_build_array(jsonb_build_object('produto_id', v_dl, 'quantidade', 1)), false, NULL) lp;
  RESET ROLE;

  -- ── L5: permissões ──
  casos := casos + 1;
  BEGIN
    IF has_function_privilege('anon', 'public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'loja_criar_pedido aberta fora do service_role';
    END IF;
    IF has_function_privilege('authenticated', 'public.criar_venda_em(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text, timestamptz, text, uuid, text)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.criar_venda_em(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text, timestamptz, text, uuid, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'criar_venda_em exposta';
    END IF;
    IF has_function_privilege('anon', 'public.loja_confirmar_pedido(uuid, numeric, date, text, boolean)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.loja_confirmar_pedido(uuid, numeric, date, text, boolean)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.loja_descartar_pedido(uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'permissões da confirmação/descarte';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L5 permissões', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L5 permissões', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L6: gatilho antigo do catálogo não cria venda para pedido da loja ──
  casos := casos + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.cat_pedidos_pendentes_vinculacao;
    UPDATE public.cat_pedidos SET status = 'entregue' WHERE id = ped_c;
    IF EXISTS (SELECT 1 FROM public.vendas WHERE cat_pedido_id = ped_c) THEN RAISE EXCEPTION 'gatilho antigo criou venda'; END IF;
    IF (SELECT count(*) FROM public.cat_pedidos_pendentes_vinculacao) <> n THEN RAISE EXCEPTION 'gatilho antigo registrou pendência'; END IF;
    UPDATE public.cat_pedidos SET status = 'pendente' WHERE id = ped_c;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L6 fn_sync_cat_pedido_to_venda ignora a loja', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L6 fn_sync_cat_pedido_to_venda ignora a loja', 'ok', false, 'erro', SQLERRM);
  END;

  -- Contato já existente do cliente E, com outro endereço (criado como a conta-teste).
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;
  INSERT INTO public.contatos (nome, telefone, tipo, status, origem, logradouro, numero, cidade, uf)
  VALUES ('Cliente E antigo', '11900001706', 'B2C', 'cliente', 'direto', 'Rua Antiga', '9', 'Santo André', 'SP')
  RETURNING id INTO v_contato_e;

  -- ── L7: confirmar no Pix com frete 10 cria a venda pendente da loja ──
  casos := casos + 1;
  BEGIN
    venda_a := public.loja_confirmar_pedido(ped_a, 10, current_date + 1, 'pix');
    SELECT * INTO r FROM public.vendas WHERE id = venda_a;
    IF r.origem <> 'loja' OR r.cat_pedido_id IS DISTINCT FROM ped_a OR r.total <> 339 OR r.taxa_entrega <> 10
       OR r.status <> 'pendente' OR r.pago OR r.forma_pagamento <> 'pix' OR r.tabela_preco <> 'pix'
       OR r.data_entrega_prevista <> current_date + 1 OR r.dinheiro_na_entrega THEN
      RAISE EXCEPTION 'venda = %', row_to_json(r);
    END IF;
    IF (SELECT count(*) FROM public.itens_venda WHERE venda_id = venda_a AND combo_id = v_familia) = 0
       OR (SELECT sum(subtotal) FROM public.itens_venda WHERE venda_id = venda_a) <> 329 THEN
      RAISE EXCEPTION 'itens da venda';
    END IF;
    IF (SELECT status FROM public.cat_pedidos WHERE id = ped_a) <> 'confirmado'
       OR (SELECT frete FROM public.cat_pedidos WHERE id = ped_a) <> 10
       OR (SELECT total FROM public.cat_pedidos WHERE id = ped_a) <> 339 THEN
      RAISE EXCEPTION 'pedido não marcado como confirmado';
    END IF;
    SELECT * INTO r FROM public.contatos WHERE id = (SELECT contato_id FROM public.vendas WHERE id = venda_a);
    IF r.origem <> 'loja' OR r.origem_cadastro <> 'loja' OR r.logradouro <> 'Rua Teste' OR r.telefone <> '11900001701'
       OR r.created_by IS DISTINCT FROM c_uid_teste THEN
      RAISE EXCEPTION 'contato novo = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L7 confirmar Pix + frete 10 = 339', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L7 confirmar Pix + frete 10 = 339', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L8: confirmar de novo devolve a mesma venda (idempotente) ──
  casos := casos + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.vendas;
    venda_x := public.loja_confirmar_pedido(ped_a, 99, current_date + 5, 'cartao');
    IF venda_x IS DISTINCT FROM venda_a OR (SELECT count(*) FROM public.vendas) <> n
       OR (SELECT total FROM public.vendas WHERE id = venda_a) <> 339 THEN
      RAISE EXCEPTION 'segunda confirmação mexeu na venda';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L8 confirmar duas vezes = uma venda', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L8 confirmar duas vezes = uma venda', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L9: pagamento e entrega da venda não devolvem o pedido para a fila ──
  casos := casos + 1;
  BEGIN
    UPDATE public.vendas SET pago = true WHERE id = venda_a;
    IF (SELECT status FROM public.cat_pedidos WHERE id = ped_a) <> 'confirmado'
       OR (SELECT status_pagamento FROM public.cat_pedidos WHERE id = ped_a) <> 'pago' THEN
      RAISE EXCEPTION 'pago: pedido ficou %', (SELECT status FROM public.cat_pedidos WHERE id = ped_a);
    END IF;
    UPDATE public.vendas SET status = 'entregue' WHERE id = venda_a;
    IF (SELECT status FROM public.cat_pedidos WHERE id = ped_a) <> 'entregue' THEN
      RAISE EXCEPTION 'entregue: pedido ficou %', (SELECT status FROM public.cat_pedidos WHERE id = ped_a);
    END IF;
    IF EXISTS (SELECT 1 FROM public.vendas WHERE cat_pedido_id = ped_a AND id <> venda_a) THEN
      RAISE EXCEPTION 'entrega gerou outra venda';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L9 pago/entregue sincronizam sem rebaixar', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L9 pago/entregue sincronizam sem rebaixar', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L10: cartão usa a tabela do cartão: balde 68 + Dupla Zero 78 = 146 ──
  casos := casos + 1;
  BEGIN
    venda_b := public.loja_confirmar_pedido(ped_b, 0, current_date, 'cartao');
    SELECT * INTO r FROM public.vendas WHERE id = venda_b;
    IF r.total <> 146 OR r.tabela_preco <> 'cartao' OR r.forma_pagamento <> 'cartao' THEN
      RAISE EXCEPTION 'venda cartão = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L10 cartão = 146 (tabela do cartão)', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L10 cartão = 146 (tabela do cartão)', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L11: dinheiro marca "receber na entrega" ──
  casos := casos + 1;
  BEGIN
    venda_x := public.loja_confirmar_pedido(ped_c, 5, current_date, 'dinheiro');
    IF NOT (SELECT dinheiro_na_entrega FROM public.vendas WHERE id = venda_x)
       OR (SELECT total FROM public.vendas WHERE id = venda_x) <> 70 THEN
      RAISE EXCEPTION 'dinheiro: %', (SELECT row_to_json(v) FROM public.vendas v WHERE v.id = venda_x);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L11 dinheiro = receber na entrega', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L11 dinheiro = receber na entrega', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L12: descartar; descartado não confirma; pedido com venda não descarta ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.loja_descartar_pedido(ped_a);
      RAISE EXCEPTION 'descartou pedido que já é venda';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%já virou venda%' THEN RAISE EXCEPTION 'descartar A: %', SQLERRM; END IF;
    END;
    PERFORM public.loja_descartar_pedido(ped_d);
    PERFORM public.loja_descartar_pedido(ped_d);
    IF (SELECT status FROM public.cat_pedidos WHERE id = ped_d) <> 'cancelado' THEN RAISE EXCEPTION 'não descartou'; END IF;
    BEGIN
      PERFORM public.loja_confirmar_pedido(ped_d, 0, current_date, 'pix');
      RAISE EXCEPTION 'confirmou pedido descartado';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%descartado%' THEN RAISE EXCEPTION 'confirmar D: %', SQLERRM; END IF;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L12 descartar', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L12 descartar', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L13: preço do momento do pedido, mesmo com a campanha já encerrada ──
  casos := casos + 1;
  BEGIN
    RESET ROLE;
    UPDATE public.cat_pedidos SET status = 'pendente', criado_em = now() - interval '2 days' WHERE id = ped_d;
    UPDATE public.loja_campanhas SET inicio = now() - interval '10 days', fim = now() - interval '1 day' WHERE id = v_campanha;
    SET LOCAL ROLE authenticated;
    venda_d := public.loja_confirmar_pedido(ped_d, 0, current_date, 'pix');
    IF (SELECT total FROM public.vendas WHERE id = venda_d) <> 85 THEN
      RAISE EXCEPTION 'Par Mineiro saiu por % (esperado 85, preço do pedido)', (SELECT total FROM public.vendas WHERE id = venda_d);
    END IF;
    RESET ROLE;
    UPDATE public.loja_campanhas SET inicio = now() - interval '1 day', fim = now() + interval '20 days' WHERE id = v_campanha;
    SET LOCAL ROLE authenticated;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L13 preço do momento do pedido', 'ok', true);
  EXCEPTION WHEN others THEN
    SET LOCAL ROLE authenticated;
    resultados := resultados || jsonb_build_object('caso', 'L13 preço do momento do pedido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L14: contato existente: só preenche vazios (endereço antigo fica) ──
  casos := casos + 1;
  BEGIN
    venda_e := public.loja_confirmar_pedido(ped_e, 0, current_date, 'pix');
    SELECT * INTO r FROM public.contatos WHERE id = v_contato_e;
    IF (SELECT contato_id FROM public.vendas WHERE id = venda_e) <> v_contato_e THEN RAISE EXCEPTION 'não ligou ao contato existente'; END IF;
    IF r.logradouro <> 'Rua Antiga' OR r.numero <> '9' OR r.nome <> 'Cliente E antigo' OR r.origem <> 'direto' THEN
      RAISE EXCEPTION 'sobrescreveu o contato: %', row_to_json(r);
    END IF;
    IF r.bairro IS DISTINCT FROM 'Rudge Ramos' OR r.cep IS DISTINCT FROM '09750000' THEN
      RAISE EXCEPTION 'não preencheu o vazio: bairro=% cep=%', r.bairro, r.cep;
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L14 contato existente: só preenche vazios', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L14 contato existente: só preenche vazios', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L15: excluir a venda devolve o pedido para a fila ──
  casos := casos + 1;
  BEGIN
    DELETE FROM public.itens_venda WHERE venda_id = venda_e;
    DELETE FROM public.vendas WHERE id = venda_e;
    IF (SELECT status FROM public.cat_pedidos WHERE id = ped_e) <> 'pendente' THEN
      RAISE EXCEPTION 'pedido ficou %', (SELECT status FROM public.cat_pedidos WHERE id = ped_e);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L15 excluir venda devolve o pedido', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L15 excluir venda devolve o pedido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L16: confirmar de novo trocando o endereço do cadastro pelo do pedido ──
  casos := casos + 1;
  BEGIN
    venda_x := public.loja_confirmar_pedido(ped_e, 0, current_date, 'pix', true);
    IF venda_x IS NULL OR venda_x = venda_e THEN RAISE EXCEPTION 'não criou a venda nova'; END IF;
    SELECT * INTO r FROM public.contatos WHERE id = v_contato_e;
    IF r.logradouro <> 'Rua Nova' OR r.numero <> '50' OR r.cidade <> 'São Bernardo do Campo' THEN
      RAISE EXCEPTION 'endereço não trocado: %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L16 reconfirmar trocando o endereço', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L16 reconfirmar trocando o endereço', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% loja_pedido %/% | contagens_antes=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, antes, resultados;
END
$suite$;

-- Contagens para rodar antes e depois (têm que bater):
-- SELECT (SELECT count(*) FROM public.contatos) contatos, (SELECT count(*) FROM public.vendas) vendas,
--        (SELECT count(*) FROM public.itens_venda) itens_venda, (SELECT count(*) FROM public.cat_pedidos) cat_pedidos,
--        (SELECT count(*) FROM public.cat_itens_pedido) cat_itens_pedido,
--        (SELECT count(*) FROM public.cat_pedidos_pendentes_vinculacao) pendentes_vinculacao,
--        (SELECT count(*) FROM public.meta_eventos) meta_eventos, (SELECT sum(estoque_atual) FROM public.produtos) estoque_total,
--        (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq) numero_pedido_seq;
