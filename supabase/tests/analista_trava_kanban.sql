-- Suíte: analista no Supabase (E4) — reabertura do Resolvido, trava da IA no kanban,
--        rpc_registrar_interacao_ia (nova assinatura), falhas por segmento e permissões.
--
-- PADRÃO "TRANSAÇÃO DESCARTADA" (ver supabase/tests/meta_eventos_triggers.sql): um único
-- DO-block que SEMPRE termina em RAISE EXCEPTION. Nada do que a suíte cria ou altera —
-- contato, mensagens, interações, status de card de um cliente real — chega a ser gravado.
--
-- COMO RODAR: cole o arquivo inteiro no `execute_sql` do MCP do Supabase. O resultado
-- SEMPRE vem como erro P0001:
--   SUITE_OK     analista_trava_kanban n/n | ...  → tudo passou
--   SUITE_FALHOU analista_trava_kanban k/n | ...  → veja o caso com "ok": false
--
-- Roda como o dono do banco: quem chama estas RPCs em produção é a Edge Function com
-- service_role. O caso K11 troca para `authenticated` para provar que o app NÃO as chama.
-- Nenhum trigger de contatos/interacoes/mensagens_whatsapp faz HTTP; nenhuma sequência
-- visível avança. O caso K7 mexe num cliente REAL da reativação, dentro desta transação.

