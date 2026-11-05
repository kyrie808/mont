-- Suíte: fiado = preço normal, sem exceção (decisão do Gilmar, 04/11/2026; branch fix/fiado-preco-normal).
-- Black só em Pix, dinheiro e cartão. Fiado e venda sem forma de pagamento: preço normal; combo no
-- normal = soma dos itens no preço do cadastro (fixos + sabores + o que seria brinde).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION; nada é gravado.
-- Cenário só dentro da transação: a campanha "Black da Mont 2026" fica LIGADA (no banco ela está
-- pausada). Vendas de teste como a CONTA-TESTE (admin), status 'pendente' (sem baixa de estoque,
-- sem evento da Meta), contato fictício com telefone 119000031xx.
-- A tabela de preços (forma × item) sai na mensagem final, antes da lista de casos.
--   SUITE_OK     fiado_preco_normal 9/9 | precos=[...] | [...]

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_tel constant text := '119000031';

  resultados jsonb := '[]'::jsonb;
  precos jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;
  depois jsonb;

  v_campanha uuid;
  v_balde uuid; v_mesa uuid; v_cafe uuid;
  v_esc_mesa jsonb; v_esc_cafe jsonb;
  v_soma_mesa numeric; v_soma_cafe numeric;
  v_contato uuid;
  v_venda uuid;
  v_total numeric;
  v_item record;
  v_legado uuid;
  r record;

