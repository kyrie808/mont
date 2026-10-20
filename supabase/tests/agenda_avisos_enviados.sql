-- Suíte: agenda_avisos_enviados (marca do aviso diário das 8h da Agenda).
-- Migration: 20261019205333_agenda_ajustes_e_avisos.sql (seção 4).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA" (ver agenda_lembretes.sql): um único DO-block que SEMPRE
-- termina em RAISE EXCEPTION — nada do que a suíte grava sobrevive. Resultado esperado:
-- erro P0001 com "SUITE_OK agenda_avisos_enviados n/n | ...".
--
--   • ANTES de aplicar (ensaio): cole a migration E este arquivo na MESMA execução; depois
--     `SELECT to_regclass('public.agenda_avisos_enviados')` tem que voltar NULL.
--   • DEPOIS de aplicar: rode só este arquivo; depois `SELECT count(*) FROM
--     public.agenda_avisos_enviados` tem que bater com "contagem_antes".
--
-- Papéis: service_role (a Edge Function) grava e lê; a conta-teste (authenticated, admin)
-- e anon não fazem nada. Nada aqui dispara trigger, HTTP ou sequência.
-- Dia fictício: 2099-01-01 (a suíte aborta se já existir).

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_dia constant date := '2099-01-01';
  c_grupo constant text := '120363129541953733@g.us';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  total int := 0;
  antes int;
  n int;
  v_msg text;
  v_em timestamptz;
BEGIN
  IF to_regclass('public.agenda_avisos_enviados') IS NULL THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: public.agenda_avisos_enviados não existe — aplique a migration antes, ou cole a migration junto com esta suíte na mesma execução';
  END IF;
  antes := (SELECT count(*) FROM public.agenda_avisos_enviados);
  IF EXISTS (SELECT 1 FROM public.agenda_avisos_enviados WHERE dia = c_dia) THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe marca para o dia fictício %', c_dia;
  END IF;

  -- ── E0: estrutura ─────────────────────────────────────────────────────────────
  total := total + 1;
  BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.agenda_avisos_enviados'::regclass) THEN
      RAISE EXCEPTION 'RLS desligado';
    END IF;
    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agenda_avisos_enviados';
    IF n <> 0 THEN RAISE EXCEPTION 'esperado 0 policies, veio %', n; END IF;
    IF has_table_privilege('anon', 'public.agenda_avisos_enviados', 'SELECT')
       OR has_table_privilege('anon', 'public.agenda_avisos_enviados', 'INSERT')
       OR has_table_privilege('authenticated', 'public.agenda_avisos_enviados', 'SELECT')
       OR has_table_privilege('authenticated', 'public.agenda_avisos_enviados', 'INSERT') THEN
      RAISE EXCEPTION 'anon/authenticated com privilégio na tabela';
    END IF;
    IF NOT (has_table_privilege('service_role', 'public.agenda_avisos_enviados', 'SELECT')
            AND has_table_privilege('service_role', 'public.agenda_avisos_enviados', 'INSERT')) THEN
      RAISE EXCEPTION 'service_role sem SELECT/INSERT';
    END IF;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'E0 RLS ligada, sem policy, só service_role', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'E0 RLS ligada, sem policy, só service_role', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A1: service_role marca o dia; a segunda marca do mesmo dia não grava nada ─────
  -- (É o que marcar_enviado faz: upsert com ignoreDuplicates = ON CONFLICT DO NOTHING.)
  total := total + 1;
  BEGIN
    SET LOCAL ROLE service_role;

    INSERT INTO public.agenda_avisos_enviados (dia, message_id, destino)
    VALUES (c_dia, 'msg-primeira', c_grupo)
    ON CONFLICT (dia) DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'primeira marca gravou % linha(s)', n; END IF;
    SELECT a.message_id, a.enviado_em INTO v_msg, v_em FROM public.agenda_avisos_enviados a WHERE a.dia = c_dia;
    IF v_em IS NULL THEN RAISE EXCEPTION 'enviado_em sem default'; END IF;

    INSERT INTO public.agenda_avisos_enviados (dia, message_id, destino)
    VALUES (c_dia, 'msg-segunda', c_grupo)
    ON CONFLICT (dia) DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'segunda marca do mesmo dia gravou % linha(s)', n; END IF;
    IF (SELECT a.message_id FROM public.agenda_avisos_enviados a WHERE a.dia = c_dia) <> 'msg-primeira' THEN
      RAISE EXCEPTION 'a segunda marca sobrescreveu a primeira';
    END IF;

    BEGIN
      INSERT INTO public.agenda_avisos_enviados (dia, destino) VALUES (c_dia + 1, '  ');
      RAISE EXCEPTION 'aceitou destino vazio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RESET ROLE;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A1 service_role marca uma vez por dia', 'ok', true);
  EXCEPTION WHEN others THEN
    RESET ROLE;
    resultados := resultados || jsonb_build_object('caso', 'A1 service_role marca uma vez por dia', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── A2: a conta-teste (admin) não lê nem grava ──────────────────────────────────
  total := total + 1;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM 1 FROM public.agenda_avisos_enviados;
      RAISE EXCEPTION 'authenticated conseguiu ler';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      INSERT INTO public.agenda_avisos_enviados (dia, destino) VALUES (c_dia + 2, c_grupo);
      RAISE EXCEPTION 'authenticated conseguiu gravar';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;

    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'A2 authenticated (admin) bloqueado', 'ok', true);
  EXCEPTION WHEN others THEN
    RESET ROLE;
    resultados := resultados || jsonb_build_object('caso', 'A2 authenticated (admin) bloqueado', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% agenda_avisos_enviados %/% | contagem_antes=% | %',
    CASE WHEN passou = total THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, total, antes, resultados::text;
END;
$suite$;