DO $suite$
DECLARE
  c_tel constant text := '119000016';
  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  total int := 0;
  antes jsonb;

  v_contato uuid;
  v_real uuid;
  v_status text;
  v_col text;
  r jsonb;
  n int;
  it record;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'interacoes', (SELECT count(*) FROM public.interacoes),
    'mensagens_whatsapp', (SELECT count(*) FROM public.mensagens_whatsapp),
    'hash_status', (SELECT md5(string_agg(id::text || coalesce(status_relacionamento::text, '-'), ',' ORDER BY id)) FROM public.contatos)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%' OR telefone_wa LIKE '55' || c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato com o prefixo fictício %', c_tel;
  END IF;

  -- Contato fictício sem vendas: aba leads, nunca reaberto.
  INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
  VALUES ('Suite Analista', c_tel || '01', 'B2C', 'lead', 'whatsapp') RETURNING id INTO v_contato;

  -- ── K1: função de reabertura ───────────────────────────────────────────────────
  total := total + 1;
  BEGIN
    IF NOT public.fn_relacionamento_reaberto('reativacao', NULL) THEN RAISE EXCEPTION 'reativacao deveria reabrir'; END IF;
    IF NOT public.fn_relacionamento_reaberto('recompra', 0) THEN RAISE EXCEPTION 'recompra atraso 0 deveria reabrir'; END IF;
    IF NOT public.fn_relacionamento_reaberto('recompra', 12) THEN RAISE EXCEPTION 'recompra atraso 12 deveria reabrir'; END IF;
    IF public.fn_relacionamento_reaberto('recompra', -1) THEN RAISE EXCEPTION 'recompra atraso -1 não reabre'; END IF;
    IF public.fn_relacionamento_reaberto('recompra', NULL) THEN RAISE EXCEPTION 'recompra sem previsão não reabre'; END IF;
    IF public.fn_relacionamento_reaberto('cobranca', 99) THEN RAISE EXCEPTION 'cobrança nunca reabre sozinha'; END IF;
    IF public.fn_relacionamento_reaberto('leads', 99) THEN RAISE EXCEPTION 'leads não reabre'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K1 regra de reabertura', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K1 regra de reabertura', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K2: a view aplica a reabertura em TODOS os cards (invariante sobre o dado real) ──
  total := total + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.view_relacionamento_kanban
     WHERE status_relacionamento = 'resolvido'
       AND public.fn_relacionamento_reaberto(aba_atual, atraso) <> (coluna_efetiva = 'a_contatar');
    IF n <> 0 THEN RAISE EXCEPTION '% cards em resolvido com coluna incoerente com a regra', n; END IF;
    SELECT count(*) INTO n FROM public.view_relacionamento_kanban
     WHERE status_relacionamento = 'resolvido' AND aba_atual = 'cobranca' AND coluna_efetiva <> 'resolvido';
    IF n <> 0 THEN RAISE EXCEPTION '% cards da cobrança saíram do Resolvido', n; END IF;
    -- Só o Resolvido mudou: nos demais status a coluna segue a regra antiga.
    SELECT count(*) INTO n FROM public.view_relacionamento_kanban
     WHERE status_relacionamento IN ('a_contatar', 'em_negociacao', 'follow_up', 'sem_retorno')
       AND coluna_efetiva <> status_relacionamento;
    IF n <> 0 THEN RAISE EXCEPTION '% cards fora do Resolvido mudaram de coluna', n; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K2 view reabre só o Resolvido vencido', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K2 view reabre só o Resolvido vencido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K3: tabela da trava (coluna efetiva × interação) ────────────────────────────
  total := total + 1;
  BEGIN
    IF public.fn_ia_destino_coluna('a_contatar', 'saida', NULL) IS DISTINCT FROM 'contatado' THEN RAISE EXCEPTION 'a_contatar+saida'; END IF;
    IF public.fn_ia_destino_coluna('contatado', 'saida', NULL) IS NOT NULL THEN RAISE EXCEPTION 'contatado+saida'; END IF;
    IF public.fn_ia_destino_coluna('follow_up', 'saida', NULL) IS NOT NULL THEN RAISE EXCEPTION 'follow_up+saida'; END IF;
    IF public.fn_ia_destino_coluna('em_negociacao', 'saida', NULL) IS NOT NULL THEN RAISE EXCEPTION 'em_negociacao+saida voltaria'; END IF;
    IF public.fn_ia_destino_coluna('a_contatar', 'entrada', NULL) IS DISTINCT FROM 'em_negociacao' THEN RAISE EXCEPTION 'a_contatar+entrada'; END IF;
    IF public.fn_ia_destino_coluna('sem_retorno', 'saida', 'respondeu') IS DISTINCT FROM 'em_negociacao' THEN RAISE EXCEPTION 'sem_retorno+respondeu'; END IF;
    IF public.fn_ia_destino_coluna('em_negociacao', 'entrada', 'recusou') IS DISTINCT FROM 'recusou' THEN RAISE EXCEPTION 'em_negociacao+recusou'; END IF;
    IF public.fn_ia_destino_coluna('recusou', 'entrada', NULL) IS DISTINCT FROM 'em_negociacao' THEN RAISE EXCEPTION 'recusou+entrada'; END IF;
    IF public.fn_ia_destino_coluna('recusou', 'saida', NULL) IS NOT NULL THEN RAISE EXCEPTION 'recusou+saida'; END IF;
    IF public.fn_ia_destino_coluna('resolvido', 'entrada', 'aceitou') IS NOT NULL THEN RAISE EXCEPTION 'resolvido+aceitou'; END IF;
    IF public.fn_ia_destino_coluna('resolvido', 'entrada', 'recusou') IS NOT NULL THEN RAISE EXCEPTION 'resolvido+recusou'; END IF;
    IF public.fn_ia_destino_coluna(NULL, 'entrada', NULL) IS NOT NULL THEN RAISE EXCEPTION 'fora do kanban'; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K3 tabela da trava', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K3 tabela da trava', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K4: trigger com interações da IA — só avança, nunca volta ────────────────────
  total := total + 1;
  BEGIN
    UPDATE public.contatos SET status_relacionamento = 'a_contatar' WHERE id = v_contato;

    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'saida', true);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status <> 'contatado' THEN RAISE EXCEPTION 'saída da IA: esperado contatado, veio %', v_status; END IF;

    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'entrada', true);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status <> 'em_negociacao' THEN RAISE EXCEPTION 'entrada da IA: esperado em_negociacao, veio %', v_status; END IF;

    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'saida', true);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status <> 'em_negociacao' THEN RAISE EXCEPTION 'saída da IA voltou o card para %', v_status; END IF;

    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, resultado, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'entrada', 'recusou', true);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status <> 'recusou' THEN RAISE EXCEPTION 'recusa da IA: esperado recusou, veio %', v_status; END IF;

    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'saida', true);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status <> 'recusou' THEN RAISE EXCEPTION 'saída da IA tirou de recusou para %', v_status; END IF;

    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'entrada', true);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status <> 'em_negociacao' THEN RAISE EXCEPTION 'cliente voltou depois da recusa: esperado em_negociacao, veio %', v_status; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K4 IA só avança', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K4 IA só avança', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K5: Resolvido NÃO reaberto (leads) — a IA não tira nem com resposta ou recusa ──
  total := total + 1;
  BEGIN
    UPDATE public.contatos SET status_relacionamento = 'resolvido' WHERE id = v_contato;
    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, resultado, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'entrada', 'aceitou', true);
    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, resultado, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'entrada', 'recusou', true);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status <> 'resolvido' THEN RAISE EXCEPTION 'IA tirou de resolvido para %', v_status; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K5 IA não mexe em Resolvido fechado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K5 IA não mexe em Resolvido fechado', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K6: interação de GENTE mantém a regra antiga (pode voltar coluna) ─────────────
  total := total + 1;
  BEGIN
    UPDATE public.contatos SET status_relacionamento = 'em_negociacao' WHERE id = v_contato;
    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, gerado_por_ia) VALUES (v_contato, 'ponto_contato', 'whatsapp', 'saida', false);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status <> 'contatado' THEN RAISE EXCEPTION 'interação humana: esperado contatado, veio %', v_status; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K6 humano segue a regra antiga', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K6 humano segue a regra antiga', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K7: cliente REAL da reativação em Resolvido reabre e a IA o move para contatado ──
  total := total + 1;
  BEGIN
    SELECT contato_id INTO v_real FROM public.view_relacionamento_kanban
     WHERE aba_atual = 'reativacao' AND status_relacionamento = 'resolvido' LIMIT 1;
    IF v_real IS NULL THEN RAISE EXCEPTION 'nenhum cliente de reativação em resolvido para testar'; END IF;
    SELECT coluna_efetiva::text INTO v_col FROM public.view_relacionamento_kanban WHERE contato_id = v_real;
    IF v_col <> 'a_contatar' THEN RAISE EXCEPTION 'reativação em resolvido aparece como %', v_col; END IF;

    INSERT INTO public.interacoes (contato_id, tipo, canal, sentido, gerado_por_ia) VALUES (v_real, 'ponto_contato', 'whatsapp', 'saida', true);
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_real;
    IF v_status <> 'contatado' THEN RAISE EXCEPTION 'reativação reaberta + saída da IA: esperado contatado, veio %', v_status; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K7 reativação reaberta vira contatado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K7 reativação reaberta vira contatado', 'ok', false, 'erro', SQLERRM);
  END;

  -- Mensagens fictícias para a RPC: segmento A (nós + recusa explícita), B (só nós).
  UPDATE public.contatos SET status_relacionamento = 'a_contatar' WHERE id = v_contato;
  INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id) VALUES
    ('55' || c_tel || '01', 'SUITE_AN_A1', 'saida',   'Oi! Tem pão de queijo fresquinho hoje.', 'texto', '{}', '2026-10-12 13:59:00+00', v_contato),
    ('55' || c_tel || '01', 'SUITE_AN_A2', 'entrada', 'Não tenho   interesse, obrigada',          'texto', '{}', '2026-10-12 14:05:00+00', v_contato),
    ('55' || c_tel || '01', 'SUITE_AN_B1', 'saida',   'Passando para lembrar da promoção',       'texto', '{}', '2026-10-14 18:37:00+00', v_contato);

  -- ── K8: RPC grava recusa com trecho, data da última mensagem, sentido do banco ────
  total := total + 1;
  BEGIN
    r := public.rpc_registrar_interacao_ia(v_contato,
      '{"tipo":"ponto_contato","sentido":"saida","resultado":"recusou","observacao":"Cliente recusou a oferta.","trecho_cliente":"não tenho interesse"}',
      ARRAY['SUITE_AN_A1', 'SUITE_AN_A2']);
    IF r->>'resultado' IS DISTINCT FROM 'recusou' THEN RAISE EXCEPTION 'resultado %', r; END IF;
    SELECT * INTO it FROM public.interacoes WHERE id = (r->>'interacao_id')::uuid;
    IF it.data <> '2026-10-12 14:05:00+00'::timestamptz THEN RAISE EXCEPTION 'data = %', it.data; END IF;
    IF it.sentido <> 'entrada' THEN RAISE EXCEPTION 'sentido = % (o banco decide: última mensagem é do cliente)', it.sentido; END IF;
    IF it.observacao <> 'Cliente recusou a oferta. Recusa: "não tenho interesse"' THEN RAISE EXCEPTION 'observacao = %', it.observacao; END IF;
    IF r->>'coluna_antes' <> 'a_contatar' OR r->>'status_depois' <> 'recusou' THEN RAISE EXCEPTION 'movimento %', r; END IF;
    SELECT count(*) INTO n FROM public.mensagens_whatsapp WHERE message_id IN ('SUITE_AN_A1', 'SUITE_AN_A2') AND processado_em IS NOT NULL;
    IF n <> 2 THEN RAISE EXCEPTION '% de 2 mensagens processadas', n; END IF;

    -- Idempotência: o mesmo segmento de novo não gera segunda interação.
    r := public.rpc_registrar_interacao_ia(v_contato, '{"observacao":"de novo"}', ARRAY['SUITE_AN_A1', 'SUITE_AN_A2']);
    IF NOT coalesce((r->>'ja_processada')::boolean, false) THEN RAISE EXCEPTION 'segunda chamada: %', r; END IF;
    SELECT count(*) INTO n FROM public.interacoes WHERE contato_id = v_contato AND observacao LIKE 'Cliente recusou%';
    IF n <> 1 THEN RAISE EXCEPTION '% interações para o mesmo segmento', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K8 RPC: recusa com trecho, data e sentido do banco, idempotente', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K8 RPC: recusa com trecho, data e sentido do banco, idempotente', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K9: RPC degrada recusa sem trecho válido e resultado sem mensagem do cliente ───
  total := total + 1;
  BEGIN
    r := public.rpc_registrar_interacao_ia(v_contato,
      '{"tipo":"feedback","resultado":"recusou","observacao":"Só lembrete.","trecho_cliente":"pode tirar meu número"}',
      ARRAY['SUITE_AN_B1']);
    IF r->>'resultado' IS NOT NULL THEN RAISE EXCEPTION 'resultado deveria ser nulo: %', r; END IF;
    IF r->>'degradou' IS NULL THEN RAISE EXCEPTION 'degradação não registrada: %', r; END IF;
    SELECT * INTO it FROM public.interacoes WHERE id = (r->>'interacao_id')::uuid;
    IF it.sentido <> 'saida' OR it.data <> '2026-10-14 18:37:00+00'::timestamptz THEN RAISE EXCEPTION 'sentido/data = %/%', it.sentido, it.data; END IF;
    IF it.observacao LIKE '%Recusa:%' THEN RAISE EXCEPTION 'citou recusa inexistente'; END IF;
    -- Card estava em recusou (K8); só saída da IA não tira de lá.
    IF r->>'status_depois' <> 'recusou' THEN RAISE EXCEPTION 'status_depois %', r; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K9 RPC degrada recusa sem trecho', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K9 RPC degrada recusa sem trecho', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K10: mensagem de outro contato aborta; falhas travam o segmento na 5ª ─────────
  total := total + 1;
  BEGIN
    BEGIN
      PERFORM public.rpc_registrar_interacao_ia(v_real, '{"observacao":"x"}', ARRAY['SUITE_AN_A1']);
      RAISE EXCEPTION 'RPC aceitou mensagem de outro contato';
    EXCEPTION WHEN others THEN
      IF SQLERRM NOT LIKE '%nao pertencem ao contato%' THEN RAISE; END IF;
    END;

    INSERT INTO public.mensagens_whatsapp (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id) VALUES
      ('55' || c_tel || '01', 'SUITE_AN_C1', 'entrada', 'oi', 'texto', '{}', '2026-10-15 01:00:00+00', v_contato),
      ('55' || c_tel || '01', 'SUITE_AN_C2', 'entrada', '???', 'texto', '{}', '2026-10-15 01:01:00+00', v_contato);
    FOR i IN 1..4 LOOP
      r := public.rpc_analista_registrar_falha(ARRAY['SUITE_AN_C1', 'SUITE_AN_C2'], 'resposta inválida ' || i);
      IF (r->>'travado')::boolean THEN RAISE EXCEPTION 'travou cedo, na falha %', i; END IF;
    END LOOP;
    r := public.rpc_analista_registrar_falha(ARRAY['SUITE_AN_C1', 'SUITE_AN_C2'], 'resposta inválida 5');
    IF NOT (r->>'travado')::boolean OR (r->>'falhas')::int <> 5 THEN RAISE EXCEPTION 'quinta falha: %', r; END IF;
    SELECT count(*) INTO n FROM public.mensagens_whatsapp
     WHERE message_id IN ('SUITE_AN_C1', 'SUITE_AN_C2') AND analise_travada_em IS NOT NULL
       AND analise_falhas = 5 AND analise_ultimo_erro = 'resposta inválida 5' AND processado_em IS NULL;
    IF n <> 2 THEN RAISE EXCEPTION '% de 2 mensagens travadas', n; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K10 dono das mensagens e trava na 5ª falha', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'K10 dono das mensagens e trava na 5ª falha', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── K11: prévia da simulação = mesma trava; o app não chama nenhuma das RPCs ───────
  total := total + 1;
  BEGIN
    r := public.rpc_analista_previa(v_contato, 'saida', NULL, 'a_contatar');
    IF r->>'destino' <> 'contatado' THEN RAISE EXCEPTION 'prévia %', r; END IF;
    r := public.rpc_analista_previa(v_contato, 'entrada', NULL);
    IF r->>'coluna_antes' <> 'recusou' OR r->>'destino' <> 'em_negociacao' THEN RAISE EXCEPTION 'prévia real %', r; END IF;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', '627bc83a-8e02-4949-ab6b-7efae29c4ac5', 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    n := 0;
    BEGIN
      PERFORM public.rpc_registrar_interacao_ia(v_contato, '{}', ARRAY['x']);
    EXCEPTION WHEN insufficient_privilege THEN n := n + 1;
    END;
    BEGIN
      PERFORM public.rpc_analista_registrar_falha(ARRAY['x'], 'x');
    EXCEPTION WHEN insufficient_privilege THEN n := n + 1;
    END;
    BEGIN
      PERFORM public.rpc_analista_previa(v_contato, 'saida', NULL);
    EXCEPTION WHEN insufficient_privilege THEN n := n + 1;
    END;
    BEGIN
      INSERT INTO public.wa_analista_rodadas (origem, modelo) VALUES ('manual', 'x');
    EXCEPTION WHEN insufficient_privilege THEN n := n + 1;
    END;
    RESET ROLE;
    IF n <> 4 THEN RAISE EXCEPTION 'app conseguiu chamar % de 4', 4 - n; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'K11 prévia igual à trava e app sem acesso', 'ok', true);
  EXCEPTION WHEN others THEN
    IF current_user = 'authenticated' THEN RESET ROLE; END IF;
    resultados := resultados || jsonb_build_object('caso', 'K11 prévia igual à trava e app sem acesso', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── Fim: SEMPRE aborta. Não existe caminho que grave. ───────────────────────────
  RAISE EXCEPTION '% analista_trava_kanban %/% | contagens_antes=% | %',
    CASE WHEN passou = total THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, total, antes, resultados;
END
$suite$;

-- Contagens para a prova "nada ficou" (rodar ANTES e DEPOIS, à parte):
-- SELECT (SELECT count(*) FROM public.contatos)           AS contatos,
--        (SELECT count(*) FROM public.interacoes)         AS interacoes,
--        (SELECT count(*) FROM public.mensagens_whatsapp) AS mensagens_whatsapp,
--        (SELECT md5(string_agg(id::text || coalesce(status_relacionamento::text, '-'), ',' ORDER BY id))
--           FROM public.contatos)                         AS hash_status;
