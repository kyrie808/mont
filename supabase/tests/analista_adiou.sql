-- Suíte: correções da rodada de teste da E4 — resultado `adiou`, `retomar_em`, nota sem
--        "recusa" fora de recusou, aceitou sempre avança, orderMessage da E1 fora da fila.
--
-- PADRÃO "TRANSAÇÃO DESCARTADA" (ver supabase/tests/meta_eventos_triggers.sql): um único
-- DO-block que SEMPRE termina em RAISE EXCEPTION. Nada do que a suíte cria ou altera chega
-- a ser gravado — inclusive as interações que A6–A8 registram nos clientes REAIS (Maria
-- Perdigão, Zélia, Lena) com as mensagens reais deles: é o caminho de escrita de verdade,
-- dentro desta transação.
--
-- COMO RODAR: cole o arquivo inteiro no `execute_sql` do MCP do Supabase. O resultado
-- SEMPRE vem como erro P0001:
--   SUITE_OK     analista_adiou n/n | ...  → tudo passou
--   SUITE_FALHOU analista_adiou k/n | ...  → veja o caso com "ok": false
--
-- Depende da data: A8 supõe que o dia seguinte à conversa da Lena (14/10) já chegou.

DO $suite$
DECLARE
  c_tel constant text := '119000017';
  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  total int := 0;
  antes jsonb;

  v_c1 uuid; v_c2 uuid; v_c3 uuid;
  v_real uuid;
  v_ids text[];
  v_col text;
  v_tent int;
  r jsonb;
  n int;
  ok boolean;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'interacoes', (SELECT count(*) FROM public.interacoes),
    'mensagens_whatsapp', (SELECT count(*) FROM public.mensagens_whatsapp),
    'pendentes', (SELECT count(*) FROM public.mensagens_whatsapp WHERE processado_em IS NULL AND NOT historico),
    'hash_status', (SELECT md5(string_agg(id::text || coalesce(status_relacionamento::text, '-'), ',' ORDER BY id)) FROM public.contatos)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%' OR telefone_wa LIKE '55' || c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato com o prefixo fictício %', c_tel;
  END IF;

  -- Três contatos fictícios sem vendas (aba leads).
  INSERT INTO public.contatos (nome, telefone, tipo, status, origem, status_relacionamento)
  VALUES ('Suite Adiou 1', c_tel || '01', 'B2C', 'lead', 'whatsapp', 'contatado') RETURNING id INTO v_c1;
  INSERT INTO public.contatos (nome, telefone, tipo, status, origem, status_relacionamento)
  VALUES ('Suite Adiou 2', c_tel || '02', 'B2C', 'lead', 'whatsapp', 'contatado') RETURNING id INTO v_c2;
  INSERT INTO public.contatos (nome, telefone, tipo, status, origem, status_relacionamento)
  VALUES ('Suite Adiou 3', c_tel || '03', 'B2C', 'lead', 'whatsapp', 'em_negociacao') RETURNING id INTO v_c3;

  -- ── A1: vocabulário ──────────────────────────────────────────────────────────────
  total := total + 1;
  BEGIN
    n := 0;
    BEGIN
      INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, retomar_em, gerado_por_ia)
      VALUES (v_c1, now() - interval '20 days', 'ponto_contato', 'whatsapp', 'entrada', 'respondeu', current_date + 2, true);
    EXCEPTION WHEN check_violation THEN n := n + 1;
    END;
    BEGIN
      INSERT INTO public.interacoes (contato_id, data, tipo, canal, resultado, gerado_por_ia)
      VALUES (v_c1, now() - interval '20 days', 'feedback', 'whatsapp', 'adiou', true);
    EXCEPTION WHEN check_violation THEN n := n + 1;
    END;
    IF n <> 2 THEN RAISE EXCEPTION 'constraint deixou passar % de 2 casos inválidos', 2 - n; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A1 retomar_em só com adiou; feedback não adia', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A1 retomar_em só com adiou; feedback não adia', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A2: trava — adiou só tira de a_contatar; aceitou sempre avança ──────────────
  total := total + 1;
  BEGIN
    IF public.fn_ia_destino_coluna('a_contatar', 'entrada', 'adiou') IS DISTINCT FROM 'contatado' THEN RAISE EXCEPTION 'adiou de a_contatar'; END IF;
    IF public.fn_ia_destino_coluna('contatado', 'entrada', 'adiou') IS NOT NULL THEN RAISE EXCEPTION 'adiou de contatado moveu'; END IF;
    IF public.fn_ia_destino_coluna('follow_up', 'entrada', 'adiou') IS NOT NULL THEN RAISE EXCEPTION 'adiou de follow_up moveu'; END IF;
    IF public.fn_ia_destino_coluna('em_negociacao', 'entrada', 'adiou') IS NOT NULL THEN RAISE EXCEPTION 'adiou de em_negociacao moveu'; END IF;
    IF public.fn_ia_destino_coluna('recusou', 'entrada', 'adiou') IS NOT NULL THEN RAISE EXCEPTION 'adiou de recusou moveu'; END IF;
    IF public.fn_ia_destino_coluna('resolvido', 'entrada', 'adiou') IS NOT NULL THEN RAISE EXCEPTION 'adiou de resolvido moveu'; END IF;
    IF public.fn_ia_destino_coluna('follow_up', 'saida', 'aceitou') IS DISTINCT FROM 'em_negociacao' THEN RAISE EXCEPTION 'aceitou (último a falar fomos nós) não avançou'; END IF;
    IF public.fn_ia_destino_coluna('sem_retorno', 'entrada', 'aceitou') IS DISTINCT FROM 'em_negociacao' THEN RAISE EXCEPTION 'aceitou de sem_retorno'; END IF;
    IF public.fn_ia_destino_coluna('resolvido', 'entrada', 'aceitou') IS NOT NULL THEN RAISE EXCEPTION 'aceitou tirou de resolvido não reaberto'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A2 trava: adiou e aceitou', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A2 trava: adiou e aceitou', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A3: adiou sem data conta tentativa, não zera, e a cadência traz o follow_up ──
  total := total + 1;
  BEGIN
    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, gerado_por_ia)
    VALUES (v_c1, now() - interval '10 hours', 'ponto_contato', 'whatsapp', 'saida', NULL, true);
    SELECT tentativas INTO v_tent FROM public.view_relacionamento_kanban WHERE contato_id = v_c1;
    IF v_tent <> 1 THEN RAISE EXCEPTION 'tentativas depois da 1ª saída: %', v_tent; END IF;

    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, gerado_por_ia)
    VALUES (v_c1, now() - interval '9 hours', 'ponto_contato', 'whatsapp', 'entrada', 'adiou', true);
    SELECT tentativas, coluna_efetiva INTO v_tent, v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_c1;
    IF v_tent <> 2 THEN RAISE EXCEPTION 'adiou não contou tentativa ou zerou: tentativas=%', v_tent; END IF;
    IF (SELECT status_relacionamento FROM public.contatos WHERE id = v_c1) <> 'contatado' THEN RAISE EXCEPTION 'adiou mudou o status'; END IF;
    -- 2 tentativas → prazo = 4h depois da última (9h atrás) → já venceu.
    IF v_col <> 'follow_up' THEN RAISE EXCEPTION 'coluna depois do adiamento: % (esperado follow_up)', v_col; END IF;

    -- Comparação: a mesma conversa com "respondeu" zera a cadência e leva a em_negociacao.
    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, gerado_por_ia)
    VALUES (v_c2, now() - interval '10 hours', 'ponto_contato', 'whatsapp', 'saida', NULL, true),
           (v_c2, now() - interval '9 hours', 'ponto_contato', 'whatsapp', 'entrada', 'respondeu', true);
    SELECT tentativas, coluna_efetiva INTO v_tent, v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_c2;
    IF v_tent <> 0 OR v_col <> 'em_negociacao' THEN RAISE EXCEPTION 'respondeu: tentativas=% coluna=%', v_tent, v_col; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A3 adiou conta tentativa e não zera; respondeu zera', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A3 adiou conta tentativa e não zera; respondeu zera', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A4: retomar_em manda no prazo: futuro segura o follow_up; hoje mostra ────────
  total := total + 1;
  BEGIN
    -- v_c1 está em follow_up pela cadência (A3). Um adiamento com data futura segura.
    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, retomar_em, gerado_por_ia)
    VALUES (v_c1, now() - interval '8 hours', 'ponto_contato', 'whatsapp', 'entrada', 'adiou', current_date + 3, true)
    RETURNING id INTO v_real;
    SELECT tentativas, coluna_efetiva INTO v_tent, v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_c1;
    IF v_col <> 'contatado' THEN RAISE EXCEPTION 'retomar_em futuro: coluna % (esperado contatado)', v_col; END IF;
    IF v_tent <> 3 THEN RAISE EXCEPTION 'tentativas %', v_tent; END IF;

    UPDATE public.interacoes SET retomar_em = current_date WHERE id = v_real;
    SELECT coluna_efetiva INTO v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_c1;
    IF v_col <> 'follow_up' THEN RAISE EXCEPTION 'retomar_em hoje: coluna % (esperado follow_up)', v_col; END IF;

    -- Uma tentativa nossa DEPOIS do adiamento volta a valer a cadência (4ª → 3 dias).
    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, gerado_por_ia)
    VALUES (v_c1, now() - interval '1 hour', 'ponto_contato', 'whatsapp', 'saida', NULL, true);
    SELECT coluna_efetiva INTO v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_c1;
    IF v_col <> 'contatado' THEN RAISE EXCEPTION 'depois da nova tentativa: coluna % (esperado contatado)', v_col; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A4 retomar_em futuro segura, no dia aparece follow_up', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A4 retomar_em futuro segura, no dia aparece follow_up', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A5: em_negociacao com adiamento datado: follow_up no dia; sem data, fica ─────
  total := total + 1;
  BEGIN
    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, gerado_por_ia)
    VALUES (v_c3, now() - interval '5 hours', 'ponto_contato', 'whatsapp', 'entrada', 'adiou', true)
    RETURNING id INTO v_real;
    SELECT coluna_efetiva INTO v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_c3;
    IF v_col <> 'em_negociacao' THEN RAISE EXCEPTION 'sem data: % (esperado em_negociacao)', v_col; END IF;
    UPDATE public.interacoes SET retomar_em = current_date + 1 WHERE id = v_real;
    SELECT coluna_efetiva INTO v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_c3;
    IF v_col <> 'em_negociacao' THEN RAISE EXCEPTION 'data futura: % (esperado em_negociacao)', v_col; END IF;
    UPDATE public.interacoes SET retomar_em = current_date WHERE id = v_real;
    SELECT coluna_efetiva INTO v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_c3;
    IF v_col <> 'follow_up' THEN RAISE EXCEPTION 'data de hoje: % (esperado follow_up)', v_col; END IF;
    IF (SELECT status_relacionamento FROM public.contatos WHERE id = v_c3) <> 'em_negociacao' THEN RAISE EXCEPTION 'status gravado mudou'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A5 em_negociacao: follow_up só no dia combinado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A5 em_negociacao: follow_up só no dia combinado', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A6: Maria Perdigão (REAL) — aceitou com venda pendente vai a em_negociacao ───
  total := total + 1;
  BEGIN
    SELECT id INTO v_real FROM public.contatos WHERE nome = 'Maria Perdigão' AND arquivado_em IS NULL;
    SELECT array_agg(message_id ORDER BY enviada_em) INTO v_ids
      FROM public.mensagens_whatsapp
     WHERE contato_id = v_real AND processado_em IS NULL AND NOT historico
       AND enviada_em >= '2026-10-14 15:00-03' AND enviada_em < '2026-10-14 17:00-03';
    IF cardinality(v_ids) IS DISTINCT FROM 21 THEN RAISE EXCEPTION 'segmento da Maria com % mensagens (esperado 21)', cardinality(v_ids); END IF;
    SELECT coluna_efetiva INTO v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_real;
    IF v_col <> 'follow_up' THEN RAISE EXCEPTION 'Maria antes: % (esperado follow_up)', v_col; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vendas WHERE contato_id = v_real AND status = 'pendente') THEN RAISE EXCEPTION 'Maria sem venda pendente'; END IF;

    r := public.rpc_registrar_interacao_ia(v_real,
           '{"tipo":"ponto_contato","resultado":"aceitou","observacao":"Fechou 1kg de pão de queijo congelado (bolinha 50g) para amanhã, Pix na entrega, R$ 35."}',
           v_ids);
    IF r->>'sentido' <> 'saida' THEN RAISE EXCEPTION 'sentido %', r->>'sentido'; END IF;
    IF r->>'coluna_antes' <> 'follow_up' OR r->>'coluna_depois' <> 'em_negociacao' OR r->>'status_depois' <> 'em_negociacao' THEN
      RAISE EXCEPTION 'Maria: %', r;
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A6 Maria aceitou: follow_up → em_negociacao (gravação real)', 'ok', true,
      'mov', r->>'coluna_antes' || ' → ' || (r->>'coluna_depois'));
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A6 Maria aceitou: follow_up → em_negociacao (gravação real)', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A7: Zélia (REAL) — adiou sem data: continua contatado, cadência dá follow_up ──
  total := total + 1;
  BEGIN
    SELECT id INTO v_real FROM public.contatos WHERE nome = 'Zélia' AND arquivado_em IS NULL;
    SELECT array_agg(message_id ORDER BY enviada_em) INTO v_ids
      FROM public.mensagens_whatsapp
     WHERE contato_id = v_real AND processado_em IS NULL AND NOT historico;
    SELECT tentativas INTO n FROM public.view_relacionamento_kanban WHERE contato_id = v_real;

    r := public.rpc_registrar_interacao_ia(v_real,
           '{"tipo":"ponto_contato","resultado":"adiou","observacao":"Acompanhando a mãe; pediu para retomar depois.","retomar_em":null}',
           v_ids);
    SELECT tentativas, coluna_efetiva INTO v_tent, v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_real;
    IF r->>'resultado' <> 'adiou' OR r->>'status_depois' <> 'contatado' THEN RAISE EXCEPTION 'Zélia: %', r; END IF;
    IF v_tent <> n + 1 THEN RAISE EXCEPTION 'tentativas % → % (esperado +1)', n, v_tent; END IF;
    IF v_col <> 'follow_up' THEN RAISE EXCEPTION 'Zélia coluna %', v_col; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A7 Zélia adiou: fica contatado, follow_up pela cadência (gravação real)', 'ok', true,
      'tentativas', n || ' → ' || v_tent);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A7 Zélia adiou: fica contatado, follow_up pela cadência (gravação real)', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A8: Lena (REAL) — adiou para amanhã (15/10): em_negociacao, follow_up no dia ──
  total := total + 1;
  BEGIN
    SELECT id INTO v_real FROM public.contatos WHERE nome = 'Lena' AND arquivado_em IS NULL;
    SELECT array_agg(message_id ORDER BY enviada_em) INTO v_ids
      FROM public.mensagens_whatsapp
     WHERE contato_id = v_real AND processado_em IS NULL AND NOT historico;

    r := public.rpc_registrar_interacao_ia(v_real,
           '{"tipo":"ponto_contato","resultado":"adiou","observacao":"Vai ver se pega o balde de 4kg amanhã ou no fim de semana.","retomar_em":"2026-10-15"}',
           v_ids);
    IF r->>'retomar_em' <> '2026-10-15' OR r->>'status_depois' <> 'em_negociacao' THEN RAISE EXCEPTION 'Lena: %', r; END IF;
    IF current_date >= date '2026-10-15' AND r->>'coluna_depois' <> 'follow_up' THEN RAISE EXCEPTION 'Lena coluna %', r->>'coluna_depois'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A8 Lena adiou com data: follow_up no dia (gravação real)', 'ok', true,
      'mov', (r->>'coluna_antes') || ' → ' || (r->>'coluna_depois'));
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A8 Lena adiou com data: follow_up no dia (gravação real)', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A9: RPC barra "recusa" na nota fora de recusou; data fora da janela degrada ──
  total := total + 1;
  BEGIN
    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id) VALUES
      ('55' || c_tel || '02', 'SUITE_AD_1', 'saida',   'Essa é a semana do seu balde', 'texto', '{}', '2026-10-14 18:41:00+00', v_c2),
      ('55' || c_tel || '02', 'SUITE_AD_2', 'entrada', 'Não obrigada',                 'texto', '{}', '2026-10-14 19:27:00+00', v_c2),
      ('55' || c_tel || '02', 'SUITE_AD_3', 'entrada', NULL,                           'audio', '{}', '2026-10-14 19:28:00+00', v_c2);
    ok := false;
    BEGIN
      PERFORM public.rpc_registrar_interacao_ia(v_c2,
        '{"tipo":"ponto_contato","resultado":"adiou","observacao":"Cliente recusou o pedido, está viajando."}',
        ARRAY['SUITE_AD_1', 'SUITE_AD_2', 'SUITE_AD_3']);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'nota com "recusou" passou num adiamento'; END IF;

    r := public.rpc_registrar_interacao_ia(v_c2,
           '{"tipo":"ponto_contato","resultado":"adiou","observacao":"Está viajando; retomar na volta.","retomar_em":"2027-03-01"}',
           ARRAY['SUITE_AD_1', 'SUITE_AD_2', 'SUITE_AD_3']);
    IF r->>'resultado' <> 'adiou' OR r->>'retomar_em' IS NOT NULL OR r->>'degradou' IS NULL THEN RAISE EXCEPTION 'janela: %', r; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A9 nota sem recusa fora de recusou; retomar_em fora da janela cai', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A9 nota sem recusa fora de recusou; retomar_em fora da janela cai', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A10: orderMessage da E1 fora da fila; o resto da conversa continua nela ──────
  total := total + 1;
  BEGIN
    SELECT count(*) INTO n
      FROM public.wa_pedido_catalogo p JOIN public.mensagens_whatsapp m USING (message_id)
     WHERE p.interacao_id IS NOT NULL AND m.processado_em IS NULL AND NOT m.historico;
    IF n <> 0 THEN RAISE EXCEPTION '% pedido(s) com nota ainda na fila', n; END IF;

    SELECT id INTO v_real FROM public.contatos WHERE nome = 'Ana Paula Barbosa Firmo';
    SELECT count(*) INTO n FROM public.mensagens_whatsapp
     WHERE contato_id = v_real AND processado_em IS NULL AND NOT historico
       AND enviada_em >= '2026-10-14 08:00-03' AND enviada_em < '2026-10-14 09:00-03';
    IF n <> 14 THEN RAISE EXCEPTION 'resto da conversa das 08:27 na fila: % (esperado 14)', n; END IF;

    -- Pedido novo: a RPC da E1 já tira a mensagem da fila ao gravar a nota.
    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id)
    VALUES ('55' || c_tel || '03', 'SUITE_AD_PED', 'entrada', '🛒 Pedido pelo catálogo do WhatsApp — 1 item', 'pedido', '{}', now() - interval '1 hour', v_c3);
    PERFORM public.rpc_registrar_pedido_catalogo_wa('SUITE_AD_PED', NULL, NULL, 1, 30, 'BRL', NULL);
    IF (SELECT processado_em FROM public.mensagens_whatsapp WHERE message_id = 'SUITE_AD_PED') IS NULL THEN
      RAISE EXCEPTION 'pedido novo continuou na fila';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A10 orderMessage com nota fora da fila; resto da conversa fica', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A10 orderMessage com nota fora da fila; resto da conversa fica', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── Fim: SEMPRE aborta. Não existe caminho que grave. ───────────────────────────
  RAISE EXCEPTION '% analista_adiou %/% | contagens_antes=% | %',
    CASE WHEN passou = total THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, total, antes, resultados;
END
$suite$;

-- Contagens para a prova "nada ficou" (rodar ANTES e DEPOIS, à parte):
-- SELECT (SELECT count(*) FROM public.contatos)           AS contatos,
--        (SELECT count(*) FROM public.interacoes)         AS interacoes,
--        (SELECT count(*) FROM public.mensagens_whatsapp) AS mensagens_whatsapp,
--        (SELECT count(*) FROM public.mensagens_whatsapp WHERE processado_em IS NULL AND NOT historico) AS pendentes,
--        (SELECT md5(string_agg(id::text || coalesce(status_relacionamento::text, '-'), ',' ORDER BY id))
--           FROM public.contatos)                         AS hash_status;
