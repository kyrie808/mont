-- Suíte: preço de campanha + função comum de combo + criar_venda com tabela
-- (migration combos_preco_campanha_nova_venda, bloco B de 30/10/2026).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION. Nada é
-- gravado — nem as vendas de teste, nem a baixa de estoque, nem o evento da Meta, nem os
-- AJUSTES DE CENÁRIO abaixo (campanha antecipada e sabores fictícios nos grupos). Os grupos
-- de sabor reais continuam vazios até a decisão do Gilmar.
--   SUITE_OK     combos_preco_campanha 18/18 | [...]
--   SUITE_FALHOU combos_preco_campanha 17/18 | [...]
--
-- Cenário (só dentro da transação):
--   * a campanha "Black da Mont 2026" passa a valer desde ontem (para testar o preço Black hoje);
--   * os 3 grupos de doce 680 g recebem 4 sabores; o grupo do "3 doces" vira sem repetição
--     só para o caso que testa essa regra.
-- Roda como o dono do banco no preparo e como a CONTA-TESTE (admin) nas chamadas de venda,
-- igual ao app: `criar_venda` checa is_admin(), e `created_by` sai com o uid dela.

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_tel constant text := '119000016';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;

  v_campanha uuid;
  v_balde uuid; v_baldinho uuid;
  v_dl uuid; v_coco uuid; v_cocada uuid; v_milho uuid;
  v_dl_zero uuid; v_brig_zero uuid;
  v_familia uuid; v_balde_doce uuid; v_tres uuid; v_dupla uuid;
  g_familia uuid; g_balde_doce uuid; g_tres uuid;
  v_contato uuid;
  v_venda uuid;
  v_escolhas_familia jsonb;
  n int;
  x numeric;
  r record;
  est_antes jsonb;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'vendas', (SELECT count(*) FROM public.vendas),
    'itens_venda', (SELECT count(*) FROM public.itens_venda),
    'meta_eventos', (SELECT count(*) FROM public.meta_eventos),
    'combo_grupo_opcoes', (SELECT count(*) FROM public.combo_grupo_opcoes),
    'estoque_total', (SELECT sum(estoque_atual) FROM public.produtos),
    'campanha_inicio', (SELECT min(inicio) FROM public.loja_campanhas)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato com o prefixo fictício %', c_tel;
  END IF;

  -- ── Identificadores (por nome; o seed da Black usa estes nomes) ──
  SELECT id INTO v_campanha FROM public.loja_campanhas WHERE nome = 'Black da Mont 2026';
  SELECT id INTO v_balde FROM public.produtos WHERE nome = 'Massa Pão de Queijo 4kg';
  SELECT id INTO v_baldinho FROM public.produtos WHERE nome = 'Massa Pão de Queijo 1kg';
  SELECT id INTO v_dl FROM public.produtos WHERE nome = 'Doce de Leite Tradicional 680g';
  SELECT id INTO v_coco FROM public.produtos WHERE nome = 'Doce de Leite com Coco 680g';
  SELECT id INTO v_cocada FROM public.produtos WHERE nome = 'Cocada Cremosa 680g';
  SELECT id INTO v_milho FROM public.produtos WHERE nome = 'Doce de Milho 680g';
  SELECT id INTO v_dl_zero FROM public.produtos WHERE nome = 'Doce de Leite Zero 400g';
  SELECT id INTO v_brig_zero FROM public.produtos WHERE nome = 'Brigadeiro de Colher Zero 400g';
  SELECT id INTO v_familia FROM public.produtos WHERE nome = 'Combo Família (Black)';
  SELECT id INTO v_balde_doce FROM public.produtos WHERE nome = 'Balde + doce (Black)';
  SELECT id INTO v_tres FROM public.produtos WHERE nome = '3 doces (Black)';
  SELECT id INTO v_dupla FROM public.produtos WHERE nome = 'Dupla Zero (Black)';
  SELECT id INTO g_familia FROM public.combo_grupos WHERE combo_id = v_familia;
  SELECT id INTO g_balde_doce FROM public.combo_grupos WHERE combo_id = v_balde_doce;
  SELECT id INTO g_tres FROM public.combo_grupos WHERE combo_id = v_tres;

  IF v_campanha IS NULL OR v_balde IS NULL OR v_familia IS NULL OR g_familia IS NULL OR v_dupla IS NULL THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: cenário da Black não encontrado';
  END IF;

  -- ── C1 (antes do preparo): grupo sem sabores recusa ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM * FROM public.combo_itens(v_balde_doce,
        jsonb_build_array(jsonb_build_object('grupo_id', g_balde_doce, 'produto_id', v_dl, 'quantidade', 1)), 'normal');
      RAISE EXCEPTION 'aceitou combo com grupo sem sabores';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%ainda não foram definidos%' THEN RAISE EXCEPTION 'mensagem: %', SQLERRM; END IF;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C1 grupo sem sabores recusa', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C1 grupo sem sabores recusa', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── Preparo do cenário (descartado no fim) ──
  UPDATE public.loja_campanhas SET inicio = now() - interval '1 day' WHERE id = v_campanha;
  INSERT INTO public.combo_grupo_opcoes (grupo_id, produto_id, ordem)
  SELECT g, p, o
    FROM unnest(ARRAY[g_familia, g_balde_doce, g_tres]) g
   CROSS JOIN LATERAL unnest(ARRAY[v_dl, v_coco, v_cocada, v_milho]) WITH ORDINALITY AS t(p, o);

  v_escolhas_familia := jsonb_build_array(
    jsonb_build_object('grupo_id', g_familia, 'produto_id', v_dl, 'quantidade', 2),
    jsonb_build_object('grupo_id', g_familia, 'produto_id', v_coco, 'quantidade', 2),
    jsonb_build_object('grupo_id', g_familia, 'produto_id', v_cocada, 'quantidade', 1),
    jsonb_build_object('grupo_id', g_familia, 'produto_id', v_milho, 'quantidade', 1));

  -- ── C2: preço por tabela durante a campanha ──
  casos := casos + 1;
  BEGIN
    IF public.preco_tabela(v_balde, 'pix') <> 65 THEN RAISE EXCEPTION 'pix = %', public.preco_tabela(v_balde, 'pix'); END IF;
    IF public.preco_tabela(v_balde, 'cartao') <> 68 THEN RAISE EXCEPTION 'cartao = %', public.preco_tabela(v_balde, 'cartao'); END IF;
    IF public.preco_tabela(v_balde, 'normal') <> 75 THEN RAISE EXCEPTION 'normal = %', public.preco_tabela(v_balde, 'normal'); END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C2 balde 65/68/75 na campanha', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C2 balde 65/68/75 na campanha', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C3: fora da campanha, pix e cartão caem no preço normal ──
  casos := casos + 1;
  BEGIN
    IF public.preco_tabela(v_balde, 'pix', '2026-12-15') <> 75 THEN RAISE EXCEPTION 'pix fora = %', public.preco_tabela(v_balde, 'pix', '2026-12-15'); END IF;
    IF public.preco_tabela(v_balde, 'cartao', '2026-12-15') <> 75 THEN RAISE EXCEPTION 'cartao fora'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C3 fora da campanha = normal', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C3 fora da campanha = normal', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C4: precos_vigentes devolve o mesmo que preco_tabela + a campanha ──
  casos := casos + 1;
  BEGIN
    SELECT * INTO r FROM public.precos_vigentes() pv WHERE pv.produto_id = v_balde;
    IF r.normal <> 75 OR r.pix <> 65 OR r.cartao <> 68 OR r.campanha IS DISTINCT FROM 'Black da Mont 2026' THEN
      RAISE EXCEPTION 'linha = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C4 precos_vigentes coerente', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C4 precos_vigentes coerente', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C5: Combo Família no Pix fecha em 199,00, sabores como itens, unitário × qtd exato ──
  casos := casos + 1;
  BEGIN
    SELECT sum(ci.subtotal), count(DISTINCT ci.produto_id) INTO x, n
      FROM public.combo_itens(v_familia, v_escolhas_familia, 'pix') ci;
    IF x <> 199.00 THEN RAISE EXCEPTION 'soma = %', x; END IF;
    IF n <> 6 THEN RAISE EXCEPTION 'produtos distintos = % (esperado 6: balde, baldinho e 4 sabores)', n; END IF;
    IF EXISTS (SELECT 1 FROM public.combo_itens(v_familia, v_escolhas_familia, 'pix') ci
                WHERE ci.preco_unitario * ci.quantidade <> ci.subtotal
                   OR ci.preco_unitario <> round(ci.preco_unitario, 2)) THEN
      RAISE EXCEPTION 'linha com unitário × quantidade diferente do subtotal';
    END IF;
    SELECT sum(ci.quantidade) INTO x FROM public.combo_itens(v_familia, v_escolhas_familia, 'pix') ci WHERE ci.produto_id = v_baldinho;
    IF x <> 2 THEN RAISE EXCEPTION 'baldinho qtd = %', x; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C5 Combo Família 199,00 rateado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C5 Combo Família 199,00 rateado', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C6: 3 doces iguais a 79,00 → 1 × 26,34 + 2 × 26,33 ──
  casos := casos + 1;
  BEGIN
    SELECT sum(ci.subtotal), count(*) INTO x, n FROM public.combo_itens(v_tres,
      jsonb_build_array(jsonb_build_object('grupo_id', g_tres, 'produto_id', v_dl, 'quantidade', 3)), 'pix') ci;
    IF x <> 79.00 OR n <> 2 THEN RAISE EXCEPTION 'soma = %, linhas = %', x, n; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.combo_itens(v_tres,
      jsonb_build_array(jsonb_build_object('grupo_id', g_tres, 'produto_id', v_dl, 'quantidade', 3)), 'pix') ci
       WHERE ci.quantidade = 1 AND ci.preco_unitario = 26.34) THEN
      RAISE EXCEPTION 'faltou a linha 1 × 26,34';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C6 centavos exatos 79 = 26,34 + 2 × 26,33', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C6 centavos exatos 79 = 26,34 + 2 × 26,33', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C7: grupo incompleto recusa ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM * FROM public.combo_itens(v_familia, v_escolhas_familia - 3, 'pix');
      RAISE EXCEPTION 'aceitou 5 de 6';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%esperados 6%' THEN RAISE EXCEPTION 'mensagem: %', SQLERRM; END IF;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C7 grupo incompleto recusa', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C7 grupo incompleto recusa', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C8: sabor fora das opções recusa (zero 400 g não é doce 680 g) ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM * FROM public.combo_itens(v_balde_doce,
        jsonb_build_array(jsonb_build_object('grupo_id', g_balde_doce, 'produto_id', v_dl_zero, 'quantidade', 1)), 'pix');
      RAISE EXCEPTION 'aceitou sabor fora das opções';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%fora das opções%' THEN RAISE EXCEPTION 'mensagem: %', SQLERRM; END IF;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C8 sabor fora das opções recusa', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C8 sabor fora das opções recusa', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C9: grupo sem repetição recusa sabor repetido ──
  casos := casos + 1;
  BEGIN
    UPDATE public.combo_grupos SET permite_repetir = false WHERE id = g_tres;
    BEGIN
      PERFORM * FROM public.combo_itens(v_tres,
        jsonb_build_array(jsonb_build_object('grupo_id', g_tres, 'produto_id', v_dl, 'quantidade', 3)), 'pix');
      RAISE EXCEPTION 'aceitou repetição';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%não permite repetir%' THEN RAISE EXCEPTION 'mensagem: %', SQLERRM; END IF;
    END;
    UPDATE public.combo_grupos SET permite_repetir = true WHERE id = g_tres;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C9 sem repetição recusa', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C9 sem repetição recusa', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C10: Dupla Zero (fixa) no cartão = 78,00 em 2 itens de 39,00 ──
  casos := casos + 1;
  BEGIN
    SELECT sum(ci.subtotal), count(*) INTO x, n FROM public.combo_itens(v_dupla, '[]'::jsonb, 'cartao') ci;
    IF x <> 78.00 OR n <> 2 THEN RAISE EXCEPTION 'soma = %, linhas = %', x, n; END IF;
    IF EXISTS (SELECT 1 FROM public.combo_itens(v_dupla, '[]'::jsonb, 'cartao') ci WHERE ci.preco_unitario <> 39.00) THEN
      RAISE EXCEPTION 'rateio diferente de 39,00 + 39,00';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C10 Dupla Zero cartão 78 = 39 + 39', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C10 Dupla Zero cartão 78 = 39 + 39', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── Daqui pra frente, como a conta-teste (admin), igual ao app. ──
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;

  INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
  VALUES ('Suite combos', c_tel || '01', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;

  -- ── C11: venda no Pix com 2 baldes + 1 Combo Família = 329 + frete 10 ──
  casos := casos + 1;
  BEGIN
    v_venda := public.criar_venda(
      v_contato, current_date, 'venda', 10,
      jsonb_build_array(
        jsonb_build_object('produto_id', v_balde, 'quantidade', 2, 'preco_unitario', 1, 'subtotal', 2),
        jsonb_build_object('combo_id', v_familia, 'quantidade', 1, 'escolhas', v_escolhas_familia)),
      gen_random_uuid(), p_tabela => 'pix');
    SELECT vd.total INTO x FROM public.vendas vd WHERE vd.id = v_venda;
    IF x <> 339 THEN RAISE EXCEPTION 'total = % (esperado 339: o preço mandado pelo cliente é ignorado)', x; END IF;
    IF (SELECT tabela_preco FROM public.vendas WHERE id = v_venda) IS DISTINCT FROM 'pix' THEN RAISE EXCEPTION 'tabela não gravada'; END IF;
    SELECT count(DISTINCT combo_instancia) INTO n FROM public.itens_venda WHERE venda_id = v_venda AND combo_id = v_familia;
    IF n <> 1 THEN RAISE EXCEPTION 'instâncias = %', n; END IF;
    SELECT sum(subtotal) INTO x FROM public.itens_venda WHERE venda_id = v_venda AND combo_id = v_familia;
    IF x <> 199 THEN RAISE EXCEPTION 'linhas do combo somam %', x; END IF;
    SELECT sum(subtotal) INTO x FROM public.itens_venda WHERE venda_id = v_venda AND combo_id IS NULL;
    IF x <> 130 THEN RAISE EXCEPTION 'avulsos somam %', x; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C11 venda Pix 2 baldes + Família = 339', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C11 venda Pix 2 baldes + Família = 339', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C12: combo com quantidade 2 vira 2 instâncias, total 2 × 206 no cartão ──
  casos := casos + 1;
  BEGIN
    v_venda := public.criar_venda(
      v_contato, current_date, 'venda', 0,
      jsonb_build_array(jsonb_build_object('combo_id', v_familia, 'quantidade', 2, 'escolhas', v_escolhas_familia)),
      gen_random_uuid(), p_tabela => 'cartao');
    SELECT count(DISTINCT combo_instancia) INTO n FROM public.itens_venda WHERE venda_id = v_venda;
    IF n <> 2 THEN RAISE EXCEPTION 'instâncias = %', n; END IF;
    SELECT vd.total INTO x FROM public.vendas vd WHERE vd.id = v_venda;
    IF x <> 412 THEN RAISE EXCEPTION 'total = %', x; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C12 2 Combos Família no cartão = 412', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C12 2 Combos Família no cartão = 412', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C13: fiado só com preço normal ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.criar_venda(v_contato, current_date, 'fiado', 0,
        jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1)),
        gen_random_uuid(), p_data_prevista_pagamento => current_date + 30, p_tabela => 'pix');
      RAISE EXCEPTION 'aceitou fiado no preço Pix';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    v_venda := public.criar_venda(v_contato, current_date, 'fiado', 0,
      jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1)),
      gen_random_uuid(), p_data_prevista_pagamento => current_date + 30, p_tabela => 'normal');
    SELECT vd.total INTO x FROM public.vendas vd WHERE vd.id = v_venda;
    IF x <> 75 THEN RAISE EXCEPTION 'fiado total = %', x; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C13 fiado: recusa Pix, aceita normal = 75', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C13 fiado: recusa Pix, aceita normal = 75', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C14: sem tabela, comportamento antigo (preço do chamador) ──
  casos := casos + 1;
  BEGIN
    v_venda := public.criar_venda(v_contato, current_date, 'venda', 0,
      jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1, 'preco_unitario', 70, 'subtotal', 70)),
      gen_random_uuid());
    SELECT vd.total INTO x FROM public.vendas vd WHERE vd.id = v_venda;
    IF x <> 70 THEN RAISE EXCEPTION 'total = %', x; END IF;
    IF (SELECT tabela_preco FROM public.vendas WHERE id = v_venda) IS NOT NULL THEN RAISE EXCEPTION 'tabela deveria ser nula'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C14 sem tabela = comportamento antigo', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C14 sem tabela = comportamento antigo', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C15: combo sem tabela, ou combo mandado como avulso, recusa ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.criar_venda(v_contato, current_date, 'venda', 0,
        jsonb_build_array(jsonb_build_object('combo_id', v_dupla, 'quantidade', 1, 'escolhas', '[]'::jsonb)),
        gen_random_uuid());
      RAISE EXCEPTION 'aceitou combo sem tabela';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
      PERFORM public.criar_venda(v_contato, current_date, 'venda', 0,
        jsonb_build_array(jsonb_build_object('produto_id', v_dupla, 'quantidade', 1)),
        gen_random_uuid(), p_tabela => 'pix');
      RAISE EXCEPTION 'aceitou combo como avulso';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C15 combo sem tabela / como avulso recusa', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C15 combo sem tabela / como avulso recusa', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C16: venda entregue com combo baixa o estoque de cada item, sabor a sabor ──
  casos := casos + 1;
  BEGIN
    SELECT jsonb_object_agg(id, estoque_atual) INTO est_antes
      FROM public.produtos WHERE id IN (v_balde, v_baldinho, v_dl, v_coco, v_cocada, v_milho, v_familia);
    v_venda := public.criar_venda(v_contato, current_date, 'venda', 0,
      jsonb_build_array(jsonb_build_object('combo_id', v_familia, 'quantidade', 1, 'escolhas', v_escolhas_familia)),
      gen_random_uuid(), p_status => 'entregue', p_tabela => 'pix');
    FOR r IN
      SELECT p.id, p.nome, p.estoque_atual, (est_antes ->> p.id::text)::numeric AS antes_e,
             CASE p.id WHEN v_balde THEN 1 WHEN v_baldinho THEN 2 WHEN v_dl THEN 2 WHEN v_coco THEN 2
                       WHEN v_cocada THEN 1 WHEN v_milho THEN 1 ELSE 0 END AS esperado
        FROM public.produtos p WHERE p.id IN (v_balde, v_baldinho, v_dl, v_coco, v_cocada, v_milho, v_familia)
    LOOP
      IF r.antes_e - r.estoque_atual <> r.esperado THEN
        RAISE EXCEPTION '% baixou %, esperado %', r.nome, r.antes_e - r.estoque_atual, r.esperado;
      END IF;
    END LOOP;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C16 estoque baixa sabor a sabor (combo não baixa)', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C16 estoque baixa sabor a sabor (combo não baixa)', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C17: replace_combo_componentes não é mais executável sem login ──
  casos := casos + 1;
  BEGIN
    IF has_function_privilege('anon', 'public.replace_combo_componentes(uuid, jsonb)', 'EXECUTE') THEN
      RAISE EXCEPTION 'anon ainda executa';
    END IF;
    IF NOT has_function_privilege('authenticated', 'public.replace_combo_componentes(uuid, jsonb)', 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated perdeu o acesso (quebraria o cadastro de combo do interno)';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C17 replace_combo_componentes fechado para anon', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C17 replace_combo_componentes fechado para anon', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── C18: funções novas fechadas para anon, abertas para quem usa ──
  casos := casos + 1;
  BEGIN
    IF has_function_privilege('anon', 'public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.precos_vigentes(timestamptz)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.combo_itens(uuid, jsonb, text, timestamptz)', 'EXECUTE') THEN
      RAISE EXCEPTION 'anon executa função nova';
    END IF;
    IF NOT has_function_privilege('authenticated', 'public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated sem criar_venda';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'C18 permissões das funções novas', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'C18 permissões das funções novas', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% combos_preco_campanha %/% | contagens_antes=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, antes, resultados;
END
$suite$;

-- Contagens para rodar antes e depois (têm que bater):
-- SELECT (SELECT count(*) FROM public.contatos) contatos, (SELECT count(*) FROM public.vendas) vendas,
--        (SELECT count(*) FROM public.itens_venda) itens_venda, (SELECT count(*) FROM public.meta_eventos) meta_eventos,
--        (SELECT count(*) FROM public.combo_grupo_opcoes) combo_grupo_opcoes,
--        (SELECT sum(estoque_atual) FROM public.produtos) estoque_total,
--        (SELECT min(inicio) FROM public.loja_campanhas) campanha_inicio;
