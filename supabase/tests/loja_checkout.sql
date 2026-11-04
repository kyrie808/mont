-- Suíte: checkout da loja — retirada, frete estimado, pagamento preferido e "indicado por"
-- (Parte F da paridade, migração 20261104121343, 04/11/2026).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION; nada é gravado.
-- cat_pedidos.numero_pedido usa uma sequência temporária (nextval escapa do rollback).
-- Pedidos criados como o servidor da loja (service_role); confirmados como a CONTA-TESTE (admin).
-- Telefones fictícios com o prefixo 119000020.
--   SUITE_OK     loja_checkout 8/8 | [...]

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_tel constant text := '119000020';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;

  v_balde uuid;
  v_faixa numeric;
  itens jsonb;
  ped_ret uuid; ped_ent uuid; ped_ind uuid; ped_x uuid;
  venda uuid;
  v_indicador uuid;
  v_contato uuid;
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

  SELECT id INTO v_balde FROM public.produtos WHERE codigo = 'balde_pao_queijo_1kg' AND ativo AND visivel_catalogo;
  SELECT (f ->> 'valorFixo')::numeric INTO v_faixa
    FROM public.configuracoes c, jsonb_array_elements(c.valor -> 'faixas') f
   WHERE c.chave = 'frete_config' LIMIT 1;
  IF v_balde IS NULL OR v_faixa IS NULL THEN RAISE EXCEPTION 'SUITE_ABORTADA: balde ou faixa de frete não encontrados'; END IF;
  itens := jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1));

  -- ── Ajustes de cenário (descartados no fim) ──
  UPDATE public.produtos SET esgotado = false WHERE id = v_balde;
  CREATE SEQUENCE public.tmp_suite_loja_checkout_seq START 930001;
  ALTER TABLE public.cat_pedidos ALTER COLUMN numero_pedido SET DEFAULT nextval('public.tmp_suite_loja_checkout_seq');

  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;

  -- ── F1: retirada sem endereço; sem frete estimado mesmo se vier um ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_ret FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente Retira', c_tel || '01', '', '', '', '', '', '', '', itens, false, NULL, NULL,
      'retirada', 'dinheiro', NULL, v_faixa) lp;
    SELECT * INTO r FROM public.cat_pedidos WHERE id = ped_ret;
    IF r.metodo_entrega <> 'retirada' OR r.endereco_entrega IS NOT NULL OR r.cep IS NOT NULL OR r.logradouro IS NOT NULL
       OR r.frete_estimado IS NOT NULL OR r.metodo_pagamento <> 'dinheiro' THEN
      RAISE EXCEPTION 'retirada = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F1 retirada sem endereço e sem frete', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F1 retirada sem endereço e sem frete', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F2: entrega: frete estimado da faixa grava; valor fora das faixas vira "a combinar" sem recusar ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_ent FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente Entrega', c_tel || '02', '09750000', 'Rua Teste', '10', NULL, 'Centro',
      'São Bernardo do Campo', 'SP', itens, false, NULL, NULL, 'entrega', 'pix', NULL, v_faixa) lp;
    IF (SELECT frete_estimado FROM public.cat_pedidos WHERE id = ped_ent) IS DISTINCT FROM v_faixa
       OR (SELECT metodo_entrega FROM public.cat_pedidos WHERE id = ped_ent) <> 'entrega' THEN
      RAISE EXCEPTION 'frete da faixa não gravou';
    END IF;
    SELECT lp.pedido_id INTO ped_x FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente Entrega', c_tel || '03', '09750000', 'Rua Teste', '10', NULL, NULL,
      'São Bernardo do Campo', 'SP', itens, false, NULL, NULL, 'entrega', NULL, NULL, 7.77) lp;
    IF (SELECT frete_estimado FROM public.cat_pedidos WHERE id = ped_x) IS NOT NULL THEN
      RAISE EXCEPTION 'aceitou frete fora das faixas';
    END IF;
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(
        gen_random_uuid(), 'Cliente Entrega', c_tel || '04', '', '', '', '', '', '', '', itens, false, NULL, NULL,
        'entrega', NULL, NULL, NULL);
      RAISE EXCEPTION 'entrega sem endereço passou';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'CEP inválido' THEN RAISE EXCEPTION 'mensagem = %', SQLERRM; END IF;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F2 frete estimado só das faixas; entrega exige endereço', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F2 frete estimado só das faixas; entrega exige endereço', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F3: pagamento e entrega com valor desconhecido são recusados ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(gen_random_uuid(), 'Fulano', c_tel || '05', '', '', '', '', '', '', '',
        itens, false, NULL, NULL, 'retirada', 'boleto', NULL, NULL);
      RAISE EXCEPTION 'aceitou pagamento desconhecido';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'Forma de pagamento inválida' THEN RAISE EXCEPTION 'pagamento: %', SQLERRM; END IF;
    END;
    BEGIN
      PERFORM * FROM public.loja_criar_pedido(gen_random_uuid(), 'Fulano', c_tel || '05', '', '', '', '', '', '', '',
        itens, false, NULL, NULL, 'drone', NULL, NULL, NULL);
      RAISE EXCEPTION 'aceitou entrega desconhecida';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'Forma de entrega inválida' THEN RAISE EXCEPTION 'entrega: %', SQLERRM; END IF;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F3 pagamento e entrega desconhecidos recusados', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F3 pagamento e entrega desconhecidos recusados', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F4: "indicado por" sem espaço sobrando e até 80 letras ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_ind FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente Indicado', c_tel || '06', '', '', '', '', '', '', '', itens, false, NULL, NULL,
      'retirada', 'pix', '   Maria    da   Silva  ', NULL) lp;
    IF (SELECT indicado_por FROM public.cat_pedidos WHERE id = ped_ind) <> 'Maria da Silva' THEN
      RAISE EXCEPTION 'indicado_por = %', (SELECT indicado_por FROM public.cat_pedidos WHERE id = ped_ind);
    END IF;
    SELECT lp.pedido_id INTO ped_x FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Fulano', c_tel || '07', '', '', '', '', '', '', '', itens, false, NULL, NULL,
      'retirada', NULL, repeat('a', 120), NULL) lp;
    IF length((SELECT indicado_por FROM public.cat_pedidos WHERE id = ped_x)) <> 80 THEN
      RAISE EXCEPTION 'não cortou em 80';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F4 indicado por limpo e com limite', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F4 indicado por limpo e com limite', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F5: a chamada da loja que está no ar (sem os argumentos novos) continua valendo, como entrega ──
  casos := casos + 1;
  BEGIN
    SELECT lp.pedido_id INTO ped_x FROM public.loja_criar_pedido(
      p_chave => gen_random_uuid(), p_nome => 'Cliente Antigo', p_telefone => c_tel || '08', p_cep => '09750000',
      p_logradouro => 'Rua Teste', p_numero => '1', p_complemento => '', p_bairro => '', p_cidade => 'São Bernardo do Campo',
      p_uf => 'SP', p_itens => itens, p_ofertas => false, p_ofertas_texto => NULL, p_atribuicao => '{}'::jsonb) lp;
    SELECT * INTO r FROM public.cat_pedidos WHERE id = ped_x;
    IF r.metodo_entrega <> 'entrega' OR r.metodo_pagamento IS NOT NULL OR r.frete_estimado IS NOT NULL THEN
      RAISE EXCEPTION 'chamada antiga = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F5 chamada antiga da loja segue funcionando', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F5 chamada antiga da loja segue funcionando', 'ok', false, 'erro', SQLERRM);
  END;
  RESET ROLE;

  -- Confirmações como a conta-teste (admin), igual ao app.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;
  INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
  VALUES ('Indicadora Suíte', c_tel || '99', 'B2C', 'cliente', 'direto') RETURNING id INTO v_indicador;

  -- ── F6: confirmar retirada: frete 0, sem data de entrega (sem aviso no #ENTREGAS), dia na observação ──
  casos := casos + 1;
  BEGIN
    venda := public.loja_confirmar_pedido(ped_ret, 10, current_date + 1, 'dinheiro');
    SELECT * INTO r FROM public.vendas WHERE id = venda;
    IF r.taxa_entrega <> 0 OR r.data_entrega_prevista IS NOT NULL OR r.dinheiro_na_entrega
       OR r.observacoes NOT LIKE '%Retirada na Mont em ' || to_char(current_date + 1, 'DD/MM') || '%' THEN
      RAISE EXCEPTION 'venda da retirada = %', row_to_json(r);
    END IF;
    SELECT * INTO r FROM public.contatos WHERE id = (SELECT contato_id FROM public.vendas WHERE id = venda);
    IF r.logradouro IS NOT NULL OR r.endereco IS NOT NULL THEN RAISE EXCEPTION 'cadastro ganhou endereço: %', row_to_json(r); END IF;
    IF (SELECT frete FROM public.cat_pedidos WHERE id = ped_ret) <> 0 THEN RAISE EXCEPTION 'frete do pedido não zerou'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F6 confirmar retirada', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F6 confirmar retirada', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F7: entrega continua com frete e data de entrega ──
  casos := casos + 1;
  BEGIN
    venda := public.loja_confirmar_pedido(ped_ent, 5, current_date + 1, 'pix');
    SELECT * INTO r FROM public.vendas WHERE id = venda;
    IF r.taxa_entrega <> 5 OR r.data_entrega_prevista IS DISTINCT FROM current_date + 1 OR r.observacoes LIKE '%Retirada%' THEN
      RAISE EXCEPTION 'venda da entrega = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F7 entrega com frete e data', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F7 entrega com frete e data', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F8: "indicado por" na confirmação liga o cliente a quem indicou (Ranking); não troca quem já tem ──
  casos := casos + 1;
  BEGIN
    venda := public.loja_confirmar_pedido(ped_ind, 0, current_date, 'pix', false, v_indicador);
    v_contato := (SELECT contato_id FROM public.vendas WHERE id = venda);
    IF (SELECT indicado_por_id FROM public.contatos WHERE id = v_contato) IS DISTINCT FROM v_indicador THEN
      RAISE EXCEPTION 'não ligou o indicador';
    END IF;
    -- Pedido novo do mesmo cliente, "indicado" por ele mesmo: recusa.
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
    SET LOCAL ROLE service_role;
    SELECT lp.pedido_id INTO ped_x FROM public.loja_criar_pedido(
      gen_random_uuid(), 'Cliente Indicado', c_tel || '06', '', '', '', '', '', '', '', itens, false, NULL, NULL,
      'retirada', 'pix', NULL, NULL) lp;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.loja_confirmar_pedido(ped_x, 0, current_date, 'pix', false, v_contato);
      RAISE EXCEPTION 'aceitou o cliente indicando ele mesmo';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%ele mesmo%' THEN RAISE EXCEPTION 'auto-indicação: %', SQLERRM; END IF;
    END;
    -- Com outro indicador, quem já tinha continua.
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Outra Indicadora', c_tel || '98', 'B2C', 'cliente', 'direto') RETURNING id INTO r;
    PERFORM public.loja_confirmar_pedido(ped_x, 0, current_date, 'pix', false, (SELECT id FROM public.contatos WHERE telefone = c_tel || '98'));
    IF (SELECT indicado_por_id FROM public.contatos WHERE id = v_contato) IS DISTINCT FROM v_indicador THEN
      RAISE EXCEPTION 'trocou o indicador que já existia';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F8 indicado por liga no Ranking sem sobrescrever', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F8 indicado por liga no Ranking sem sobrescrever', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% loja_checkout %/% | contagens_antes=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, antes, resultados;
END
$suite$;

-- Contagens para rodar antes e depois (têm que bater):
-- SELECT (SELECT count(*) FROM public.contatos) contatos, (SELECT count(*) FROM public.vendas) vendas,
--        (SELECT count(*) FROM public.cat_pedidos) cat_pedidos,
--        (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq) numero_pedido_seq;
