-- Suíte: pedido do catálogo NATIVO do WhatsApp (orderMessage) →
--        public.rpc_registrar_pedido_catalogo_wa → wa_pedido_catalogo + nota na timeline.
--
-- PADRÃO "TRANSAÇÃO DESCARTADA" (ver supabase/tests/meta_eventos_triggers.sql): um único
-- DO-block que SEMPRE termina em RAISE EXCEPTION, então nada do que a suíte cria —
-- contato, mensagem, pedido, interação, mudança de kanban — chega a ser gravado.
--
-- COMO RODAR: cole o arquivo inteiro no `execute_sql` do MCP do Supabase. O resultado
-- SEMPRE vem como erro P0001. Leia a mensagem:
--   SUITE_OK     wa_pedido_catalogo 8/8 | [...]   → tudo passou
--   SUITE_FALHOU wa_pedido_catalogo 7/8 | [...]   → veja o caso com "ok": false
--
-- Roda como o dono do banco, não como a conta-teste: quem chama esta RPC em produção é o
-- `whatsapp-ingestor` com service_role, nunca o app. O caso P7 troca para `authenticated`
-- justamente para provar que o app NÃO consegue chamá-la.
-- Nenhum trigger das tabelas tocadas faz HTTP, e nenhuma sequência visível avança.

DO $suite$
DECLARE
  -- Prefixo de telefone fictício; a suíte aborta se já existir alguém com ele.
  c_tel constant text := '119000015';
  c_em constant timestamptz := '2026-10-14 11:27:11+00';
  c_conteudo constant text :=
    '🛒 Pedido pelo catálogo do WhatsApp — 3 itens, total R$ 90,00: Doce de Leite, Baldinho 1kg';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  total int := 0;
  antes jsonb;
  n_pedidos_antes bigint := -1;

  v_contato uuid;
  v_pedido uuid;
  v_segundo uuid;
  n int;
  ped record;
  it record;
  v_status text;
