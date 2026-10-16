-- Suíte: metas_mensais (RLS só-admin, CHECKs, seed) + sugerir_metas(mes).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA" (ver meta_eventos_triggers.sql): um único DO-block que
-- SEMPRE termina em RAISE EXCEPTION — nada do que a suíte grava sobrevive.
-- Resultado esperado: erro P0001 com "SUITE_OK metas_mensais n/n | ...".
-- Prova de que nada ficou: a contagem de metas_mensais vai na mensagem (antes) — rode
-- `SELECT count(*) FROM public.metas_mensais` depois e compare.
--
-- Roda como a conta-teste (admin) e, no caso de RLS, como um uid que não é admin.
-- metas_mensais não tem trigger com HTTP nem sequência: nada escapa do rollback.
-- O faturado de set/2026 (base da sugestão) é lido da view_home_financeiro na hora.

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_uid_nao_admin constant uuid := '00000000-0000-4000-8000-00000000abcd';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  total int := 0;
  antes int;

  v_fat_set numeric;
  s record;
  n int;
BEGIN
  antes := (SELECT count(*) FROM public.metas_mensais);
  v_fat_set := (SELECT faturamento FROM public.view_home_financeiro WHERE ano = 2026 AND mes = 9);

  IF EXISTS (SELECT 1 FROM public.metas_mensais WHERE mes = '2026-09-01') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe meta para 2026-09 (a suíte usa esse mês)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = c_uid_nao_admin) THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: o uid "não admin" da suíte está em admin_users';
  END IF;

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;

  -- 1. Seed de outubro/2026
  total := total + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.metas_mensais
     WHERE mes = '2026-10-01' AND meta_minima = 9300 AND meta_alvo = 11200 AND meta_a_receber_max IS NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'seed de 2026-10 não encontrado (n=%)', n; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'seed_outubro', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'seed_outubro', 'ok', false, 'erro', SQLERRM);
  END;

  -- 2. CHECK alvo >= mínima
  total := total + 1;
  BEGIN
    BEGIN
      INSERT INTO public.metas_mensais (mes, meta_minima, meta_alvo) VALUES ('2026-09-01', 5000, 4000);
      RAISE EXCEPTION 'aceitou alvo < mínima';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'check_alvo_gte_minima', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'check_alvo_gte_minima', 'ok', false, 'erro', SQLERRM);
  END;

  -- 3. CHECK mes = dia 1
  total := total + 1;
  BEGIN
    BEGIN
      INSERT INTO public.metas_mensais (mes, meta_minima, meta_alvo) VALUES ('2026-09-15', 5000, 6000);
      RAISE EXCEPTION 'aceitou mês que não é dia 1';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'check_mes_dia_1', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'check_mes_dia_1', 'ok', false, 'erro', SQLERRM);
  END;

  -- 4. Sugestão: mês anterior bateu o alvo → mínima = alvo anterior, alvo = +12%
  total := total + 1;
  BEGIN
    INSERT INTO public.metas_mensais (mes, meta_minima, meta_alvo)
    VALUES ('2026-09-01', v_fat_set - 200, v_fat_set - 100);
    SELECT * INTO s FROM public.sugerir_metas('2026-10-01');
    IF NOT s.bateu_alvo OR s.meta_minima <> v_fat_set - 100 OR s.meta_alvo <> round((v_fat_set - 100) * 1.12, 2) THEN
      RAISE EXCEPTION 'esperado %/%, veio %/%', v_fat_set - 100, round((v_fat_set - 100) * 1.12, 2), s.meta_minima, s.meta_alvo;
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'sugestao_bateu_alvo', 'ok', true, 'veio', jsonb_build_array(s.meta_minima, s.meta_alvo));
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'sugestao_bateu_alvo', 'ok', false, 'erro', SQLERRM);
  END;

  -- 5. Sugestão: bateu só a mínima → repete
  total := total + 1;
  BEGIN
    UPDATE public.metas_mensais SET meta_minima = v_fat_set - 100, meta_alvo = v_fat_set + 100 WHERE mes = '2026-09-01';
    SELECT * INTO s FROM public.sugerir_metas('2026-10-01');
    IF s.bateu_alvo OR NOT s.bateu_minima OR s.meta_minima <> v_fat_set - 100 OR s.meta_alvo <> v_fat_set + 100 THEN
      RAISE EXCEPTION 'esperado repetir %/%, veio %/%', v_fat_set - 100, v_fat_set + 100, s.meta_minima, s.meta_alvo;
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'sugestao_so_minima_repete', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'sugestao_so_minima_repete', 'ok', false, 'erro', SQLERRM);
  END;

  -- 6. Sugestão: não bateu a mínima → repete (a meta nunca cai)
  total := total + 1;
  BEGIN
    UPDATE public.metas_mensais SET meta_minima = v_fat_set + 100, meta_alvo = v_fat_set + 500 WHERE mes = '2026-09-01';
    SELECT * INTO s FROM public.sugerir_metas('2026-10-01');
    IF s.bateu_minima OR s.meta_minima <> v_fat_set + 100 OR s.meta_alvo <> v_fat_set + 500 THEN
      RAISE EXCEPTION 'esperado repetir %/%, veio %/%', v_fat_set + 100, v_fat_set + 500, s.meta_minima, s.meta_alvo;
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'sugestao_nao_bateu_repete', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'sugestao_nao_bateu_repete', 'ok', false, 'erro', SQLERRM);
  END;

  -- 7. Sugestão: mês anterior sem meta → nenhuma linha
  total := total + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.sugerir_metas('2026-08-01');
    IF n <> 0 THEN RAISE EXCEPTION 'esperado 0 linhas, veio %', n; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'sugestao_sem_meta_anterior', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'sugestao_sem_meta_anterior', 'ok', false, 'erro', SQLERRM);
  END;

  -- 8. RLS: quem não é admin não lê nem escreve
  total := total + 1;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', c_uid_nao_admin, 'role', 'authenticated')::text, true);
    IF public.is_admin() THEN RAISE EXCEPTION 'uid não-admin passou no is_admin()'; END IF;
    SELECT count(*) INTO n FROM public.metas_mensais;
    IF n <> 0 THEN RAISE EXCEPTION 'não-admin leu % linhas', n; END IF;
    BEGIN
      INSERT INTO public.metas_mensais (mes, meta_minima, meta_alvo) VALUES ('2026-07-01', 1, 2);
      RAISE EXCEPTION 'não-admin conseguiu inserir';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    UPDATE public.metas_mensais SET meta_alvo = meta_alvo + 1 WHERE mes = '2026-10-01';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'não-admin atualizou % linhas', n; END IF;
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'rls_nao_admin_bloqueado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'rls_nao_admin_bloqueado', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% metas_mensais %/% | contagem_antes=% | %',
    CASE WHEN passou = total THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, total, antes, resultados::text;
END;
$suite$;
