-- Suíte: correções da rodada de teste da E4 — resultado `adiou`, `retomar_em`, nota sem
--        "recusa" fora de recusou, aceitou sempre avança, orderMessage da E1 fora da fila.
--
-- PADRÃO "TRANSAÇÃO DESCARTADA" (ver supabase/tests/meta_eventos_triggers.sql): um único
-- DO-block que SEMPRE termina em RAISE EXCEPTION. Nada do que a suíte cria ou altera chega
-- a ser gravado.
--
-- COMO RODAR: cole o arquivo inteiro no `execute_sql` do MCP do Supabase. O resultado
-- SEMPRE vem como erro P0001:
--   SUITE_OK     analista_adiou n/n | ...  → tudo passou
--   SUITE_FALHOU analista_adiou k/n | ...  → veja o caso com "ok": false
--

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
  it_criado timestamptz;
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

  -- A6–A8 (Maria, Zélia e Lena, gravação REAL das mensagens pendentes) rodaram em 15/10
  -- antes de o cron ligar, todos OK (commit 51836d7). Depois do cron essas mensagens foram
  -- analisadas de verdade; a regra que eles provavam segue coberta por A2–A5 e A9.

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
        '{"tipo":"ponto_contato","resultado":"adiou","observacao":"Cliente recusou o pedido, está viajando.","trecho_cliente":"Não obrigada"}',
        ARRAY['SUITE_AD_1', 'SUITE_AD_2', 'SUITE_AD_3']);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'nota com "recusou" passou num adiamento'; END IF;

    r := public.rpc_registrar_interacao_ia(v_c2,
           '{"tipo":"ponto_contato","resultado":"adiou","observacao":"Está viajando; retomar na volta.","retomar_em":"2027-03-01","trecho_cliente":"Não obrigada"}',
           ARRAY['SUITE_AD_1', 'SUITE_AD_2', 'SUITE_AD_3']);
    -- Data fora da janela cai para o lembrete de 7 dias (14/10 → 21/10).
    IF r->>'resultado' <> 'adiou' OR r->>'retomar_em' <> '2026-10-21' OR r->>'degradou' IS NULL THEN RAISE EXCEPTION 'janela: %', r; END IF;
    IF r->>'observacao' <> 'Está viajando; retomar na volta. Cliente: "Não obrigada"' THEN RAISE EXCEPTION 'citação: %', r->>'observacao'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A9 nota sem recusa fora de recusou; retomar_em fora da janela vira 7 dias', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A9 nota sem recusa fora de recusou; retomar_em fora da janela vira 7 dias', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A10: orderMessage da E1 fora da fila; o resto da conversa continua nela ──────
  total := total + 1;
  BEGIN
    SELECT count(*) INTO n
      FROM public.wa_pedido_catalogo p JOIN public.mensagens_whatsapp m USING (message_id)
     WHERE p.interacao_id IS NOT NULL AND m.processado_em IS NULL AND NOT m.historico;
    IF n <> 0 THEN RAISE EXCEPTION '% pedido(s) com nota ainda na fila', n; END IF;


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

  -- ── A11: frase do cliente obrigatória e de uma mensagem de ENTRADA ──────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id) VALUES
      ('55' || c_tel || '01', 'SUITE_AD_F1', 'saida',   'Quando voltar, me chama', 'texto', '{}', '2026-10-14 18:00:00+00', v_c1),
      ('55' || c_tel || '01', 'SUITE_AD_F2', 'entrada', 'Estou viajando',          'texto', '{}', '2026-10-14 18:05:00+00', v_c1);
    n := 0;
    BEGIN
      PERFORM public.rpc_registrar_interacao_ia(v_c1, '{"resultado":"respondeu","observacao":"Viajando."}', ARRAY['SUITE_AD_F1', 'SUITE_AD_F2']);
    EXCEPTION WHEN check_violation THEN n := n + 1;
    END;
    BEGIN
      PERFORM public.rpc_registrar_interacao_ia(v_c1, '{"resultado":"adiou","observacao":"Viajando.","trecho_cliente":"Quando voltar, me chama"}', ARRAY['SUITE_AD_F1', 'SUITE_AD_F2']);
    EXCEPTION WHEN check_violation THEN n := n + 1;
    END;
    IF n <> 2 THEN RAISE EXCEPTION 'passou % de 2 notas sem frase do cliente', 2 - n; END IF;
    -- A frase certa (caixa e espaços à parte) passa e vai para o fim da nota.
    r := public.rpc_registrar_interacao_ia(v_c1,
           '{"resultado":"aceitou","observacao":"Combinamos retomar na volta.","trecho_cliente":"  estou   viajando "}',
           ARRAY['SUITE_AD_F1', 'SUITE_AD_F2']);
    IF r->>'observacao' <> 'Combinamos retomar na volta. Cliente: "estou   viajando"' THEN RAISE EXCEPTION 'citação: %', r->>'observacao'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A11 frase do cliente obrigatória, de mensagem de entrada', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A11 frase do cliente obrigatória, de mensagem de entrada', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A12: aceitou_sem_venda ───────────────────────────────────────────────────────
  total := total + 1;
  BEGIN
    -- Fictício sem venda: aceite de 30h atrás aparece; de 10h (tolerância) e de 80h, não.
    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, gerado_por_ia)
    VALUES (v_c2, now() - interval '30 hours', 'ponto_contato', 'whatsapp', 'entrada', 'aceitou', true);
    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, gerado_por_ia)
    VALUES (v_c3, now() - interval '10 hours', 'ponto_contato', 'whatsapp', 'entrada', 'aceitou', true),
           (v_c3, now() - interval '80 hours', 'ponto_contato', 'whatsapp', 'entrada', 'aceitou', true);
    IF NOT EXISTS (SELECT 1 FROM public.aceitou_sem_venda WHERE contato_id = v_c2) THEN RAISE EXCEPTION 'aceite de 30h sem venda não apareceu'; END IF;
    IF EXISTS (SELECT 1 FROM public.aceitou_sem_venda WHERE contato_id = v_c3) THEN RAISE EXCEPTION 'aceite de 10h/80h apareceu'; END IF;

    -- Cliente REAL com venda lançada no dia do aceite (antes da hora da nota): não aparece.
    SELECT v.contato_id, v.criado_em INTO v_real, it_criado
      FROM public.vendas v JOIN public.contatos c ON c.id = v.contato_id
     WHERE v.status IN ('pendente', 'entregue') AND c.arquivado_em IS NULL
       AND v.criado_em BETWEEN now() - interval '70 hours' AND now() - interval '26 hours'
     ORDER BY v.criado_em DESC LIMIT 1;
    IF v_real IS NULL THEN RAISE EXCEPTION 'nenhuma venda real entre 26h e 70h atrás para testar'; END IF;
    INSERT INTO public.interacoes (contato_id, data, tipo, canal, sentido, resultado, gerado_por_ia)
    VALUES (v_real, it_criado + interval '1 hour', 'ponto_contato', 'whatsapp', 'saida', 'aceitou', true);
    IF EXISTS (SELECT 1 FROM public.aceitou_sem_venda WHERE contato_id = v_real AND aceitou_em = it_criado + interval '1 hour') THEN
      RAISE EXCEPTION 'aceite com venda lançada no mesmo dia apareceu';
    END IF;

    -- O app (authenticated, admin) lê a view.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', '627bc83a-8e02-4949-ab6b-7efae29c4ac5', 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM count(*) FROM public.aceitou_sem_venda;
    RESET ROLE;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A12 aceitou_sem_venda: 24h a 72h, venda a partir do dia do aceite', 'ok', true);
  EXCEPTION WHEN others THEN
    IF current_user = 'authenticated' THEN RESET ROLE; END IF;
    resultados := resultados || jsonb_build_object('caso', 'A12 aceitou_sem_venda: 24h a 72h, venda a partir do dia do aceite', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A13: contato arquivado — descarte sem nota; a RPC recusa nota da IA ────────
  total := total + 1;
  BEGIN
    UPDATE public.contatos SET arquivado_em = now() WHERE id = v_c3;
    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id) VALUES
      ('55' || c_tel || '03', 'SUITE_AD_ARQ', 'entrada', 'oi, tudo bem?', 'texto', '{}', '2026-10-15 12:00:00+00', v_c3);
    ok := false;
    BEGIN
      PERFORM public.rpc_registrar_interacao_ia(v_c3, '{"resultado":"respondeu","observacao":"Oi.","trecho_cliente":"oi, tudo bem?"}', ARRAY['SUITE_AD_ARQ']);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'RPC deu nota para contato arquivado'; END IF;
    r := public.rpc_analista_descartar(v_c3, ARRAY['SUITE_AD_ARQ'], 'contato_arquivado');
    IF (SELECT processado_em FROM public.mensagens_whatsapp WHERE message_id = 'SUITE_AD_ARQ') IS NULL THEN RAISE EXCEPTION 'descarte não tirou da fila: %', r; END IF;
    -- Motivo falso não passa: v_c1 não está arquivado.
    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id) VALUES
      ('55' || c_tel || '01', 'SUITE_AD_NAO', 'entrada', 'quero sim', 'texto', '{}', '2026-10-15 12:00:00+00', v_c1);
    ok := false;
    BEGIN
      PERFORM public.rpc_analista_descartar(v_c1, ARRAY['SUITE_AD_NAO'], 'contato_arquivado');
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'descartou contato que não está arquivado'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A13 arquivado: sem nota da IA, descarte conferido', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A13 arquivado: sem nota da IA, descarte conferido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A14: cliente só com marca de mídia — descarte; com texto, não ──────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id) VALUES
      ('55' || c_tel || '01', 'SUITE_AD_M1', 'saida',   'Quer o balde?', 'texto',   '{}', '2026-10-15 13:00:00+00', v_c1),
      ('55' || c_tel || '01', 'SUITE_AD_M2', 'entrada', NULL,            'sticker', '{}', '2026-10-15 13:01:00+00', v_c1);
    ok := false;
    BEGIN
      PERFORM public.rpc_registrar_interacao_ia(v_c1, '{"resultado":"respondeu","observacao":"Mandou figurinha.","trecho_cliente":"[sticker]"}', ARRAY['SUITE_AD_M1', 'SUITE_AD_M2']);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'nota com frase = marca de mídia passou'; END IF;
    r := public.rpc_analista_descartar(v_c1, ARRAY['SUITE_AD_M1', 'SUITE_AD_M2'], 'so_marcador');
    IF (r->>'mensagens')::int <> 2 THEN RAISE EXCEPTION 'descarte: %', r; END IF;
    ok := false;
    BEGIN
      PERFORM public.rpc_analista_descartar(v_c1, ARRAY['SUITE_AD_NAO'], 'so_marcador');
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'descartou segmento com texto do cliente'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A14 só marca de mídia: sem nota; com texto, não descarta', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A14 só marca de mídia: sem nota; com texto, não descarta', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A15: templateMessage reclassificado e fora da fila ──────────────────────────
  total := total + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.mensagens_whatsapp
     WHERE payload -> 'message' ? 'templateMessage'
       AND (tipo_midia <> 'template_empresa' OR processado_em IS NULL);
    IF n <> 0 THEN RAISE EXCEPTION '% templateMessage fora do tipo ou na fila', n; END IF;
    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id) VALUES
      ('55' || c_tel || '01', 'SUITE_AD_T1', 'entrada', NULL, 'template_empresa', '{}', '2026-10-15 14:00:00+00', v_c1);
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A15 template_empresa aceito e o histórico reclassificado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A15 template_empresa aceito e o histórico reclassificado', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A16: pedido do catálogo de contato arquivado: registra o pedido, sem nota ────
  total := total + 1;
  BEGIN
    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id)
    VALUES ('55' || c_tel || '03', 'SUITE_AD_PED2', 'entrada', '🛒 Pedido — 1 item', 'pedido', '{}', now() - interval '1 hour', v_c3);
    SELECT count(*) INTO n FROM public.interacoes WHERE contato_id = v_c3;
    PERFORM public.rpc_registrar_pedido_catalogo_wa('SUITE_AD_PED2', NULL, NULL, 1, 30, 'BRL', NULL);
    IF NOT EXISTS (SELECT 1 FROM public.wa_pedido_catalogo WHERE message_id = 'SUITE_AD_PED2' AND interacao_id IS NULL) THEN RAISE EXCEPTION 'pedido não registrado (ou com nota)'; END IF;
    IF (SELECT count(*) FROM public.interacoes WHERE contato_id = v_c3) <> n THEN RAISE EXCEPTION 'arquivado ganhou nota da IA'; END IF;
    IF (SELECT processado_em FROM public.mensagens_whatsapp WHERE message_id = 'SUITE_AD_PED2') IS NULL THEN RAISE EXCEPTION 'pedido ficou na fila'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A16 pedido de arquivado: registrado, sem nota', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'A16 pedido de arquivado: registrado, sem nota', 'ok', false, 'erro', SQLERRM);
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
