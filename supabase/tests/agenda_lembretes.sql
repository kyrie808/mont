-- Suíte: Agenda de Retornos — tabela lembretes, trg_venda_fecha_lembretes (venda paga fecha,
-- cancelada cancela, estorno/descancelamento reabrem) e as leituras agenda_itens,
-- agenda_atrasados, agenda_sem_data. Migrations: 20261019195019_agenda_lembretes.sql e
-- 20261019203806_agenda_ajustes_e_avisos.sql ("não cobrar", dono = qualquer lembrete
-- pendente, responsavel nas leituras).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA" (ver meta_eventos_triggers.sql): um único DO-block que
-- SEMPRE termina em RAISE EXCEPTION. A exceção aborta a transação inteira — contato, venda,
-- pagamento, lançamento, lembrete, interação, evento na fila: nada é gravado. Não existe
-- caminho de COMMIT.
--
-- COMO RODAR (SQL Editor ou execute_sql do MCP). O resultado SEMPRE vem como erro P0001:
--   SUITE_OK     agenda_lembretes n/n | real=… | contagens_antes=… | [...]  → tudo passou
--   SUITE_FALHOU agenda_lembretes x/n | …                                   → veja "ok": false
--   SUITE_ABORTADA …                                                       → pré-condição falhou
--
--   • ANTES de aplicar a migration (ensaio): cole a migration E este arquivo na MESMA execução.
--     O RAISE final desfaz tudo, inclusive a própria migration. Depois confira que
--     `SELECT to_regclass('public.lembretes')` volta NULL.
--   • DEPOIS de aplicar: rode só este arquivo.
--   Prova de que nada ficou: a mensagem traz as contagens de antes; rode a consulta do rodapé
--   depois e compare — têm que bater.
--
-- Roda COMO A CONTA-TESTE (role authenticated + jwt com o uid dela): RLS, created_by e o
-- auth.uid() dos triggers se comportam como no app. Um caso troca para um uid não-admin.
--
-- O que escapa de rollback (checado em 19/10/2026 no catálogo do banco):
--   • HTTP: nenhum trigger das tabelas tocadas (contatos, vendas, pagamentos_venda,
--     lancamentos, contas, interacoes, cat_pedidos, itens_venda) chama net.http_post/pg_net.
--     meta_eventos é só fila (fn_enfileirar_purchase_meta faz INSERT); o worker não é chamado.
--   • nextval: a única sequência do schema é cat_pedidos.numero_pedido. As vendas da suíte
--     não têm cat_pedido_id, então sync_venda_to_cat_pedido não toca em cat_pedidos.
--   • Estoque: as vendas da suíte não têm itens_venda, então nada é baixado nem devolvido.
--   • Os pagamentos entram numa conta criada pela própria suíte (inativa). Exceção: os brindes
--     da T6 e da T15 nascem entregues (fn_brinde_invariante) e fn_brinde_lanca_despesa lança a saída no
--     Caixa real DENTRO da transação — o rollback desfaz; "saldo_contas" na contagem prova.
--
-- Dados fictícios: telefones com prefixo 119000019 (a suíte aborta se já existir).
-- ENSAIO da 20261019203806: a de lembretes já está aplicada — cole só a 20261019203806
-- e esta suíte na mesma execução.
-- Datas relativas a hoje em Brasília (c_hoje), para a suíte valer em qualquer dia.

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_uid_nao_admin constant uuid := '00000000-0000-4000-8000-00000000abcd';
  c_tel constant text := '119000019';
  c_hoje constant date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  total int := 0;
  antes jsonb;
  v_real jsonb := '{}'::jsonb;

  v_conta uuid;
  v_contato uuid;
  v_contato2 uuid;
  v_venda uuid;
  v_venda2 uuid;
  v_venda3 uuid;
  v_l1 uuid;
  v_l2 uuid;
  v_l3 uuid;
  v_i uuid;
  r public.lembretes%ROWTYPE;
  n int;
  n2 int;
  s numeric;
  s2 numeric;
  t text;