BEGIN
  antes := jsonb_build_object(
    'vendas', (SELECT count(*) FROM public.vendas),
    'itens_venda', (SELECT count(*) FROM public.itens_venda),
    'contatos', (SELECT count(*) FROM public.contatos),
    'campanha', (SELECT md5(string_agg(id::text || ativa::text || inicio::text || fim::text, ',')) FROM public.loja_campanhas)
  );
  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato com o prefixo fictício %', c_tel;
  END IF;

  SELECT id INTO v_campanha FROM public.loja_campanhas WHERE nome = 'Black da Mont 2026';
  SELECT id INTO v_balde FROM public.produtos WHERE slug = 'massa-pao-queijo-4kg';
  SELECT id INTO v_mesa FROM public.produtos WHERE nome = 'Mesa Cheia (Black)';
  SELECT id INTO v_cafe FROM public.produtos WHERE nome = 'Café da Tarde (Black)';
  IF v_campanha IS NULL OR v_balde IS NULL OR v_mesa IS NULL OR v_cafe IS NULL THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: cenário da Black não encontrado';
  END IF;

  -- Campanha ligada e valendo agora (descartado no fim).
  UPDATE public.loja_campanhas SET ativa = true, inicio = LEAST(inicio, now() - interval '1 hour') WHERE id = v_campanha;

  -- Sabores: os primeiros de cada grupo, sem repetir (vale com ou sem "pode repetir").
  SELECT COALESCE(jsonb_agg(jsonb_build_object('grupo_id', x.grupo_id, 'produto_id', x.produto_id, 'quantidade', 1)), '[]'::jsonb)
    INTO v_esc_mesa
    FROM (SELECT o.grupo_id, o.produto_id, row_number() OVER (PARTITION BY g.id ORDER BY o.ordem, o.produto_id) n, g.quantidade
            FROM public.combo_grupos g JOIN public.combo_grupo_opcoes o ON o.grupo_id = g.id
           WHERE g.combo_id = v_mesa) x
   WHERE x.n <= x.quantidade;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('grupo_id', x.grupo_id, 'produto_id', x.produto_id, 'quantidade', 1)), '[]'::jsonb)
    INTO v_esc_cafe
    FROM (SELECT o.grupo_id, o.produto_id, row_number() OVER (PARTITION BY g.id ORDER BY o.ordem, o.produto_id) n, g.quantidade
            FROM public.combo_grupos g JOIN public.combo_grupo_opcoes o ON o.grupo_id = g.id
           WHERE g.combo_id = v_cafe) x
   WHERE x.n <= x.quantidade;

  -- Soma esperada no fiado: fixos (brinde incluso) + sabores, cada um no produtos.preco.
  SELECT (SELECT COALESCE(sum(pc.quantidade * p.preco), 0) FROM public.produto_componentes pc JOIN public.produtos p ON p.id = pc.componente_id WHERE pc.combo_id = v_mesa)
       + (SELECT COALESCE(sum((e ->> 'quantidade')::numeric * p.preco), 0) FROM jsonb_array_elements(v_esc_mesa) e JOIN public.produtos p ON p.id = (e ->> 'produto_id')::uuid)
    INTO v_soma_mesa;
  SELECT (SELECT COALESCE(sum(pc.quantidade * p.preco), 0) FROM public.produto_componentes pc JOIN public.produtos p ON p.id = pc.componente_id WHERE pc.combo_id = v_cafe)
       + (SELECT COALESCE(sum((e ->> 'quantidade')::numeric * p.preco), 0) FROM jsonb_array_elements(v_esc_cafe) e JOIN public.produtos p ON p.id = (e ->> 'produto_id')::uuid)
    INTO v_soma_cafe;

  INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
  VALUES ('Cliente Suite Fiado', c_tel || '01', 'B2C', 'cliente', 'direto')
  RETURNING id INTO v_contato;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() não é a conta-teste'; END IF;

  -- ── Tabela de preços: cada forma com a tabela que a tela manda; 'venda' também com 'pix' (o
  --    padrão antigo do carrinho) para mostrar que agora é recusado. ──
  FOR r IN
    SELECT * FROM (VALUES ('pix', 'pix', 1), ('dinheiro', 'pix', 2), ('cartao', 'cartao', 3),
                          ('fiado', 'normal', 4), ('venda', 'normal', 5), ('venda', 'pix', 6)) t(forma, tabela, ordem)
     ORDER BY ordem
  LOOP
    FOR v_item IN
      SELECT * FROM (VALUES ('balde 4kg', v_balde, false, NULL::jsonb), ('Mesa Cheia', v_mesa, true, v_esc_mesa),
                            ('Café da Tarde', v_cafe, true, v_esc_cafe)) t(nome, id, combo, escolhas)
    LOOP
      BEGIN
        v_venda := public.criar_venda(
          v_contato, current_date, r.forma, 0,
          jsonb_build_array(CASE WHEN v_item.combo
            THEN jsonb_build_object('combo_id', v_item.id, 'quantidade', 1, 'escolhas', v_item.escolhas)
            ELSE jsonb_build_object('produto_id', v_item.id, 'quantidade', 1, 'preco_unitario', 0, 'subtotal', 0) END),
          gen_random_uuid(),
          p_data_prevista_pagamento => CASE WHEN r.forma = 'fiado' THEN current_date + 30 END,
          p_tabela => r.tabela);
        SELECT total INTO v_total FROM public.vendas WHERE id = v_venda;
        precos := precos || jsonb_build_object('forma', r.forma, 'tabela', r.tabela, 'item', v_item.nome, 'total', v_total);
      EXCEPTION WHEN others THEN
        precos := precos || jsonb_build_object('forma', r.forma, 'tabela', r.tabela, 'item', v_item.nome, 'recusada', SQLERRM);
      END;
    END LOOP;
  END LOOP;

  -- ── F1: balde 4kg avulso: Pix/dinheiro 65, cartão 68, fiado e venda sem forma 75 ──
  casos := casos + 1;
  BEGIN
    IF (SELECT jsonb_agg((p ->> 'total')::numeric ORDER BY o) FROM jsonb_array_elements(precos) WITH ORDINALITY AS t(p, o)
         WHERE p ->> 'item' = 'balde 4kg' AND p ? 'total') <> '[65, 65, 68, 75, 75]'::jsonb THEN
      RAISE EXCEPTION 'balde: %', (SELECT jsonb_agg(p) FROM jsonb_array_elements(precos) p WHERE p ->> 'item' = 'balde 4kg');
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F1 balde 65/65/68/75/75', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F1 balde', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F2: Mesa Cheia: Black no Pix/dinheiro/cartão; fiado e venda sem forma = soma no cadastro ──
  casos := casos + 1;
  BEGIN
    IF (SELECT jsonb_agg((p ->> 'total')::numeric ORDER BY o) FROM jsonb_array_elements(precos) WITH ORDINALITY AS t(p, o)
         WHERE p ->> 'item' = 'Mesa Cheia' AND p ? 'total')
       <> jsonb_build_array(199, 199, 206, v_soma_mesa, v_soma_mesa) OR v_soma_mesa <= 199 THEN
      RAISE EXCEPTION 'mesa (soma %): %', v_soma_mesa, (SELECT jsonb_agg(p) FROM jsonb_array_elements(precos) p WHERE p ->> 'item' = 'Mesa Cheia');
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F2 Mesa Cheia 199/199/206/soma/soma', 'ok', true, 'soma', v_soma_mesa);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F2 Mesa Cheia', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F3: Café da Tarde: 89/89/92; fiado e venda sem forma = soma no cadastro ──
  casos := casos + 1;
  BEGIN
    IF (SELECT jsonb_agg((p ->> 'total')::numeric ORDER BY o) FROM jsonb_array_elements(precos) WITH ORDINALITY AS t(p, o)
         WHERE p ->> 'item' = 'Café da Tarde' AND p ? 'total')
       <> jsonb_build_array(89, 89, 92, v_soma_cafe, v_soma_cafe) THEN
      RAISE EXCEPTION 'café (soma %): %', v_soma_cafe, (SELECT jsonb_agg(p) FROM jsonb_array_elements(precos) p WHERE p ->> 'item' = 'Café da Tarde');
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F3 Café da Tarde 89/89/92/soma/soma', 'ok', true, 'soma', v_soma_cafe);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F3 Café da Tarde', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F4: venda sem forma com a tabela Pix é recusada (os 3 itens) ──
  casos := casos + 1;
  BEGIN
    IF (SELECT count(*) FROM jsonb_array_elements(precos) p WHERE p ->> 'forma' = 'venda' AND p ->> 'tabela' = 'pix' AND p ? 'recusada') <> 3 THEN
      RAISE EXCEPTION 'venda+pix: %', (SELECT jsonb_agg(p) FROM jsonb_array_elements(precos) p WHERE p ->> 'forma' = 'venda' AND p ->> 'tabela' = 'pix');
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F4 venda sem forma + Pix recusada', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F4 venda+pix', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F5: pre_venda com Pix recusada; com normal aceita ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.criar_venda(v_contato, current_date, 'pre_venda', 0,
        jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1)), gen_random_uuid(), p_tabela => 'pix');
      RAISE EXCEPTION 'aceitou pre_venda com pix';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    v_venda := public.criar_venda(v_contato, current_date, 'pre_venda', 0,
      jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1)), gen_random_uuid(), p_tabela => 'normal');
    IF (SELECT total FROM public.vendas WHERE id = v_venda) <> 75 THEN RAISE EXCEPTION 'pre_venda normal <> 75'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F5 pre_venda só normal', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F5 pre_venda', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F6: sem tabela é recusado (antes aceitava o preço de quem chamou) ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.criar_venda(v_contato, current_date, 'fiado', 0,
        jsonb_build_array(jsonb_build_object('produto_id', v_balde, 'quantidade', 1, 'preco_unitario', 65, 'subtotal', 65)),
        gen_random_uuid(), p_data_prevista_pagamento => current_date + 30);
      RAISE EXCEPTION 'aceitou venda sem tabela';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE '%obrigatória%' THEN RAISE EXCEPTION 'mensagem: %', SQLERRM; END IF;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F6 sem tabela recusa', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F6 sem tabela', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F7: trigger: gravar direto venda fiado com tabela Pix é recusado ──
  casos := casos + 1;
  BEGIN
    BEGIN
      INSERT INTO public.vendas (contato_id, data, total, forma_pagamento, status, pago, tabela_preco)
      VALUES (v_contato, current_date, 65, 'fiado', 'pendente', false, 'pix');
      RAISE EXCEPTION 'aceitou insert fiado com pix';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F7 insert fiado+pix recusado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F7 insert fiado+pix', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F8: trigger: trocar uma venda Pix para fiado (direto) é recusado; fiado+normal edita normal ──
  casos := casos + 1;
  BEGIN
    SELECT v.id INTO v_venda FROM public.vendas v WHERE v.contato_id = v_contato AND v.forma_pagamento = 'pix' LIMIT 1;
    BEGIN
      UPDATE public.vendas SET forma_pagamento = 'fiado' WHERE id = v_venda;
      RAISE EXCEPTION 'aceitou pix -> fiado';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    SELECT v.id INTO v_venda FROM public.vendas v WHERE v.contato_id = v_contato AND v.forma_pagamento = 'fiado' LIMIT 1;
    UPDATE public.vendas SET observacoes = 'editada na suíte', forma_pagamento = 'fiado' WHERE id = v_venda;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'F8 pix->fiado recusado; fiado normal edita', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F8 update fiado', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── F9: fiado antigo sem tabela (antes de 30/10) segue editável: o trigger só olha a mudança ──
  casos := casos + 1;
  BEGIN
    SELECT id INTO v_legado FROM public.vendas WHERE forma_pagamento = 'fiado' AND tabela_preco IS NULL LIMIT 1;
    IF v_legado IS NULL THEN
      resultados := resultados || jsonb_build_object('caso', 'F9 fiado antigo', 'ok', true, 'obs', 'sem fiado antigo no banco');
    ELSE
      UPDATE public.vendas SET forma_pagamento = forma_pagamento, observacoes = observacoes WHERE id = v_legado;
      resultados := resultados || jsonb_build_object('caso', 'F9 fiado antigo sem tabela edita', 'ok', true);
    END IF;
    passou := passou + 1;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'F9 fiado antigo', 'ok', false, 'erro', SQLERRM);
  END;

  RESET ROLE;
  depois := jsonb_build_object(
    'vendas', (SELECT count(*) FROM public.vendas),
    'itens_venda', (SELECT count(*) FROM public.itens_venda),
    'contatos', (SELECT count(*) FROM public.contatos));

  RAISE EXCEPTION '% fiado_preco_normal %/% | contagens_antes=% | dentro_da_transacao=% | precos=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, antes, depois, precos, resultados;
END
$suite$;
