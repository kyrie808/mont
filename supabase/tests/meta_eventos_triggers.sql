-- Suíte: triggers de enfileiramento da Meta CAPI (fn_enfileirar_purchase_meta,
-- fn_enfileirar_lead_meta) → public.meta_eventos.
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um único DO-block que SEMPRE termina em RAISE EXCEPTION.
-- A exceção aborta a transação inteira, então nada do que a suíte cria — contato, venda,
-- interação, evento na fila, lançamento, baixa de estoque — chega a ser gravado. Não existe
-- caminho de COMMIT. Se algo quebrar no meio, a transação também morre sem gravar.
--
-- COMO RODAR: cole o arquivo inteiro no `execute_sql` do MCP do Supabase (ou no SQL Editor).
-- O resultado SEMPRE vem como erro P0001 — é o esperado. Leia a mensagem:
--   SUITE_OK     meta_eventos_triggers 11/11 | [...]   → tudo passou
--   SUITE_FALHOU meta_eventos_triggers 10/11 | [...]   → veja o caso com "ok": false
-- Prova de que nada ficou: rode as contagens do rodapé antes e depois — têm que bater.
--
-- Roda COMO A CONTA-TESTE (role `authenticated` + jwt com o uid dela), igual ao harness
-- antigo: RLS, `created_by` e o `auth.uid()` dos triggers se comportam como no app.
-- Nenhum trigger destas tabelas faz HTTP, e as vendas não têm `cat_pedido_id` (o sync não
-- toca em cat_pedidos, então `numero_pedido` não avança). O worker nunca é chamado.
--
-- Substitui apps/interno/src/services/__tests__/metaEventos.integration.test.ts, que
-- gravava venda entregue de verdade e dependia de limpeza depois.

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  -- Prefixo de telefone fictício; a suíte aborta se já existir alguém com ele.
  c_tel constant text := '119000014';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  total int := 0;
  antes jsonb;

  v_contato uuid;
  v_venda uuid;
  n int;
  ev public.meta_eventos%ROWTYPE;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'vendas', (SELECT count(*) FROM public.vendas),
    'lancamentos', (SELECT count(*) FROM public.lancamentos),
    'itens_venda', (SELECT count(*) FROM public.itens_venda),
    'interacoes', (SELECT count(*) FROM public.interacoes),
    'meta_eventos', (SELECT count(*) FROM public.meta_eventos)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%' OR telefone_wa LIKE '55' || c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato com o prefixo fictício %', c_tel;
  END IF;

  -- Daqui pra frente, tudo roda como a conta-teste.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;

  -- ── P1: venda entregue não-brinde enfileira 1 Purchase pendente, canal NULL ──────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite P1', c_tel || '01', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, current_date, 'pendente', 'pix', 250, false, 'sistema') RETURNING id INTO v_venda;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE venda_id = v_venda;
    IF n <> 0 THEN RAISE EXCEPTION 'venda pendente já enfileirou % evento(s)', n; END IF;

    UPDATE public.vendas SET status = 'entregue' WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE venda_id = v_venda;
    IF n <> 1 THEN RAISE EXCEPTION 'esperado 1 evento, veio %', n; END IF;
    SELECT * INTO ev FROM public.meta_eventos WHERE venda_id = v_venda;
    IF ev.evento <> 'Purchase' THEN RAISE EXCEPTION 'evento = %', ev.evento; END IF;
    IF ev.event_id <> 'venda_' || v_venda THEN RAISE EXCEPTION 'event_id = %', ev.event_id; END IF;
    IF ev.status <> 'pendente' THEN RAISE EXCEPTION 'status = %', ev.status; END IF;
    IF ev.valor <> 250 THEN RAISE EXCEPTION 'valor = %', ev.valor; END IF;
    IF ev.moeda <> 'BRL' THEN RAISE EXCEPTION 'moeda = %', ev.moeda; END IF;
    IF ev.contato_id <> v_contato THEN RAISE EXCEPTION 'contato_id errado'; END IF;
    IF ev.action_source IS NOT NULL THEN RAISE EXCEPTION 'action_source = % (devia ser NULL)', ev.action_source; END IF;
    IF ev.ctwa_clid IS NOT NULL THEN RAISE EXCEPTION 'ctwa_clid = % (contato sem clid)', ev.ctwa_clid; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P1 entregue enfileira, canal NULL', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P1 entregue enfileira, canal NULL', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P2: fiado entregue É enfileirado ───────────────────────────────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite P2', c_tel || '02', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, current_date, 'pendente', 'fiado', 100, false, 'sistema') RETURNING id INTO v_venda;
    UPDATE public.vendas SET status = 'entregue' WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE venda_id = v_venda;
    IF n <> 1 THEN RAISE EXCEPTION 'esperado 1 evento, veio %', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P2 fiado enfileira', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P2 fiado enfileira', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P3: brinde entregue NÃO é enfileirado ──────────────────────────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite P3', c_tel || '03', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, current_date, 'pendente', 'brinde', 100, false, 'sistema') RETURNING id INTO v_venda;
    UPDATE public.vendas SET status = 'entregue' WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE venda_id = v_venda;
    IF n <> 0 THEN RAISE EXCEPTION 'brinde enfileirou % evento(s)', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P3 brinde não enfileira', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P3 brinde não enfileira', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P4: venda NOVA do catálogo entregue É enfileirada ───────────────────────────
  -- Desde a migration catalogo_purchase_na_entrega o site manda InitiateCheckout, e o
  -- Purchase do catálogo sai daqui, na entrega.
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite P4', c_tel || '04', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, current_date, 'pendente', 'pix', 220, false, 'catalogo') RETURNING id INTO v_venda;
    UPDATE public.vendas SET status = 'entregue' WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE venda_id = v_venda;
    IF n <> 1 THEN RAISE EXCEPTION 'catálogo novo: esperado 1 evento, veio %', n; END IF;
    SELECT * INTO ev FROM public.meta_eventos WHERE venda_id = v_venda;
    IF ev.evento <> 'Purchase' OR ev.valor <> 220 THEN RAISE EXCEPTION 'evento = % valor = %', ev.evento, ev.valor; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P4 catálogo novo enfileira', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P4 catálogo novo enfileira', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P4b: venda do catálogo ANTERIOR ao corte NÃO é enfileirada ──────────────────
  -- O site já mandou Purchase dela no envio do pedido (código antigo); enfileirar na
  -- entrega contaria a mesma compra duas vezes.
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite P4b', c_tel || '08', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, criado_em)
    VALUES (v_contato, DATE '2026-10-11', 'pendente', 'pix', 220, false, 'catalogo', TIMESTAMPTZ '2026-10-11 14:47:52+00')
    RETURNING id INTO v_venda;
    UPDATE public.vendas SET status = 'entregue' WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE venda_id = v_venda;
    IF n <> 0 THEN RAISE EXCEPTION 'catálogo antigo enfileirou % evento(s)', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P4b catálogo antes do corte não enfileira', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P4b catálogo antes do corte não enfileira', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P5: venda pendente NÃO é enfileirada ───────────────────────────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite P5', c_tel || '05', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, current_date, 'pendente', 'pix', 100, false, 'sistema') RETURNING id INTO v_venda;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE venda_id = v_venda;
    IF n <> 0 THEN RAISE EXCEPTION 'pendente enfileirou % evento(s)', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P5 pendente não enfileira', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P5 pendente não enfileira', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P6: idempotência — re-disparar o trigger numa venda já entregue não duplica ──
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite P6', c_tel || '06', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, current_date, 'pendente', 'pix', 100, false, 'sistema') RETURNING id INTO v_venda;
    UPDATE public.vendas SET status = 'entregue' WHERE id = v_venda;
    -- UPDATE OF forma_pagamento re-dispara o trigger; o ON CONFLICT tem que segurar.
    UPDATE public.vendas SET forma_pagamento = 'dinheiro' WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE venda_id = v_venda;
    IF n <> 1 THEN RAISE EXCEPTION 'esperado 1 evento após re-disparo, veio %', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P6 idempotência', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P6 idempotência', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P7: Purchase de contato com clid leva o clid (snapshot), canal NULL ──────────
  total := total + 1;
  BEGIN
    -- origem 'direto' de propósito: isola o Purchase, sem gerar Lead.
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem, ctwa_clid)
    VALUES ('Suite P7', c_tel || '07', 'B2C', 'cliente', 'direto', 'CLID_SUITE_P7') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, current_date, 'pendente', 'pix', 157.50, false, 'sistema') RETURNING id INTO v_venda;
    UPDATE public.vendas SET status = 'entregue' WHERE id = v_venda;

    SELECT * INTO ev FROM public.meta_eventos WHERE venda_id = v_venda;
    IF NOT FOUND THEN RAISE EXCEPTION 'nenhum evento'; END IF;
    IF ev.ctwa_clid IS DISTINCT FROM 'CLID_SUITE_P7' THEN RAISE EXCEPTION 'ctwa_clid = %', ev.ctwa_clid; END IF;
    IF ev.action_source IS NOT NULL THEN RAISE EXCEPTION 'action_source = % (devia ser NULL)', ev.action_source; END IF;
    IF ev.valor <> 157.50 THEN RAISE EXCEPTION 'valor = %', ev.valor; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P7 Purchase com clid, canal NULL', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P7 Purchase com clid, canal NULL', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L1: contato de anúncio COM clid → 1 Lead pendente, clid copiado, canal NULL ──
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem, ctwa_clid)
    VALUES ('Suite L1', c_tel || '11', 'B2C', 'lead', 'anuncio', 'CLID_SUITE_L1') RETURNING id INTO v_contato;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE contato_id = v_contato;
    IF n <> 1 THEN RAISE EXCEPTION 'esperado 1 evento, veio %', n; END IF;
    SELECT * INTO ev FROM public.meta_eventos WHERE contato_id = v_contato;
    IF ev.evento <> 'Lead' THEN RAISE EXCEPTION 'evento = %', ev.evento; END IF;
    IF ev.event_id <> 'lead_' || v_contato THEN RAISE EXCEPTION 'event_id = %', ev.event_id; END IF;
    IF ev.status <> 'pendente' THEN RAISE EXCEPTION 'status = %', ev.status; END IF;
    IF ev.ctwa_clid IS DISTINCT FROM 'CLID_SUITE_L1' THEN RAISE EXCEPTION 'ctwa_clid = %', ev.ctwa_clid; END IF;
    IF ev.action_source IS NOT NULL THEN RAISE EXCEPTION 'action_source = % (devia ser NULL)', ev.action_source; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L1 anúncio com clid', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L1 anúncio com clid', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L2: contato de anúncio SEM clid → 1 Lead pendente, clid NULL, canal NULL ─────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite L2', c_tel || '12', 'B2C', 'lead', 'anuncio') RETURNING id INTO v_contato;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE contato_id = v_contato;
    IF n <> 1 THEN RAISE EXCEPTION 'esperado 1 evento, veio %', n; END IF;
    SELECT * INTO ev FROM public.meta_eventos WHERE contato_id = v_contato;
    IF ev.evento <> 'Lead' THEN RAISE EXCEPTION 'evento = %', ev.evento; END IF;
    IF ev.ctwa_clid IS NOT NULL THEN RAISE EXCEPTION 'ctwa_clid = % (devia ser NULL)', ev.ctwa_clid; END IF;
    IF ev.action_source IS NOT NULL THEN RAISE EXCEPTION 'action_source = % (devia ser NULL)', ev.action_source; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L2 anúncio sem clid', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L2 anúncio sem clid', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── L3: contato que NÃO é de anúncio não gera Lead ──────────────────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite L3', c_tel || '13', 'B2C', 'lead', 'direto') RETURNING id INTO v_contato;

    SELECT count(*) INTO n FROM public.meta_eventos WHERE contato_id = v_contato;
    IF n <> 0 THEN RAISE EXCEPTION 'contato não-anúncio enfileirou % evento(s)', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'L3 não-anúncio não gera Lead', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'L3 não-anúncio não gera Lead', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── Fim: SEMPRE aborta. Não existe caminho que grave. ───────────────────────────
  RAISE EXCEPTION '% meta_eventos_triggers %/% | contagens_antes=% | %',
    CASE WHEN passou = total THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, total, antes, resultados;
END
$suite$;

-- Contagens para a prova "nada ficou" (rodar ANTES e DEPOIS, à parte):
-- SELECT (SELECT count(*) FROM public.contatos)     AS contatos,
--        (SELECT count(*) FROM public.vendas)       AS vendas,
--        (SELECT count(*) FROM public.lancamentos)  AS lancamentos,
--        (SELECT count(*) FROM public.itens_venda)  AS itens_venda,
--        (SELECT count(*) FROM public.interacoes)   AS interacoes,
--        (SELECT count(*) FROM public.meta_eventos) AS meta_eventos,
--        (SELECT last_value FROM public.cat_pedidos_numero_pedido_seq) AS seq_numero_pedido;
