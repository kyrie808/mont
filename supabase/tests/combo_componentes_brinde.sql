-- Suíte: replace_combo_componentes preserva a marca de brinde (produto_componentes.brinde)
-- quando o sistema interno regrava a composição de um combo (02/11/2026).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION; nada é gravado.
--   SUITE_OK     combo_componentes_brinde 6/6 | [...]
--
-- Roda como a CONTA-TESTE (admin), igual à tela de Produtos. Cenário: o Café da Tarde real
-- (2 baldinhos + doce de leite 400 g de brinde); os casos rodam em sequência sobre ele.

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;

  v_cafe uuid; v_baldinho uuid; v_dl400 uuid; v_geleia uuid;
  original jsonb;

  -- brinde de um componente do Café da Tarde (NULL = não está no combo)
  b boolean;
BEGIN
  antes := jsonb_build_object(
    'produto_componentes', (SELECT count(*) FROM public.produto_componentes),
    'brindes', (SELECT count(*) FROM public.produto_componentes WHERE brinde)
  );

  SELECT id INTO v_cafe FROM public.produtos WHERE codigo = 'combo_black_cafe_da_tarde';
  SELECT id INTO v_baldinho FROM public.produtos WHERE codigo = 'balde_pao_queijo_1kg';
  SELECT id INTO v_dl400 FROM public.produtos WHERE codigo = 'doce_leite_tradicional_400g';
  SELECT id INTO v_geleia FROM public.produtos WHERE codigo = 'geleia_morango_680g';
  IF v_cafe IS NULL OR v_baldinho IS NULL OR v_dl400 IS NULL OR v_geleia IS NULL THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: produtos do cenário não encontrados';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.produto_componentes WHERE combo_id = v_cafe AND componente_id = v_dl400 AND brinde) THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: o doce de leite 400 g do Café da Tarde não está marcado como brinde';
  END IF;

  -- Composição como a tela de Produtos manda HOJE (sem a chave "brinde").
  original := jsonb_build_array(
    jsonb_build_object('componenteId', v_baldinho, 'quantidade', 2),
    jsonb_build_object('componenteId', v_dl400, 'quantidade', 1)
  );

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;

  -- B1: sem a chave "brinde" (tela antiga / app em cache), o item que continua mantém a marca.
  casos := casos + 1;
  BEGIN
    PERFORM public.replace_combo_componentes(v_cafe, original);
    SELECT brinde INTO b FROM public.produto_componentes WHERE combo_id = v_cafe AND componente_id = v_dl400;
    IF b IS DISTINCT FROM true THEN RAISE EXCEPTION 'brinde = %, esperado true', b; END IF;
    SELECT brinde INTO b FROM public.produto_componentes WHERE combo_id = v_cafe AND componente_id = v_baldinho;
    IF b IS DISTINCT FROM false THEN RAISE EXCEPTION 'baldinho virou brinde: %', b; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'B1 sem a chave: preserva', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'B1 sem a chave: preserva', 'ok', false, 'erro', SQLERRM);
  END;

  -- B2: trocar a quantidade de um item que continua não perde a marca.
  casos := casos + 1;
  BEGIN
    PERFORM public.replace_combo_componentes(v_cafe, jsonb_build_array(
      jsonb_build_object('componenteId', v_baldinho, 'quantidade', 3),
      jsonb_build_object('componenteId', v_dl400, 'quantidade', 2)));
    SELECT brinde INTO b FROM public.produto_componentes WHERE combo_id = v_cafe AND componente_id = v_dl400;
    IF b IS DISTINCT FROM true THEN RAISE EXCEPTION 'brinde = %, esperado true', b; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'B2 muda quantidade: preserva', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'B2 muda quantidade: preserva', 'ok', false, 'erro', SQLERRM);
  END;

  -- B3: "brinde": false explícito (desmarcado na tela) tira a marca.
  casos := casos + 1;
  BEGIN
    PERFORM public.replace_combo_componentes(v_cafe, jsonb_build_array(
      jsonb_build_object('componenteId', v_baldinho, 'quantidade', 2, 'brinde', false),
      jsonb_build_object('componenteId', v_dl400, 'quantidade', 1, 'brinde', false)));
    SELECT brinde INTO b FROM public.produto_componentes WHERE combo_id = v_cafe AND componente_id = v_dl400;
    IF b IS DISTINCT FROM false THEN RAISE EXCEPTION 'brinde = %, esperado false', b; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'B3 false explícito: desmarca', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'B3 false explícito: desmarca', 'ok', false, 'erro', SQLERRM);
  END;

  -- B4: "brinde": true explícito marca (inclusive item novo).
  casos := casos + 1;
  BEGIN
    PERFORM public.replace_combo_componentes(v_cafe, original || jsonb_build_array(
      jsonb_build_object('componenteId', v_geleia, 'quantidade', 1, 'brinde', true)));
    SELECT brinde INTO b FROM public.produto_componentes WHERE combo_id = v_cafe AND componente_id = v_geleia;
    IF b IS DISTINCT FROM true THEN RAISE EXCEPTION 'item novo com brinde = %, esperado true', b; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'B4 true explícito: marca (item novo)', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'B4 true explícito: marca (item novo)', 'ok', false, 'erro', SQLERRM);
  END;

  -- B5: item novo sem a chave entra sem brinde; item que sai do combo e volta depois começa sem.
  casos := casos + 1;
  BEGIN
    PERFORM public.replace_combo_componentes(v_cafe, original);  -- tira a geleia (de B4)
    PERFORM public.replace_combo_componentes(v_cafe, original || jsonb_build_array(
      jsonb_build_object('componenteId', v_geleia, 'quantidade', 1)));
    SELECT brinde INTO b FROM public.produto_componentes WHERE combo_id = v_cafe AND componente_id = v_geleia;
    IF b IS DISTINCT FROM false THEN RAISE EXCEPTION 'item novo sem a chave: brinde = %', b; END IF;
    -- doce 400 g marcado, sai do combo e volta sem a chave: começa sem brinde
    PERFORM public.replace_combo_componentes(v_cafe, jsonb_build_array(
      jsonb_build_object('componenteId', v_baldinho, 'quantidade', 2),
      jsonb_build_object('componenteId', v_dl400, 'quantidade', 1, 'brinde', true)));
    PERFORM public.replace_combo_componentes(v_cafe, jsonb_build_array(
      jsonb_build_object('componenteId', v_baldinho, 'quantidade', 2)));
    PERFORM public.replace_combo_componentes(v_cafe, original);
    SELECT brinde INTO b FROM public.produto_componentes WHERE combo_id = v_cafe AND componente_id = v_dl400;
    IF b IS DISTINCT FROM false THEN RAISE EXCEPTION 'removido e readicionado manteve brinde = %', b; END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'B5 novo/readicionado sem chave: sem brinde', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'B5 novo/readicionado sem chave: sem brinde', 'ok', false, 'erro', SQLERRM);
  END;

  -- B6: a guarda de admin continua (não-admin é recusado).
  casos := casos + 1;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.replace_combo_componentes(v_cafe, original);
      RAISE EXCEPTION 'não-admin conseguiu regravar';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'B6 só admin', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'B6 só admin', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% combo_componentes_brinde %/% | contagens_antes=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, antes, resultados;
END
$suite$;

-- Contagens para rodar antes e depois (têm que bater):
-- SELECT (SELECT count(*) FROM public.produto_componentes) produto_componentes,
--        (SELECT count(*) FROM public.produto_componentes WHERE brinde) brindes;