BEGIN
  IF to_regclass('public.wa_pedido_catalogo') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.wa_pedido_catalogo' INTO n_pedidos_antes;
  END IF;
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'interacoes', (SELECT count(*) FROM public.interacoes),
    'mensagens_whatsapp', (SELECT count(*) FROM public.mensagens_whatsapp),
    'wa_pedido_catalogo', n_pedidos_antes
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%' OR telefone_wa LIKE '55' || c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato com o prefixo fictício %', c_tel;
  END IF;

  INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
  VALUES ('Suite Pedido WA', c_tel || '01', 'B2C', 'lead', 'whatsapp') RETURNING id INTO v_contato;

  -- ── P1: o CHECK de tipo_midia aceita 'pedido' ───────────────────────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.mensagens_whatsapp
      (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id)
    VALUES ('55' || c_tel || '01', 'SUITE_PEDIDO_1', 'entrada', c_conteudo, 'pedido', '{}', c_em, v_contato);

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P1 tipo_midia aceita pedido', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P1 tipo_midia aceita pedido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P2: registra o pedido pendente com os dados do WhatsApp ─────────────────────
  total := total + 1;
  BEGIN
    v_pedido := public.rpc_registrar_pedido_catalogo_wa(
      'SUITE_PEDIDO_1', '1090427210245925', 'Doce de Leite, Baldinho 1kg', 3, 90, 'BRL', NULL);
    IF v_pedido IS NULL THEN RAISE EXCEPTION 'RPC devolveu NULL na primeira chamada'; END IF;

    EXECUTE 'SELECT * FROM public.wa_pedido_catalogo WHERE id = $1' INTO ped USING v_pedido;
    IF ped.status <> 'pendente' THEN RAISE EXCEPTION 'status = %', ped.status; END IF;
    IF ped.contato_id <> v_contato THEN RAISE EXCEPTION 'contato_id errado'; END IF;
    IF ped.total <> 90 OR ped.itens_qtd <> 3 THEN RAISE EXCEPTION 'total=% itens=%', ped.total, ped.itens_qtd; END IF;
    IF ped.order_id <> '1090427210245925' THEN RAISE EXCEPTION 'order_id = %', ped.order_id; END IF;
    IF ped.pedido_em <> c_em THEN RAISE EXCEPTION 'pedido_em = % (esperado o instante da mensagem)', ped.pedido_em; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P2 registra pedido pendente', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P2 registra pedido pendente', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P3: a nota na timeline nasce datada do PEDIDO, não de agora ──────────────────
  total := total + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.interacoes WHERE contato_id = v_contato;
    IF n <> 1 THEN RAISE EXCEPTION 'esperada 1 interação, vieram %', n; END IF;
    SELECT * INTO it FROM public.interacoes WHERE contato_id = v_contato;
    IF it.data <> c_em THEN RAISE EXCEPTION 'data = % (esperado %)', it.data, c_em; END IF;
    IF it.tipo <> 'ponto_contato' OR it.sentido <> 'entrada' OR it.resultado <> 'aceitou' THEN
      RAISE EXCEPTION 'tipo/sentido/resultado = %/%/%', it.tipo, it.sentido, it.resultado;
    END IF;
    IF it.canal <> 'whatsapp' OR NOT it.gerado_por_ia THEN RAISE EXCEPTION 'canal=% gerado_por_ia=%', it.canal, it.gerado_por_ia; END IF;
    IF it.observacao NOT LIKE c_conteudo || '%' THEN RAISE EXCEPTION 'observacao = %', it.observacao; END IF;
    EXECUTE 'SELECT interacao_id FROM public.wa_pedido_catalogo WHERE id = $1' INTO ped USING v_pedido;
    IF ped.interacao_id IS DISTINCT FROM it.id THEN RAISE EXCEPTION 'pedido não aponta para a nota'; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P3 nota na timeline datada do pedido', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P3 nota na timeline datada do pedido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P4: o pedido move o kanban para em_negociacao (via trigger existente) ────────
  total := total + 1;
  BEGIN
    SELECT status_relacionamento::text INTO v_status FROM public.contatos WHERE id = v_contato;
    IF v_status IS DISTINCT FROM 'em_negociacao' THEN RAISE EXCEPTION 'status_relacionamento = %', v_status; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P4 kanban em_negociacao', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P4 kanban em_negociacao', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P5: idempotente — reentrega do webhook não duplica pedido nem nota ───────────
  total := total + 1;
  BEGIN
    v_segundo := public.rpc_registrar_pedido_catalogo_wa(
      'SUITE_PEDIDO_1', '1090427210245925', 'Doce de Leite, Baldinho 1kg', 3, 90, 'BRL', NULL);
    IF v_segundo IS NOT NULL THEN RAISE EXCEPTION 'segunda chamada devolveu % (esperado NULL)', v_segundo; END IF;
    EXECUTE 'SELECT count(*) FROM public.wa_pedido_catalogo WHERE message_id = $1' INTO n USING 'SUITE_PEDIDO_1';
    IF n <> 1 THEN RAISE EXCEPTION 'pedidos = %', n; END IF;
    SELECT count(*) INTO n FROM public.interacoes WHERE contato_id = v_contato;
    IF n <> 1 THEN RAISE EXCEPTION 'interações = %', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P5 idempotente', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P5 idempotente', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P6: mensagem inexistente e mensagem de SAÍDA são recusadas ──────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.mensagens_whatsapp
      (telefone_wa, message_id, direcao, conteudo, tipo_midia, payload, enviada_em, contato_id)
    VALUES ('55' || c_tel || '01', 'SUITE_PEDIDO_SAIDA', 'saida', c_conteudo, 'pedido', '{}', c_em, v_contato);

    BEGIN
      PERFORM public.rpc_registrar_pedido_catalogo_wa('SUITE_NAO_EXISTE', NULL, NULL, NULL, NULL, NULL, NULL);
      RAISE EXCEPTION 'aceitou mensagem inexistente';
    EXCEPTION WHEN no_data_found THEN NULL;
    END;
    BEGIN
      PERFORM public.rpc_registrar_pedido_catalogo_wa('SUITE_PEDIDO_SAIDA', NULL, NULL, NULL, NULL, NULL, NULL);
      RAISE EXCEPTION 'aceitou mensagem de saída';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P6 recusa inexistente e saída', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'P6 recusa inexistente e saída', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P7: o app (authenticated) NÃO pode chamar a RPC ─────────────────────────────
  total := total + 1;
  BEGIN
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM public.rpc_registrar_pedido_catalogo_wa('SUITE_PEDIDO_1', NULL, NULL, NULL, NULL, NULL, NULL);
      RESET ROLE;
      RAISE EXCEPTION 'authenticated conseguiu executar a RPC';
    EXCEPTION WHEN insufficient_privilege THEN NULL;  -- o rollback do sub-bloco desfaz o SET ROLE
    END;
    IF current_user = 'authenticated' THEN RAISE EXCEPTION 'role não voltou'; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P7 authenticated sem EXECUTE', 'ok', true);
  EXCEPTION WHEN others THEN
    RESET ROLE;
    resultados := resultados || jsonb_build_object('caso', 'P7 authenticated sem EXECUTE', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── P8: o app (authenticated, admin) só LÊ wa_pedido_catalogo ───────────────────
  total := total + 1;
  BEGIN
    BEGIN
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', '627bc83a-8e02-4949-ab6b-7efae29c4ac5', 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      EXECUTE 'UPDATE public.wa_pedido_catalogo SET status = ''descartado'' WHERE message_id = $1' USING 'SUITE_PEDIDO_1';
      GET DIAGNOSTICS n = ROW_COUNT;
      RESET ROLE;
      IF n <> 0 THEN RAISE EXCEPTION 'authenticated alterou % pedido(s)', n; END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    IF current_user = 'authenticated' THEN RESET ROLE; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'P8 app não altera pedido', 'ok', true);
  EXCEPTION WHEN others THEN
    RESET ROLE;
    resultados := resultados || jsonb_build_object('caso', 'P8 app não altera pedido', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── Fim: SEMPRE aborta. Não existe caminho que grave. ───────────────────────────
  RAISE EXCEPTION '% wa_pedido_catalogo %/% | contagens_antes=% | %',
    CASE WHEN passou = total THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, total, antes, resultados;
END
$suite$;

-- Contagens para a prova "nada ficou" (rodar ANTES e DEPOIS, à parte):
-- SELECT (SELECT count(*) FROM public.contatos)           AS contatos,
--        (SELECT count(*) FROM public.interacoes)         AS interacoes,
--        (SELECT count(*) FROM public.mensagens_whatsapp) AS mensagens_whatsapp,
--        (SELECT count(*) FROM public.wa_pedido_catalogo) AS wa_pedido_catalogo;
