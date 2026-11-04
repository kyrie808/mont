-- Suíte: a loja vende pelo CADASTRO do sistema interno (Parte A da paridade, 02/11/2026).
-- Regra: produto ativo + "Visível no catálogo" vale na loja sem linha em loja_vitrine;
-- loja_vitrine é complemento opcional (esgotado, nome, seção/ordem só da loja...).
-- Combo de campanha aparece/vende só durante a campanha (mesmo sem "Visível no catálogo").
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION; nada é gravado,
-- nem os ajustes de cenário. cat_pedidos.numero_pedido usa uma sequência temporária (nextval escapa
-- do rollback). Pedidos criados como o servidor da loja (service_role). Telefones fictícios 119000018xx.
--   SUITE_OK     loja_vitrine_cadastro 9/9 | [...]

DO $suite$
DECLARE
  c_tel constant text := '119000018';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;

  v_campanha uuid;
  v_chipa uuid; v_baldinho uuid; v_mesa uuid; v_dupla uuid; v_dl680 uuid;
  v_permanente uuid;
  r record;
  n int;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'cat_pedidos', (SELECT count(*) FROM public.cat_pedidos),
    'cat_itens_pedido', (SELECT count(*) FROM public.cat_itens_pedido),
    'produtos', (SELECT count(*) FROM public.produtos),
    'loja_vitrine', (SELECT count(*) FROM public.loja_vitrine),
    'campanha', (SELECT jsonb_agg(jsonb_build_array(ativa, inicio, fim)) FROM public.loja_campanhas),
    'numero_pedido_seq', (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%')
     OR EXISTS (SELECT 1 FROM public.cat_pedidos WHERE telefone_cliente LIKE c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato/pedido com o prefixo fictício %', c_tel;
  END IF;

  SELECT id INTO v_campanha FROM public.loja_campanhas WHERE nome = 'Black da Mont 2026';
  SELECT id INTO v_chipa FROM public.produtos WHERE nome = 'Chipa 1kg' AND ativo;
  SELECT id INTO v_baldinho FROM public.produtos WHERE codigo = 'balde_pao_queijo_1kg';
  SELECT id INTO v_dl680 FROM public.produtos WHERE codigo = 'doce_leite_tradicional_680g';
  SELECT id INTO v_mesa FROM public.produtos WHERE codigo = 'combo_black_familia';
  SELECT id INTO v_dupla FROM public.produtos WHERE codigo = 'combo_black_dupla_zero';
  IF v_campanha IS NULL OR v_chipa IS NULL OR v_baldinho IS NULL OR v_dl680 IS NULL
     OR v_mesa IS NULL OR v_dupla IS NULL THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: produtos do cenário não encontrados';
  END IF;
  IF EXISTS (SELECT 1 FROM public.loja_vitrine WHERE produto_id = v_chipa) THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: a Chipa 1kg já tem linha na vitrine; o cenário pede um produto só do cadastro';
  END IF;

  -- ── Ajustes de cenário (descartados no fim) ──
  -- Campanha pausada no início (como está hoje); V6 liga.
  UPDATE public.loja_campanhas SET ativa = false WHERE id = v_campanha;
  -- A Chipa começa visível no catálogo (V1); V2 a esconde. O teste não depende do estado real dela.
  UPDATE public.produtos SET visivel_catalogo = true WHERE id = v_chipa;
  CREATE SEQUENCE public.tmp_suite_loja_vitrine_seq START 910001;
  ALTER TABLE public.cat_pedidos ALTER COLUMN numero_pedido SET DEFAULT nextval('public.tmp_suite_loja_vitrine_seq');
  -- Combo permanente de teste: 2 baldinhos por R$ 50, visível no catálogo, fora de qualquer campanha.
  INSERT INTO public.produtos (nome, codigo, preco, custo, unidade, ativo, visivel_catalogo, eh_combo, categoria)
  VALUES ('Combo Suíte Permanente', 'combo_suite_permanente', 50, 0, 'un', true, true, true, 'combo')
  RETURNING id INTO v_permanente;
  INSERT INTO public.produto_componentes (combo_id, componente_id, quantidade) VALUES (v_permanente, v_baldinho, 2);

  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;

  -- V1: congelado visível no catálogo, SEM linha na vitrine, entra pelo preço do cadastro.
  casos := casos + 1;
  BEGIN
    SELECT * INTO r FROM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '01', '09750000',
      'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
      jsonb_build_array(jsonb_build_object('produto_id', v_chipa, 'quantidade', 2)), false, NULL);
    IF r.total <> 2 * (SELECT preco FROM public.produtos WHERE id = v_chipa) THEN
      RAISE EXCEPTION 'total = %', r.total;
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V1 produto só do cadastro vende', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V1 produto só do cadastro vende', 'ok', false, 'erro', SQLERRM);
  END;

  -- V2: "Visível no catálogo" desligado: recusado.
  casos := casos + 1;
  BEGIN
    RESET ROLE;
    UPDATE public.produtos SET visivel_catalogo = false WHERE id = v_chipa;
    SET LOCAL ROLE service_role;
    BEGIN
      PERFORM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '02', '09750000',
        'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
        jsonb_build_array(jsonb_build_object('produto_id', v_chipa, 'quantidade', 1)), false, NULL);
      RAISE EXCEPTION 'aceitou produto escondido';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'Produto indisponível' THEN RAISE EXCEPTION 'mensagem = %', SQLERRM; END IF;
    END;
    RESET ROLE;
    UPDATE public.produtos SET visivel_catalogo = true WHERE id = v_chipa;
    SET LOCAL ROLE service_role;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V2 escondido no cadastro é recusado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V2 escondido no cadastro é recusado', 'ok', false, 'erro', SQLERRM);
  END;

  -- V3: produto inativo: recusado.
  casos := casos + 1;
  BEGIN
    RESET ROLE;
    UPDATE public.produtos SET ativo = false WHERE id = v_chipa;
    SET LOCAL ROLE service_role;
    BEGIN
      PERFORM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '03', '09750000',
        'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
        jsonb_build_array(jsonb_build_object('produto_id', v_chipa, 'quantidade', 1)), false, NULL);
      RAISE EXCEPTION 'aceitou produto inativo';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
    RESET ROLE;
    UPDATE public.produtos SET ativo = true WHERE id = v_chipa;
    SET LOCAL ROLE service_role;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V3 inativo é recusado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V3 inativo é recusado', 'ok', false, 'erro', SQLERRM);
  END;

  -- V4: linha da vitrine só com o mínimo: valores padrão valem (visível, disponível, sem seção própria).
  casos := casos + 1;
  BEGIN
    RESET ROLE;
    INSERT INTO public.loja_vitrine (produto_id) VALUES (v_chipa);
    SELECT * INTO r FROM public.loja_vitrine WHERE produto_id = v_chipa;
    SET LOCAL ROLE service_role;
    IF NOT r.visivel OR NOT r.disponivel OR r.secao_id IS NOT NULL OR r.ordem_loja IS NOT NULL THEN
      RAISE EXCEPTION 'linha mínima = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V4 linha mínima com padrões', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V4 linha mínima com padrões', 'ok', false, 'erro', SQLERRM);
  END;

  -- V5: marcado "Esgotado" na vitrine: recusado; a mesma marca numa linha desligada (visivel=false) é ignorada.
  casos := casos + 1;
  BEGIN
    RESET ROLE;
    INSERT INTO public.loja_vitrine (produto_id, disponivel) VALUES (v_chipa, false)
      ON CONFLICT (produto_id) DO UPDATE SET disponivel = false, visivel = true;
    SET LOCAL ROLE service_role;
    BEGIN
      PERFORM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '05', '09750000',
        'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
        jsonb_build_array(jsonb_build_object('produto_id', v_chipa, 'quantidade', 1)), false, NULL);
      RAISE EXCEPTION 'aceitou produto esgotado';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
    RESET ROLE;
    UPDATE public.loja_vitrine SET visivel = false WHERE produto_id = v_chipa;
    SET LOCAL ROLE service_role;
    SELECT * INTO r FROM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '06', '09750000',
      'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
      jsonb_build_array(jsonb_build_object('produto_id', v_chipa, 'quantidade', 1)), false, NULL);
    IF r.pedido_id IS NULL THEN RAISE EXCEPTION 'linha desligada bloqueou o pedido'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V5 esgotado recusa; linha desligada não vale', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V5 esgotado recusa; linha desligada não vale', 'ok', false, 'erro', SQLERRM);
  END;

  -- V6: combo de campanha com a campanha pausada: recusado.
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '07', '09750000',
        'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
        jsonb_build_array(jsonb_build_object('combo_id', v_dupla, 'escolhas', '[]'::jsonb)), false, NULL);
      RAISE EXCEPTION 'vendeu combo da campanha pausada';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V6 combo da campanha pausada é recusado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V6 combo da campanha pausada é recusado', 'ok', false, 'erro', SQLERRM);
  END;

  -- V7: campanha valendo: o combo dela vende sem "Visível no catálogo", com o preço da campanha.
  casos := casos + 1;
  BEGIN
    RESET ROLE;
    UPDATE public.loja_campanhas SET ativa = true, inicio = now() - interval '1 day', fim = now() + interval '1 day'
     WHERE id = v_campanha;
    SET LOCAL ROLE service_role;
    IF (SELECT visivel_catalogo FROM public.produtos WHERE id = v_dupla) THEN
      RAISE EXCEPTION 'cenário: a Dupla Zero deveria estar fora do catálogo';
    END IF;
    SELECT * INTO r FROM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '08', '09750000',
      'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
      jsonb_build_array(jsonb_build_object('combo_id', v_dupla, 'escolhas', '[]'::jsonb)), false, NULL);
    IF r.total <> (SELECT preco_pix FROM public.loja_precos WHERE campanha_id = v_campanha AND produto_id = v_dupla) THEN
      RAISE EXCEPTION 'total = %', r.total;
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V7 combo da campanha vende na campanha', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V7 combo da campanha vende na campanha', 'ok', false, 'erro', SQLERRM);
  END;

  -- V8: combo permanente (fora de campanha) vende pelo preço do cadastro, rateado nos componentes.
  casos := casos + 1;
  BEGIN
    SELECT * INTO r FROM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '09', '09750000',
      'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
      jsonb_build_array(jsonb_build_object('combo_id', v_permanente, 'escolhas', '[]'::jsonb)), false, NULL);
    IF r.total <> 50 THEN RAISE EXCEPTION 'total = %', r.total; END IF;
    SELECT count(*) INTO n FROM public.cat_itens_pedido
     WHERE pedido_id = r.pedido_id AND combo_id = v_permanente AND produto_id = v_baldinho AND quantidade = 2;
    IF n <> 1 THEN RAISE EXCEPTION 'componentes não viraram itens'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V8 combo permanente pelo cadastro', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V8 combo permanente pelo cadastro', 'ok', false, 'erro', SQLERRM);
  END;

  -- V9: combo permanente escondido no catálogo: recusado.
  casos := casos + 1;
  BEGIN
    RESET ROLE;
    UPDATE public.produtos SET visivel_catalogo = false WHERE id = v_permanente;
    SET LOCAL ROLE service_role;
    BEGIN
      PERFORM public.loja_criar_pedido(gen_random_uuid(), 'Cliente Suíte', c_tel || '10', '09750000',
        'Rua Teste', '1', NULL, NULL, 'São Bernardo do Campo', 'SP',
        jsonb_build_array(jsonb_build_object('combo_id', v_permanente, 'escolhas', '[]'::jsonb)), false, NULL);
      RAISE EXCEPTION 'vendeu combo escondido';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'V9 combo permanente escondido é recusado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'V9 combo permanente escondido é recusado', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% loja_vitrine_cadastro %/% | contagens_antes=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, antes, resultados;
END
$suite$;

-- Contagens para rodar antes e depois (têm que bater):
-- SELECT (SELECT count(*) FROM public.contatos) contatos, (SELECT count(*) FROM public.cat_pedidos) cat_pedidos,
--        (SELECT count(*) FROM public.cat_itens_pedido) cat_itens_pedido, (SELECT count(*) FROM public.produtos) produtos,
--        (SELECT count(*) FROM public.loja_vitrine) loja_vitrine,
--        (SELECT jsonb_agg(jsonb_build_array(ativa, inicio, fim)) FROM public.loja_campanhas) campanha,
--        (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq) numero_pedido_seq;