BEGIN
  IF to_regclass('public.lembretes') IS NULL THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: public.lembretes não existe — aplique a migration antes, ou cole a migration junto com esta suíte na mesma execução';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'contatos' AND column_name = 'cobranca_suspensa') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: falta a migration 20261019203806_agenda_ajustes_e_avisos (contatos.cobranca_suspensa) — aplique antes, ou cole junto com esta suíte';
  END IF;

  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'vendas', (SELECT count(*) FROM public.vendas),
    'pagamentos_venda', (SELECT count(*) FROM public.pagamentos_venda),
    'lancamentos', (SELECT count(*) FROM public.lancamentos),
    'contas', (SELECT count(*) FROM public.contas),
    'saldo_contas', (SELECT COALESCE(sum(saldo_atual), 0) FROM public.contas),
    'interacoes', (SELECT count(*) FROM public.interacoes),
    'meta_eventos', (SELECT count(*) FROM public.meta_eventos),
    'lembretes', (SELECT count(*) FROM public.lembretes)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%' OR telefone_wa LIKE '55' || c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato com o prefixo fictício %', c_tel;
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = c_uid_nao_admin) THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: o uid "não admin" da suíte está em admin_users';
  END IF;

  -- ── E0: estrutura (antes de virar a conta-teste: lê o catálogo como dono) ─────────
  total := total + 1;
  BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lembretes'::regclass) THEN
      RAISE EXCEPTION 'RLS desligado em lembretes';
    END IF;
    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lembretes';
    IF n <> 4 THEN RAISE EXCEPTION 'esperado 4 policies em lembretes, veio %', n; END IF;
    IF has_table_privilege('anon', 'public.lembretes', 'SELECT')
       OR has_table_privilege('anon', 'public.lembretes', 'INSERT') THEN
      RAISE EXCEPTION 'anon tem privilégio em lembretes';
    END IF;
    IF has_function_privilege('anon', 'public.agenda_itens(date,date)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.agenda_atrasados()', 'EXECUTE')
       OR has_function_privilege('anon', 'public.agenda_sem_data()', 'EXECUTE') THEN
      RAISE EXCEPTION 'anon executa função da agenda';
    END IF;
    IF NOT (has_function_privilege('authenticated', 'public.agenda_itens(date,date)', 'EXECUTE')
            AND has_function_privilege('authenticated', 'public.agenda_atrasados()', 'EXECUTE')
            AND has_function_privilege('authenticated', 'public.agenda_sem_data()', 'EXECUTE')
            AND has_function_privilege('service_role', 'public.agenda_itens(date,date)', 'EXECUTE')) THEN
      RAISE EXCEPTION 'authenticated/service_role sem EXECUTE nas funções da agenda';
    END IF;
    SELECT count(*) INTO n FROM pg_trigger
     WHERE NOT tgisinternal AND tgenabled <> 'D'
       AND ((tgrelid = 'public.vendas'::regclass AND tgname = 'trg_venda_fecha_lembretes')
         OR (tgrelid = 'public.lembretes'::regclass AND tgname IN ('tr_lembretes_audit', 'trg_lembretes_regras'))
         OR (tgrelid = 'public.pagamentos_venda'::regclass AND tgname = 'trigger_update_venda_pagamento'));
    IF n <> 4 THEN RAISE EXCEPTION 'esperado 4 triggers (3 novos + o de pagamentos_venda intacto), veio %', n; END IF;
    FOR t IN SELECT unnest(ARRAY['public.agenda_itens(date,date)', 'public.agenda_atrasados()', 'public.agenda_sem_data()']) LOOP
      IF pg_get_functiondef(t::regprocedure) NOT LIKE '%America/Sao_Paulo%' THEN
        RAISE EXCEPTION '% não fixa o fuso America/Sao_Paulo', t;
      END IF;
      IF pg_get_functiondef(t::regprocedure) NOT LIKE '%forma_pagamento <> ''brinde''%' THEN
        RAISE EXCEPTION '% não exclui brinde', t;
      END IF;
      IF pg_get_functiondef(t::regprocedure) NOT LIKE '%NOT c.cobranca_suspensa%' THEN
        RAISE EXCEPTION '% não respeita cobranca_suspensa', t;
      END IF;
    END LOOP;
    SELECT count(*) INTO n FROM pg_proc p
     WHERE p.oid IN ('public.agenda_itens(date,date)'::regprocedure, 'public.agenda_atrasados()'::regprocedure)
       AND 'responsavel' = ANY (p.proargnames);
    IF n <> 2 THEN RAISE EXCEPTION 'agenda_itens/agenda_atrasados sem a coluna responsavel (% de 2)', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'E0 estrutura: RLS, policies, grants, triggers, fuso, brinde, não cobrar e responsavel', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'E0 estrutura: RLS, policies, grants, triggers, fuso, brinde, não cobrar e responsavel', 'ok', false, 'erro', SQLERRM);
  END;

  -- Daqui pra frente, tudo roda como a conta-teste.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;

  -- ── R1/R2/R3: dados REAIS — a função bate com SELECT direto (antes de criar qualquer coisa) ─
  -- O SELECT direto aplica as mesmas regras da função: em aberto, não cancelada, sem brinde,
  -- sem lembrete pendente ligado (qualquer tipo: o lembrete é o dono da venda na agenda) e
  -- sem cliente com a cobrança suspensa.
  total := total + 1;
  BEGIN
    SELECT count(*), COALESCE(sum(a.valor), 0) INTO n, s
      FROM public.agenda_itens('2026-11-01', '2026-11-30') a
     WHERE a.origem = 'vencimento' AND a.data = '2026-11-13';
    SELECT count(*), COALESCE(sum(v.total - COALESCE(v.valor_pago, 0)), 0) INTO n2, s2
      FROM public.vendas v
     WHERE NOT v.pago AND v.status <> 'cancelada' AND v.forma_pagamento <> 'brinde'
       AND v.data_prevista_pagamento = '2026-11-13'
       AND NOT EXISTS (SELECT 1 FROM public.lembretes lp WHERE lp.venda_id = v.id AND lp.situacao = 'pendente')
       AND NOT (SELECT c.cobranca_suspensa FROM public.contatos c WHERE c.id = v.contato_id);
    IF n <> n2 OR s <> s2 THEN RAISE EXCEPTION '13/11: função %/R$ %, SELECT %/R$ %', n, s, n2, s2; END IF;
    v_real := v_real || jsonb_build_object('vencimentos_13_11', n, 'valor_13_11', s);

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'R1 13/11: agenda_itens = SELECT direto', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'R1 13/11: agenda_itens = SELECT direto', 'ok', false, 'erro', SQLERRM);
  END;

  total := total + 1;
  BEGIN
    SELECT count(*), COALESCE(sum(a.valor), 0) INTO n, s
      FROM public.agenda_itens('2026-11-01', '2026-11-30') a WHERE a.origem = 'vencimento';
    SELECT count(*), COALESCE(sum(v.total - COALESCE(v.valor_pago, 0)), 0) INTO n2, s2
      FROM public.vendas v
     WHERE NOT v.pago AND v.status <> 'cancelada' AND v.forma_pagamento <> 'brinde'
       AND v.data_prevista_pagamento BETWEEN '2026-11-01' AND '2026-11-30'
       AND NOT EXISTS (SELECT 1 FROM public.lembretes lp WHERE lp.venda_id = v.id AND lp.situacao = 'pendente')
       AND NOT (SELECT c.cobranca_suspensa FROM public.contatos c WHERE c.id = v.contato_id);
    IF n <> n2 OR s <> s2 THEN RAISE EXCEPTION 'nov: função %/R$ %, SELECT %/R$ %', n, s, n2, s2; END IF;
    v_real := v_real || jsonb_build_object('vencimentos_nov', n, 'valor_nov', s);

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'R2 novembro inteiro: agenda_itens = SELECT direto', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'R2 novembro inteiro: agenda_itens = SELECT direto', 'ok', false, 'erro', SQLERRM);
  END;

  total := total + 1;
  BEGIN
    SELECT count(*), COALESCE(sum(a.valor), 0) INTO n, s
      FROM public.agenda_atrasados() a WHERE a.origem = 'vencimento';
    SELECT count(*), COALESCE(sum(v.total - COALESCE(v.valor_pago, 0)), 0) INTO n2, s2
      FROM public.vendas v
     WHERE NOT v.pago AND v.status <> 'cancelada' AND v.forma_pagamento <> 'brinde'
       AND v.data_prevista_pagamento < c_hoje
       AND NOT EXISTS (SELECT 1 FROM public.lembretes lp WHERE lp.venda_id = v.id AND lp.situacao = 'pendente')
       AND NOT (SELECT c.cobranca_suspensa FROM public.contatos c WHERE c.id = v.contato_id);
    IF n <> n2 OR s <> s2 THEN RAISE EXCEPTION 'atrasados: função %/R$ %, SELECT %/R$ %', n, s, n2, s2; END IF;
    v_real := v_real || jsonb_build_object('vencimentos_atrasados', n, 'valor_atrasados', s);

    SELECT count(*), COALESCE(sum(a.valor), 0) INTO n, s FROM public.agenda_sem_data() a;
    SELECT count(*), COALESCE(sum(v.total - COALESCE(v.valor_pago, 0)), 0) INTO n2, s2
      FROM public.vendas v
     WHERE NOT v.pago AND v.status <> 'cancelada' AND v.forma_pagamento <> 'brinde'
       AND v.data_prevista_pagamento IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.lembretes lp WHERE lp.venda_id = v.id AND lp.situacao = 'pendente')
       AND NOT (SELECT c.cobranca_suspensa FROM public.contatos c WHERE c.id = v.contato_id);
    IF n <> n2 OR s <> s2 THEN RAISE EXCEPTION 'sem data: função %/R$ %, SELECT %/R$ %', n, s, n2, s2; END IF;
    v_real := v_real || jsonb_build_object('sem_data', n, 'valor_sem_data', s,
      'sem_data_por_forma', (SELECT jsonb_object_agg(x.forma_pagamento, x.n)
                               FROM (SELECT a.forma_pagamento, count(*) AS n FROM public.agenda_sem_data() a GROUP BY 1) x));

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'R3 atrasados e sem data: funções = SELECT direto', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'R3 atrasados e sem data: funções = SELECT direto', 'ok', false, 'erro', SQLERRM);
  END;

  -- Conta própria da suíte para receber os pagamentos (inativa; morre no rollback).
  INSERT INTO public.contas (nome, tipo, saldo_inicial, ativo)
  VALUES ('Suite Agenda', 'pix', 0, false) RETURNING id INTO v_conta;

  -- ── T1: quitar a venda fecha a parcela (venda_paga); pendência interna fica ───────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T1', c_tel || '01', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 100, false, 'sistema', c_hoje + 20) RETURNING id INTO v_venda;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite parcela', c_hoje + 20, 'parcela', v_venda) RETURNING id INTO v_l1;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite pendência', c_hoje + 20, 'pendencia_interna', v_venda) RETURNING id INTO v_l2;

    PERFORM public.registrar_pagamento_venda(v_venda, 100, 'pix', c_hoje, v_conta, 'suite agenda T1');

    IF NOT (SELECT v.pago FROM public.vendas v WHERE v.id = v_venda) THEN RAISE EXCEPTION 'venda não ficou paga'; END IF;
    SELECT * INTO r FROM public.lembretes WHERE id = v_l1;
    IF r.situacao <> 'feito' OR r.motivo_conclusao IS DISTINCT FROM 'venda_paga' THEN
      RAISE EXCEPTION 'parcela: situacao=% motivo=%', r.situacao, r.motivo_conclusao;
    END IF;
    IF r.concluido_em IS NULL THEN RAISE EXCEPTION 'parcela sem concluido_em'; END IF;
    IF r.concluido_por IS DISTINCT FROM c_uid_teste THEN RAISE EXCEPTION 'concluido_por = %', r.concluido_por; END IF;
    IF r.contato_id IS DISTINCT FROM v_contato THEN RAISE EXCEPTION 'contato não veio da venda'; END IF;
    IF r.created_by IS DISTINCT FROM c_uid_teste THEN RAISE EXCEPTION 'created_by = %', r.created_by; END IF;
    SELECT * INTO r FROM public.lembretes WHERE id = v_l2;
    IF r.situacao <> 'pendente' THEN RAISE EXCEPTION 'pendência interna fechou: %', r.situacao; END IF;
    IF EXISTS (SELECT 1 FROM public.agenda_itens(c_hoje, c_hoje + 30) a WHERE a.origem = 'vencimento' AND a.id = v_venda) THEN
      RAISE EXCEPTION 'venda paga continua como vencimento';
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T1 quitar fecha parcela (venda_paga), pendência interna fica', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T1 quitar fecha parcela (venda_paga), pendência interna fica', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T2: pagamento parcial não fecha nada; a agenda mostra o valor em aberto ───────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T2', c_tel || '02', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 100, false, 'sistema', c_hoje + 21) RETURNING id INTO v_venda;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite parcela parcial', c_hoje + 21, 'parcela', v_venda) RETURNING id INTO v_l1;

    PERFORM public.registrar_pagamento_venda(v_venda, 30, 'pix', c_hoje, v_conta, 'suite agenda T2');

    IF (SELECT v.pago FROM public.vendas v WHERE v.id = v_venda) THEN RAISE EXCEPTION 'venda ficou paga com 30 de 100'; END IF;
    IF (SELECT l.situacao FROM public.lembretes l WHERE l.id = v_l1) <> 'pendente' THEN
      RAISE EXCEPTION 'parcial fechou o lembrete';
    END IF;
    -- Lembrete sem valor próprio mostra o em aberto da venda; o vencimento não duplica.
    SELECT a.valor INTO s FROM public.agenda_itens(c_hoje + 21, c_hoje + 21) a WHERE a.origem = 'lembrete' AND a.id = v_l1;
    IF s IS DISTINCT FROM 70 THEN RAISE EXCEPTION 'lembrete valor = % (esperado 70)', s; END IF;
    IF EXISTS (SELECT 1 FROM public.agenda_itens(c_hoje + 21, c_hoje + 21) a WHERE a.origem = 'vencimento' AND a.id = v_venda) THEN
      RAISE EXCEPTION 'vencimento duplicou a parcela pendente';
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T2 pagamento parcial não fecha; lembrete mostra o em aberto 70', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T2 pagamento parcial não fecha; lembrete mostra o em aberto 70', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T3: estorno reabre SÓ o que o pagamento fechou ────────────────────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T3', c_tel || '03', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 100, false, 'sistema', c_hoje + 22) RETURNING id INTO v_venda;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite cobrança A', c_hoje + 22, 'cobranca', v_venda) RETURNING id INTO v_l1;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite cobrança B (feita à mão)', c_hoje + 22, 'cobranca', v_venda) RETURNING id INTO v_l2;
    UPDATE public.lembretes SET situacao = 'feito' WHERE id = v_l2;

    PERFORM public.registrar_pagamento_venda(v_venda, 100, 'pix', c_hoje, v_conta, 'suite agenda T3');
    IF (SELECT l.motivo_conclusao FROM public.lembretes l WHERE l.id = v_l1) IS DISTINCT FROM 'venda_paga' THEN
      RAISE EXCEPTION 'A não fechou como venda_paga';
    END IF;

    -- Estorno como no vendaService.deleteUltimoPagamento: lançamentos, depois o pagamento.
    DELETE FROM public.lancamentos WHERE venda_id = v_venda;
    DELETE FROM public.pagamentos_venda WHERE venda_id = v_venda;

    IF (SELECT v.pago FROM public.vendas v WHERE v.id = v_venda) THEN RAISE EXCEPTION 'estorno não voltou pago=false'; END IF;
    SELECT * INTO r FROM public.lembretes WHERE id = v_l1;
    IF r.situacao <> 'pendente' OR r.concluido_em IS NOT NULL OR r.concluido_por IS NOT NULL OR r.motivo_conclusao IS NOT NULL THEN
      RAISE EXCEPTION 'A não reabriu limpo: situacao=% motivo=%', r.situacao, r.motivo_conclusao;
    END IF;
    SELECT * INTO r FROM public.lembretes WHERE id = v_l2;
    IF r.situacao <> 'feito' OR r.motivo_conclusao IS DISTINCT FROM 'manual' THEN
      RAISE EXCEPTION 'B (manual) mudou: situacao=% motivo=%', r.situacao, r.motivo_conclusao;
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T3 estorno reabre só o que o pagamento fechou', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T3 estorno reabre só o que o pagamento fechou', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T4: marcar pago direto na venda (updateVenda) também fecha ───────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T4', c_tel || '04', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 50, false, 'sistema', c_hoje + 23) RETURNING id INTO v_venda;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite cobrança T4', c_hoje + 23, 'cobranca', v_venda) RETURNING id INTO v_l1;

    UPDATE public.vendas SET pago = true WHERE id = v_venda;

    SELECT * INTO r FROM public.lembretes WHERE id = v_l1;
    IF r.situacao <> 'feito' OR r.motivo_conclusao IS DISTINCT FROM 'venda_paga' THEN
      RAISE EXCEPTION 'situacao=% motivo=%', r.situacao, r.motivo_conclusao;
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T4 pago marcado direto fecha', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T4 pago marcado direto fecha', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T5: cancelar (status+pago no mesmo UPDATE, como cancelVenda) e descancelar ────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T5', c_tel || '05', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 80, false, 'sistema', c_hoje + 24) RETURNING id INTO v_venda;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite parcela T5', c_hoje + 24, 'parcela', v_venda) RETURNING id INTO v_l1;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite cobrança T5', c_hoje + 24, 'cobranca', v_venda) RETURNING id INTO v_l2;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite devolver dinheiro', c_hoje + 24, 'pendencia_interna', v_venda) RETURNING id INTO v_l3;

    UPDATE public.vendas SET status = 'cancelada', pago = false WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.lembretes
     WHERE id IN (v_l1, v_l2) AND situacao = 'cancelado' AND motivo_conclusao = 'venda_cancelada' AND concluido_em IS NOT NULL;
    IF n <> 2 THEN RAISE EXCEPTION 'cancelamento fechou % de 2', n; END IF;
    IF (SELECT l.situacao FROM public.lembretes l WHERE l.id = v_l3) <> 'pendente' THEN
      RAISE EXCEPTION 'pendência interna foi cancelada junto';
    END IF;

    UPDATE public.vendas SET status = 'entregue' WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.lembretes
     WHERE id IN (v_l1, v_l2, v_l3) AND situacao = 'pendente' AND motivo_conclusao IS NULL AND concluido_em IS NULL;
    IF n <> 3 THEN RAISE EXCEPTION 'descancelamento: % de 3 pendentes', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T5 cancelar cancela parcela/cobrança (pendência fica); descancelar reabre', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T5 cancelar cancela parcela/cobrança (pendência fica); descancelar reabre', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T6: cancelada e brinde não aparecem como vencimento nem entrega ───────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T6', c_tel || '06', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    -- controle positivo: fiado pendente com previsão de pagamento e de entrega
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento, data_entrega_prevista)
    VALUES (v_contato, c_hoje, 'pendente', 'fiado', 60, false, 'sistema', c_hoje + 25, c_hoje + 25) RETURNING id INTO v_venda;
    -- vai ser cancelada
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento, data_entrega_prevista)
    VALUES (v_contato, c_hoje, 'pendente', 'fiado', 60, false, 'sistema', c_hoje + 25, c_hoje + 25) RETURNING id INTO v_venda2;
    -- brinde (nasce entregue por fn_brinde_invariante, com previsão de pagamento preenchida)
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento, data_entrega_prevista)
    VALUES (v_contato, c_hoje, 'pendente', 'brinde', 60, false, 'sistema', c_hoje + 25, c_hoje + 25) RETURNING id INTO v_venda3;

    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 25, c_hoje + 25) a
     WHERE a.origem = 'vencimento' AND a.id = v_venda AND a.valor = 60 AND a.contato_telefone = c_tel || '06';
    IF n <> 1 THEN RAISE EXCEPTION 'controle: vencimento não apareceu (ou sem telefone)'; END IF;
    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 25, c_hoje + 25) a WHERE a.origem = 'entrega' AND a.id = v_venda;
    IF n <> 1 THEN RAISE EXCEPTION 'controle: entrega não apareceu'; END IF;
    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 25, c_hoje + 25) a WHERE a.origem = 'vencimento' AND a.id = v_venda2;
    IF n <> 1 THEN RAISE EXCEPTION 'antes de cancelar, a 2ª venda devia aparecer'; END IF;

    UPDATE public.vendas SET status = 'cancelada', pago = false WHERE id = v_venda2;

    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 25, c_hoje + 25) a WHERE a.id IN (v_venda2, v_venda3);
    IF n <> 0 THEN RAISE EXCEPTION 'cancelada/brinde apareceram % vez(es)', n; END IF;
    SELECT count(*) INTO n FROM public.agenda_sem_data() a WHERE a.venda_id IN (v_venda2, v_venda3);
    IF n <> 0 THEN RAISE EXCEPTION 'cancelada/brinde no sem_data'; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T6 cancelada fora de vencimento/entrega; brinde fora de vencimento', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T6 cancelada fora de vencimento/entrega; brinde fora de vencimento', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T7: atrasados — o corte é hoje em Brasília ─────────────────────────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T7', c_tel || '07', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.lembretes (titulo, data, tipo, contato_id)
    VALUES ('Suite ontem', c_hoje - 1, 'pendencia_interna', v_contato) RETURNING id INTO v_l1;
    INSERT INTO public.lembretes (titulo, data, tipo, contato_id)
    VALUES ('Suite hoje', c_hoje, 'pendencia_interna', v_contato) RETURNING id INTO v_l2;
    INSERT INTO public.lembretes (titulo, data, tipo, contato_id, situacao)
    VALUES ('Suite feito anteontem', c_hoje - 2, 'outro', v_contato, 'feito') RETURNING id INTO v_l3;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje - 10, 'entregue', 'fiado', 40, false, 'sistema', c_hoje - 1) RETURNING id INTO v_venda;

    -- inserir já feito carimba a conclusão
    SELECT * INTO r FROM public.lembretes WHERE id = v_l3;
    IF r.concluido_em IS NULL OR r.motivo_conclusao IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'insert feito sem conclusão'; END IF;

    SELECT count(*) INTO n FROM public.agenda_atrasados() a WHERE a.origem = 'lembrete' AND a.id = v_l1;
    IF n <> 1 THEN RAISE EXCEPTION 'lembrete de ontem fora dos atrasados'; END IF;
    SELECT count(*) INTO n FROM public.agenda_atrasados() a WHERE a.id IN (v_l2, v_l3);
    IF n <> 0 THEN RAISE EXCEPTION 'hoje/feito entraram nos atrasados'; END IF;
    SELECT count(*) INTO n FROM public.agenda_atrasados() a WHERE a.origem = 'vencimento' AND a.id = v_venda AND a.valor = 40;
    IF n <> 1 THEN RAISE EXCEPTION 'vencimento de ontem fora dos atrasados'; END IF;
    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje - 1, c_hoje) a
     WHERE (a.id = v_l1 AND a.atrasado) OR (a.id = v_l2 AND NOT a.atrasado) OR (a.id = v_venda AND a.atrasado);
    IF n <> 3 THEN RAISE EXCEPTION 'flag atrasado errada em agenda_itens (% de 3)', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T7 atrasados: lembrete e vencimento de ontem; hoje e feito não', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T7 atrasados: lembrete e vencimento de ontem; hoje e feito não', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T8: sem data — em aberto sem previsão aparece; paga não ──────────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T8', c_tel || '08', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje - 5, 'entregue', 'venda', 90, false, 'sistema') RETURNING id INTO v_venda;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje - 5, 'entregue', 'pix', 90, true, 'sistema') RETURNING id INTO v_venda2;

    SELECT count(*) INTO n FROM public.agenda_sem_data() a
     WHERE a.venda_id = v_venda AND a.forma_pagamento = 'venda' AND a.valor = 90 AND a.dias_em_aberto = 5
       AND a.contato_telefone = c_tel || '08';
    IF n <> 1 THEN RAISE EXCEPTION 'venda em aberto sem previsão não apareceu certa'; END IF;
    IF EXISTS (SELECT 1 FROM public.agenda_sem_data() a WHERE a.venda_id = v_venda2) THEN
      RAISE EXCEPTION 'venda paga no sem_data';
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T8 sem data: em aberto aparece (qualquer forma), paga não', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T8 sem data: em aberto aparece (qualquer forma), paga não', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T9: excluir a venda não falha; o lembrete fica sem o vínculo ──────────────────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T9', c_tel || '09', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje, 'pendente', 'fiado', 30, false, 'sistema') RETURNING id INTO v_venda;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite venda excluída', c_hoje + 3, 'cobranca', v_venda) RETURNING id INTO v_l1;

    DELETE FROM public.vendas WHERE id = v_venda;

    SELECT * INTO r FROM public.lembretes WHERE id = v_l1;
    IF NOT FOUND THEN RAISE EXCEPTION 'lembrete sumiu junto com a venda'; END IF;
    IF r.venda_id IS NOT NULL THEN RAISE EXCEPTION 'venda_id não virou NULL'; END IF;
    IF r.contato_id IS DISTINCT FROM v_contato THEN RAISE EXCEPTION 'perdeu o contato'; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T9 excluir venda: lembrete fica, venda_id NULL', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T9 excluir venda: lembrete fica, venda_id NULL', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T10: reagendar soma o contador (só o banco mexe nele); concluir e reabrir à mão ─
  total := total + 1;
  BEGIN
    INSERT INTO public.lembretes (titulo, data, tipo, responsavel, origem, vezes_reagendado)
    VALUES ('Suite reagendar', c_hoje + 1, 'outro', 'gilmar', 'claude', 7) RETURNING id INTO v_l1;
    IF (SELECT l.vezes_reagendado FROM public.lembretes l WHERE l.id = v_l1) <> 0 THEN
      RAISE EXCEPTION 'insert aceitou contador vindo de fora';
    END IF;

    UPDATE public.lembretes SET data = data + 1 WHERE id = v_l1;
    UPDATE public.lembretes SET data = data + 7 WHERE id = v_l1;
    UPDATE public.lembretes SET titulo = 'Suite reagendar (editado)' WHERE id = v_l1;
    UPDATE public.lembretes SET vezes_reagendado = 99 WHERE id = v_l1;
    SELECT * INTO r FROM public.lembretes WHERE id = v_l1;
    IF r.vezes_reagendado <> 2 THEN RAISE EXCEPTION 'contador = % (esperado 2)', r.vezes_reagendado; END IF;
    IF r.data <> c_hoje + 9 THEN RAISE EXCEPTION 'data = %', r.data; END IF;

    UPDATE public.lembretes SET situacao = 'feito' WHERE id = v_l1;
    SELECT * INTO r FROM public.lembretes WHERE id = v_l1;
    IF r.concluido_em IS NULL OR r.motivo_conclusao IS DISTINCT FROM 'manual' OR r.concluido_por IS DISTINCT FROM c_uid_teste THEN
      RAISE EXCEPTION 'conclusão manual: em=% motivo=% por=%', r.concluido_em, r.motivo_conclusao, r.concluido_por;
    END IF;
    UPDATE public.lembretes SET data = data + 1 WHERE id = v_l1;
    IF (SELECT l.vezes_reagendado FROM public.lembretes l WHERE l.id = v_l1) <> 2 THEN
      RAISE EXCEPTION 'mudar data de lembrete feito contou reagendamento';
    END IF;

    UPDATE public.lembretes SET situacao = 'pendente' WHERE id = v_l1;
    SELECT * INTO r FROM public.lembretes WHERE id = v_l1;
    IF r.concluido_em IS NOT NULL OR r.motivo_conclusao IS NOT NULL OR r.concluido_por IS NOT NULL THEN
      RAISE EXCEPTION 'reabrir não limpou a conclusão';
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T10 reagendar conta 2; concluir carimba; reabrir limpa', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T10 reagendar conta 2; concluir carimba; reabrir limpa', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T11: integridade — venda de outro cliente e valores fora do vocabulário ───────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T11a', c_tel || '11', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T11b', c_tel || '12', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato2;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 30, false, 'sistema') RETURNING id INTO v_venda;

    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo, venda_id, contato_id)
      VALUES ('Suite cliente errado', c_hoje, 'cobranca', v_venda, v_contato2);
      RAISE EXCEPTION 'aceitou lembrete com venda de outro cliente';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo) VALUES ('Suite tipo', c_hoje, 'visita');
      RAISE EXCEPTION 'aceitou tipo inválido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo, responsavel) VALUES ('Suite resp', c_hoje, 'outro', 'joao');
      RAISE EXCEPTION 'aceitou responsável inválido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo) VALUES ('   ', c_hoje, 'outro');
      RAISE EXCEPTION 'aceitou título vazio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo, situacao, motivo_conclusao)
      VALUES ('Suite motivo', c_hoje, 'outro', 'cancelado', 'venda_paga');
      RAISE EXCEPTION 'aceitou cancelado com motivo venda_paga';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo, origem) VALUES ('Suite origem', c_hoje, 'outro', 'n8n');
      RAISE EXCEPTION 'aceitou origem inválida';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo, valor) VALUES ('Suite valor zero', c_hoje, 'outro', 0);
      RAISE EXCEPTION 'aceitou valor 0';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo, valor) VALUES ('Suite valor negativo', c_hoje, 'outro', -5);
      RAISE EXCEPTION 'aceitou valor negativo';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T11 integridade: cliente da venda, vocabulário e valor positivo', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T11 integridade: cliente da venda, vocabulário e valor positivo', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T12: retomada (interacoes.retomar_em) aparece; some quando o cliente responde ──
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T12', c_tel || '13', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.interacoes (contato_id, data, canal, tipo, sentido, resultado, retomar_em, observacao, criado_por)
    VALUES (v_contato, now() - interval '2 hours', 'whatsapp', 'ponto_contato', 'saida', 'adiou', c_hoje + 3,
            'Suite: me chama semana que vem', auth.uid())
    RETURNING id INTO v_i;

    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 3, c_hoje + 3) a
     WHERE a.origem = 'retomada' AND a.id = v_i AND a.contato_id = v_contato AND a.contato_telefone = c_tel || '13';
    IF n <> 1 THEN RAISE EXCEPTION 'retomada não apareceu (status_relacionamento=%)',
      (SELECT c.status_relacionamento FROM public.contatos c WHERE c.id = v_contato); END IF;

    INSERT INTO public.interacoes (contato_id, data, canal, tipo, sentido, criado_por)
    VALUES (v_contato, now() - interval '1 hour', 'whatsapp', 'ponto_contato', 'entrada', auth.uid());

    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 3, c_hoje + 3) a WHERE a.origem = 'retomada' AND a.id = v_i;
    IF n <> 0 THEN RAISE EXCEPTION 'retomada continuou depois da resposta do cliente'; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T12 retomada aparece e some com a resposta', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T12 retomada aparece e some com a resposta', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T14: uma dívida, um item — a parcela pendente é a dona da cobrança ─────────────
  -- Forma da Ana Maria: venda de R$ 65 com previsão no dia X e parcela de R$ 32,50 no dia X.
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T14', c_tel || '14', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;

    -- (a) uma parcela: só o lembrete aparece, com o valor da parcela; feita, o vencimento volta
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 65, false, 'sistema', c_hoje + 26) RETURNING id INTO v_venda;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id, valor)
    VALUES ('Suite 1ª parcela', c_hoje + 26, 'parcela', v_venda, 32.50) RETURNING id INTO v_l1;

    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 26, c_hoje + 26) a WHERE a.venda_id = v_venda;
    IF n <> 1 THEN RAISE EXCEPTION '(a) esperado só o lembrete no dia, vieram % itens da venda', n; END IF;
    SELECT a.valor INTO s FROM public.agenda_itens(c_hoje + 26, c_hoje + 26) a WHERE a.origem = 'lembrete' AND a.id = v_l1;
    IF s IS DISTINCT FROM 32.50 THEN RAISE EXCEPTION '(a) lembrete valor = % (esperado 32,50)', s; END IF;

    UPDATE public.lembretes SET situacao = 'feito' WHERE id = v_l1;

    SELECT a.valor INTO s FROM public.agenda_itens(c_hoje + 26, c_hoje + 26) a WHERE a.origem = 'vencimento' AND a.id = v_venda;
    IF s IS DISTINCT FROM 65 THEN RAISE EXCEPTION '(a) feito o lembrete, vencimento = % (esperado 65, a venda segue em aberto)', s; END IF;

    -- (b) duas parcelas (07/11 e 07/12 da Ana Maria): feita a 1ª, a 2ª ainda é a dona
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 65, false, 'sistema', c_hoje + 26) RETURNING id INTO v_venda2;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id, valor)
    VALUES ('Suite parcela 1/2', c_hoje + 26, 'parcela', v_venda2, 32.50) RETURNING id INTO v_l2;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id, valor)
    VALUES ('Suite parcela 2/2', c_hoje + 56, 'parcela', v_venda2, 32.50) RETURNING id INTO v_l3;

    SELECT count(*), sum(a.valor) INTO n, s FROM public.agenda_itens(c_hoje + 26, c_hoje + 56) a WHERE a.venda_id = v_venda2;
    IF n <> 2 OR s <> 65 THEN RAISE EXCEPTION '(b) esperado 2 parcelas somando 65, veio %/%', n, s; END IF;
    UPDATE public.lembretes SET situacao = 'feito' WHERE id = v_l2;
    IF EXISTS (SELECT 1 FROM public.agenda_itens(c_hoje + 26, c_hoje + 56) a WHERE a.origem = 'vencimento' AND a.id = v_venda2) THEN
      RAISE EXCEPTION '(b) vencimento voltou com a 2ª parcela ainda pendente';
    END IF;

    -- (c) atrasados: venda vencida ontem com cobrança pendente sai do grupo vencimento
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje - 10, 'entregue', 'fiado', 40, false, 'sistema', c_hoje - 1) RETURNING id INTO v_venda3;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite cobrar ontem', c_hoje - 1, 'cobranca', v_venda3) RETURNING id INTO v_l1;
    SELECT count(*) INTO n FROM public.agenda_atrasados() a WHERE a.origem = 'vencimento' AND a.id = v_venda3;
    IF n <> 0 THEN RAISE EXCEPTION '(c) vencimento duplicou a cobrança nos atrasados'; END IF;
    SELECT count(*) INTO n FROM public.agenda_atrasados() a WHERE a.origem = 'lembrete' AND a.id = v_l1 AND a.valor = 40;
    IF n <> 1 THEN RAISE EXCEPTION '(c) cobrança atrasada fora dos atrasados (ou sem o em aberto 40)'; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T14 parcela pendente é dona da cobrança; feita, o vencimento volta', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T14 parcela pendente é dona da cobrança; feita, o vencimento volta', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T15: entrega de brinde aparece, com valor 0 (e continua fora dos vencimentos) ──
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T15', c_tel || '15', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    -- Brinde nasce entregue (fn_brinde_invariante); volta a pendente com entrega marcada.
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'pendente', 'brinde', 45, false, 'sistema', c_hoje + 27) RETURNING id INTO v_venda;
    UPDATE public.vendas SET status = 'pendente', data_entrega_prevista = c_hoje + 27 WHERE id = v_venda;

    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 27, c_hoje + 27) a
     WHERE a.origem = 'entrega' AND a.id = v_venda AND a.valor = 0 AND a.forma_pagamento = 'brinde';
    IF n <> 1 THEN RAISE EXCEPTION 'entrega de brinde não apareceu com valor 0'; END IF;
    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 27, c_hoje + 27) a WHERE a.origem = 'vencimento' AND a.id = v_venda;
    IF n <> 0 THEN RAISE EXCEPTION 'brinde apareceu como vencimento'; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T15 entrega de brinde com valor 0, fora dos vencimentos', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T15 entrega de brinde com valor 0, fora dos vencimentos', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T16: parcela/cobrança não nasce nem é religada em venda paga ou cancelada ──────
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T16', c_tel || '16', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    -- paga
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje, 'entregue', 'pix', 50, true, 'sistema') RETURNING id INTO v_venda;
    -- cancelada
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje, 'pendente', 'fiado', 50, false, 'sistema') RETURNING id INTO v_venda2;
    UPDATE public.vendas SET status = 'cancelada', pago = false WHERE id = v_venda2;
    -- em aberto
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 50, false, 'sistema') RETURNING id INTO v_venda3;

    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo, venda_id) VALUES ('Suite cobrar paga', c_hoje, 'cobranca', v_venda);
      RAISE EXCEPTION 'aceitou cobrança em venda paga';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Essa venda já está paga' THEN RAISE EXCEPTION 'mensagem errada (paga): %', SQLERRM; END IF;
    END;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo, venda_id) VALUES ('Suite parcela cancelada', c_hoje, 'parcela', v_venda2);
      RAISE EXCEPTION 'aceitou parcela em venda cancelada';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Essa venda está cancelada' THEN RAISE EXCEPTION 'mensagem errada (cancelada): %', SQLERRM; END IF;
    END;

    -- Pendência interna em venda paga ou cancelada pode.
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite conferir paga', c_hoje, 'pendencia_interna', v_venda) RETURNING id INTO v_l1;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite devolver', c_hoje, 'pendencia_interna', v_venda2);

    -- Religar: virar cobrança numa venda paga não pode; levar a cobrança da venda em aberto
    -- para a paga, também não.
    BEGIN
      UPDATE public.lembretes SET tipo = 'cobranca' WHERE id = v_l1;
      RAISE EXCEPTION 'aceitou virar cobrança em venda paga';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite cobrar aberta', c_hoje, 'cobranca', v_venda3) RETURNING id INTO v_l2;
    BEGIN
      UPDATE public.lembretes SET venda_id = v_venda WHERE id = v_l2;
      RAISE EXCEPTION 'aceitou religar cobrança para venda paga';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- Editar outra coisa de uma cobrança já ligada não dispara a regra.
    UPDATE public.lembretes SET titulo = 'Suite cobrar aberta (editado)' WHERE id = v_l2;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T16 parcela/cobrança recusada em venda paga ou cancelada', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T16 parcela/cobrança recusada em venda paga ou cancelada', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T17: sem data — a venda com parcela/cobrança pendente sai (a data está no lembrete) ─
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T17', c_tel || '17', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje - 3, 'entregue', 'fiado', 55, false, 'sistema') RETURNING id INTO v_venda;

    IF NOT EXISTS (SELECT 1 FROM public.agenda_sem_data() a WHERE a.venda_id = v_venda) THEN
      RAISE EXCEPTION 'controle: venda sem previsão e sem lembrete devia estar no sem_data';
    END IF;

    -- Pendência interna também é dona (venda em análise): sai do sem data; resolvida, volta.
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite conferir T17', c_hoje + 2, 'pendencia_interna', v_venda) RETURNING id INTO v_l2;
    IF EXISTS (SELECT 1 FROM public.agenda_sem_data() a WHERE a.venda_id = v_venda) THEN
      RAISE EXCEPTION 'venda com pendência interna continuou no sem_data';
    END IF;
    UPDATE public.lembretes SET situacao = 'feito' WHERE id = v_l2;
    IF NOT EXISTS (SELECT 1 FROM public.agenda_sem_data() a WHERE a.venda_id = v_venda) THEN
      RAISE EXCEPTION 'feita a pendência, a venda não voltou ao sem_data';
    END IF;

    INSERT INTO public.lembretes (titulo, data, tipo, venda_id)
    VALUES ('Suite cobrar T17', c_hoje + 2, 'cobranca', v_venda) RETURNING id INTO v_l1;
    IF EXISTS (SELECT 1 FROM public.agenda_sem_data() a WHERE a.venda_id = v_venda) THEN
      RAISE EXCEPTION 'venda com cobrança pendente continuou no sem_data';
    END IF;

    -- Feita a cobrança e a venda ainda em aberto, volta a ser "sem data".
    UPDATE public.lembretes SET situacao = 'feito' WHERE id = v_l1;
    IF NOT EXISTS (SELECT 1 FROM public.agenda_sem_data() a WHERE a.venda_id = v_venda) THEN
      RAISE EXCEPTION 'feita a cobrança, a venda em aberto não voltou ao sem_data';
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T17 sem data: lembrete pendente (pendência ou cobrança) tira a venda; feito, volta', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T17 sem data: lembrete pendente (pendência ou cobrança) tira a venda; feito, volta', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T18: "não cobrar" — cobrança suspensa tira as vendas da agenda de cobrança ─────
  -- A dívida continua no sistema; só sai de vencimentos, atrasados e sem data. Entrega e
  -- lembretes do cliente continuam.
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T18 padrão', c_tel || '18', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato2;
    IF (SELECT c.cobranca_suspensa FROM public.contatos c WHERE c.id = v_contato2) THEN
      RAISE EXCEPTION 'contato novo nasceu com cobrança suspensa';
    END IF;

    INSERT INTO public.contatos (nome, telefone, tipo, status, origem, cobranca_suspensa, cobranca_suspensa_motivo)
    VALUES ('Suite Agenda T18', c_tel || '19', 'B2C', 'cliente', 'direto', true, 'Suite: pediram para não cobrar')
    RETURNING id INTO v_contato;
    -- A: vence no futuro · B: já venceu · C: sem previsão · D: entrega pendente
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 65, false, 'sistema', c_hoje + 28) RETURNING id INTO v_venda;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje - 20, 'entregue', 'fiado', 65, false, 'sistema', c_hoje - 2) RETURNING id INTO v_venda2;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem)
    VALUES (v_contato, c_hoje - 20, 'entregue', 'fiado', 65, false, 'sistema') RETURNING id INTO v_venda3;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_entrega_prevista)
    VALUES (v_contato, c_hoje, 'pendente', 'fiado', 40, false, 'sistema', c_hoje + 28) RETURNING id INTO v_i;
    INSERT INTO public.lembretes (titulo, data, tipo, contato_id)
    VALUES ('Suite ligar para a T18', c_hoje + 28, 'retorno_comercial', v_contato) RETURNING id INTO v_l1;

    IF EXISTS (SELECT 1 FROM public.agenda_itens(c_hoje + 28, c_hoje + 28) a WHERE a.origem = 'vencimento' AND a.id = v_venda) THEN
      RAISE EXCEPTION 'cobrança suspensa apareceu como vencimento';
    END IF;
    IF EXISTS (SELECT 1 FROM public.agenda_atrasados() a WHERE a.id = v_venda2) THEN
      RAISE EXCEPTION 'cobrança suspensa apareceu nos atrasados';
    END IF;
    IF EXISTS (SELECT 1 FROM public.agenda_sem_data() a WHERE a.venda_id = v_venda3) THEN
      RAISE EXCEPTION 'cobrança suspensa apareceu no sem data';
    END IF;
    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 28, c_hoje + 28) a
     WHERE (a.origem = 'entrega' AND a.id = v_i) OR (a.origem = 'lembrete' AND a.id = v_l1);
    IF n <> 2 THEN RAISE EXCEPTION 'entrega/lembrete do cliente suspenso sumiram (% de 2)', n; END IF;

    -- Volta a cobrar → as três voltam.
    UPDATE public.contatos SET cobranca_suspensa = false, cobranca_suspensa_motivo = NULL WHERE id = v_contato;
    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 28, c_hoje + 28) a WHERE a.origem = 'vencimento' AND a.id = v_venda;
    SELECT n + count(*) INTO n FROM public.agenda_atrasados() a WHERE a.origem = 'vencimento' AND a.id = v_venda2;
    SELECT n + count(*) INTO n FROM public.agenda_sem_data() a WHERE a.venda_id = v_venda3;
    IF n <> 3 THEN RAISE EXCEPTION 'tirada a suspensão, voltaram % de 3', n; END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T18 cobrança suspensa: fora de vencimento/atrasado/sem data; entrega e lembrete ficam', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T18 cobrança suspensa: fora de vencimento/atrasado/sem data; entrega e lembrete ficam', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T19: pendência interna também é dona da venda; responsavel volta nas leituras ──
  total := total + 1;
  BEGIN
    INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
    VALUES ('Suite Agenda T19', c_tel || '20', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje, 'entregue', 'fiado', 70, false, 'sistema', c_hoje + 29) RETURNING id INTO v_venda;
    INSERT INTO public.vendas (contato_id, data, status, forma_pagamento, total, pago, origem, data_prevista_pagamento)
    VALUES (v_contato, c_hoje - 20, 'entregue', 'fiado', 45, false, 'sistema', c_hoje - 3) RETURNING id INTO v_venda2;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id, responsavel)
    VALUES ('Suite venda em análise', c_hoje + 29, 'pendencia_interna', v_venda, 'gilmar') RETURNING id INTO v_l1;
    INSERT INTO public.lembretes (titulo, data, tipo, venda_id, responsavel)
    VALUES ('Suite conferir pagamento', c_hoje - 1, 'pendencia_interna', v_venda2, 'luccas') RETURNING id INTO v_l2;

    -- Em análise: o vencimento sai; o lembrete aparece, com o responsável.
    IF EXISTS (SELECT 1 FROM public.agenda_itens(c_hoje + 29, c_hoje + 29) a WHERE a.origem = 'vencimento' AND a.id = v_venda) THEN
      RAISE EXCEPTION 'venda em análise apareceu como vencimento';
    END IF;
    IF (SELECT a.responsavel FROM public.agenda_itens(c_hoje + 29, c_hoje + 29) a WHERE a.origem = 'lembrete' AND a.id = v_l1) IS DISTINCT FROM 'gilmar' THEN
      RAISE EXCEPTION 'agenda_itens sem o responsável do lembrete';
    END IF;
    IF EXISTS (SELECT 1 FROM public.agenda_atrasados() a WHERE a.origem = 'vencimento' AND a.id = v_venda2) THEN
      RAISE EXCEPTION 'venda em análise apareceu nos vencimentos atrasados';
    END IF;
    IF (SELECT a.responsavel FROM public.agenda_atrasados() a WHERE a.origem = 'lembrete' AND a.id = v_l2) IS DISTINCT FROM 'luccas' THEN
      RAISE EXCEPTION 'agenda_atrasados sem o responsável do lembrete';
    END IF;

    -- Pendência resolvida e a venda segue em aberto → o vencimento volta, sem responsável.
    UPDATE public.lembretes SET situacao = 'feito' WHERE id = v_l1;
    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje + 29, c_hoje + 29) a
     WHERE a.origem = 'vencimento' AND a.id = v_venda AND a.valor = 70 AND a.responsavel IS NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'feita a pendência, o vencimento não voltou (ou veio com responsável)'; END IF;

    -- O fechamento automático continua só para parcela e cobrança: venda paga não fecha a pendência.
    UPDATE public.vendas SET pago = true WHERE id = v_venda2;
    IF (SELECT l.situacao FROM public.lembretes l WHERE l.id = v_l2) <> 'pendente' THEN
      RAISE EXCEPTION 'venda paga fechou a pendência interna';
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T19 pendência interna é dona da venda; responsavel nas leituras; não fecha sozinha', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'T19 pendência interna é dona da venda; responsavel nas leituras; não fecha sozinha', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── T13: RLS — não-admin não lê, não grava e recebe agenda vazia ──────────────────
  -- (Os casos anteriores deixaram lembretes vivos nesta transação: há o que esconder.)
  total := total + 1;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', c_uid_nao_admin, 'role', 'authenticated')::text, true);
    IF public.is_admin() THEN RAISE EXCEPTION 'uid não-admin passou no is_admin()'; END IF;

    SELECT count(*) INTO n FROM public.lembretes;
    IF n <> 0 THEN RAISE EXCEPTION 'não-admin leu % lembretes', n; END IF;
    SELECT count(*) INTO n FROM public.agenda_itens(c_hoje - 400, c_hoje + 400);
    IF n <> 0 THEN RAISE EXCEPTION 'não-admin recebeu % itens da agenda', n; END IF;
    SELECT count(*) INTO n FROM public.agenda_atrasados();
    IF n <> 0 THEN RAISE EXCEPTION 'não-admin recebeu % atrasados', n; END IF;
    SELECT count(*) INTO n FROM public.agenda_sem_data();
    IF n <> 0 THEN RAISE EXCEPTION 'não-admin recebeu % sem data', n; END IF;
    BEGIN
      INSERT INTO public.lembretes (titulo, data, tipo) VALUES ('Suite intruso', c_hoje, 'outro');
      RAISE EXCEPTION 'não-admin conseguiu inserir';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    UPDATE public.lembretes SET titulo = 'invadido' WHERE true;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'não-admin atualizou % lembretes', n; END IF;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'T13 RLS não-admin bloqueado', 'ok', true);
  EXCEPTION WHEN others THEN
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
    resultados := resultados || jsonb_build_object('caso', 'T13 RLS não-admin bloqueado', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% agenda_lembretes %/% | real=% | contagens_antes=% | %',
    CASE WHEN passou = total THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, total, v_real, antes, resultados::text;
END;
$suite$;

-- Rodapé — rode DEPOIS da suíte e compare com "contagens_antes" da mensagem:
-- SELECT
--   (SELECT count(*) FROM public.contatos)         AS contatos,
--   (SELECT count(*) FROM public.vendas)           AS vendas,
--   (SELECT count(*) FROM public.pagamentos_venda) AS pagamentos_venda,
--   (SELECT count(*) FROM public.lancamentos)      AS lancamentos,
--   (SELECT count(*) FROM public.contas)           AS contas,
--   (SELECT COALESCE(sum(saldo_atual), 0) FROM public.contas) AS saldo_contas,
--   (SELECT count(*) FROM public.interacoes)       AS interacoes,
--   (SELECT count(*) FROM public.meta_eventos)     AS meta_eventos,
--   to_regclass('public.lembretes')                AS lembretes_existe;  -- NULL no ensaio
