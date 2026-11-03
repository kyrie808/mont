-- Suíte: aba "Loja" do produto no sistema interno (Parte B da paridade, 03/11/2026).
-- loja_salvar_vitrine grava o complemento da loja de um produto numa chamada só; "leva junto?" e
-- destaque do topo são exclusivos (um produto por vez). cat_secoes ganha a descrição da seção.
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION; nada é gravado.
-- Roda como a CONTA-TESTE (admin), igual ao app.
--   SUITE_OK     loja_salvar_vitrine 7/7 | [...]

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;
  v_chipa uuid; v_dl400 uuid; v_mesa uuid; v_par uuid; v_resfriados uuid;
  r record;
BEGIN
  antes := jsonb_build_object(
    'loja_vitrine', (SELECT jsonb_agg(to_jsonb(lv) - 'atualizado_em' ORDER BY produto_id) FROM public.loja_vitrine lv),
    'cat_secoes', (SELECT jsonb_agg(to_jsonb(s) - 'updated_at' ORDER BY id) FROM public.cat_secoes s)
  );

  SELECT id INTO v_chipa FROM public.produtos WHERE nome = 'Chipa 1kg' AND ativo;
  SELECT id INTO v_dl400 FROM public.produtos WHERE codigo = 'doce_leite_tradicional_400g';
  SELECT id INTO v_mesa FROM public.produtos WHERE codigo = 'combo_black_familia';
  SELECT id INTO v_par FROM public.produtos WHERE codigo = 'combo_black_balde_doce';
  SELECT id INTO v_resfriados FROM public.cat_secoes WHERE slug = 'resfriados';
  IF v_chipa IS NULL OR v_dl400 IS NULL OR v_mesa IS NULL OR v_par IS NULL OR v_resfriados IS NULL THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: cenário não encontrado';
  END IF;
  IF NOT (SELECT leva_junto FROM public.loja_vitrine WHERE produto_id = v_dl400)
     OR NOT (SELECT destaque_hero FROM public.loja_vitrine WHERE produto_id = v_mesa) THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: esperado leva junto = doce de leite 400 g e destaque = Mesa Cheia';
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() = %, esperado a conta-teste', auth.uid();
  END IF;

  -- S1: produto sem linha ganha a linha (visível), textos vazios viram NULL.
  casos := casos + 1;
  BEGIN
    PERFORM public.loja_salvar_vitrine(p_produto_id => v_chipa, p_nome_loja => '  Chipa paraguaia 1 kg ', p_frase_card => '', p_resumo => '   ', p_destaque_hero => false, p_leva_junto => false, p_disponivel => false, p_usa_estoque => false, p_usar_ancoragem => false, p_secao_id => v_resfriados, p_ordem_loja => 3);
    SELECT * INTO r FROM public.loja_vitrine WHERE produto_id = v_chipa;
    IF NOT r.visivel OR r.nome_loja <> 'Chipa paraguaia 1 kg' OR r.frase_card IS NOT NULL OR r.resumo IS NOT NULL
       OR r.secao_id IS DISTINCT FROM v_resfriados OR r.ordem_loja <> 3 OR r.disponivel OR r.usa_estoque OR r.usar_ancoragem THEN
      RAISE EXCEPTION 'linha = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'S1 cria a linha e limpa textos', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'S1 cria a linha e limpa textos', 'ok', false, 'erro', SQLERRM);
  END;

  -- S2: salvar de novo atualiza (sem duplicar) e "Esgotado" desligado volta a vender.
  casos := casos + 1;
  BEGIN
    PERFORM public.loja_salvar_vitrine(p_produto_id => v_chipa, p_nome_loja => NULL, p_frase_card => 'Crocante por fora.', p_resumo => NULL, p_destaque_hero => false, p_leva_junto => false, p_disponivel => true, p_usa_estoque => false, p_usar_ancoragem => true);
    SELECT * INTO r FROM public.loja_vitrine WHERE produto_id = v_chipa;
    IF NOT r.disponivel OR r.nome_loja IS NOT NULL OR r.frase_card <> 'Crocante por fora.' OR r.secao_id IS NOT NULL
       OR r.ordem_loja IS NOT NULL OR NOT r.usar_ancoragem
       OR (SELECT count(*) FROM public.loja_vitrine WHERE produto_id = v_chipa) <> 1 THEN
      RAISE EXCEPTION 'linha = %', row_to_json(r);
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'S2 atualiza sem duplicar', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'S2 atualiza sem duplicar', 'ok', false, 'erro', SQLERRM);
  END;

  -- S3: "leva junto?" é de um produto só: marcar a Chipa tira do doce de leite 400 g.
  casos := casos + 1;
  BEGIN
    PERFORM public.loja_salvar_vitrine(p_produto_id => v_chipa, p_nome_loja => NULL, p_frase_card => NULL, p_resumo => NULL, p_destaque_hero => false, p_leva_junto => true, p_disponivel => true, p_usa_estoque => false, p_usar_ancoragem => false);
    IF NOT (SELECT leva_junto FROM public.loja_vitrine WHERE produto_id = v_chipa)
       OR (SELECT leva_junto FROM public.loja_vitrine WHERE produto_id = v_dl400)
       OR (SELECT count(*) FROM public.loja_vitrine WHERE leva_junto) <> 1 THEN
      RAISE EXCEPTION 'leva junto não ficou exclusivo';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'S3 leva junto exclusivo', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'S3 leva junto exclusivo', 'ok', false, 'erro', SQLERRM);
  END;

  -- S4: destaque do topo é de um produto só: marcar o Par Mineiro tira da Mesa Cheia.
  casos := casos + 1;
  BEGIN
    PERFORM public.loja_salvar_vitrine(p_produto_id => v_par, p_nome_loja => 'Par Mineiro', p_frase_card => NULL, p_resumo => NULL, p_destaque_hero => true, p_leva_junto => false, p_disponivel => true, p_usa_estoque => false, p_usar_ancoragem => false, p_ordem_loja => 2);
    IF NOT (SELECT destaque_hero FROM public.loja_vitrine WHERE produto_id = v_par)
       OR (SELECT destaque_hero FROM public.loja_vitrine WHERE produto_id = v_mesa)
       OR (SELECT count(*) FROM public.loja_vitrine WHERE destaque_hero) <> 1 THEN
      RAISE EXCEPTION 'destaque não ficou exclusivo';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'S4 destaque exclusivo', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'S4 destaque exclusivo', 'ok', false, 'erro', SQLERRM);
  END;

  -- S5: frase do card com mais de 80 caracteres é recusada.
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.loja_salvar_vitrine(p_produto_id => v_chipa, p_nome_loja => NULL, p_frase_card => repeat('a', 81), p_resumo => NULL, p_destaque_hero => false, p_leva_junto => false, p_disponivel => true, p_usa_estoque => false, p_usar_ancoragem => false);
      RAISE EXCEPTION 'aceitou frase longa';
    EXCEPTION WHEN check_violation THEN
      NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'S5 frase longa recusada', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'S5 frase longa recusada', 'ok', false, 'erro', SQLERRM);
  END;

  -- S6: descrição da seção: uma linha, até 120 caracteres; vazio = sem descrição.
  casos := casos + 1;
  BEGIN
    UPDATE public.cat_secoes SET descricao = 'Queijo Canastra de verdade. Parmesão e Meia Cura.' WHERE id = v_resfriados;
    IF (SELECT descricao FROM public.cat_secoes WHERE id = v_resfriados) IS NULL THEN RAISE EXCEPTION 'não gravou'; END IF;
    BEGIN
      UPDATE public.cat_secoes SET descricao = E'duas\nlinhas' WHERE id = v_resfriados;
      RAISE EXCEPTION 'aceitou quebra de linha';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.cat_secoes SET descricao = repeat('a', 121) WHERE id = v_resfriados;
      RAISE EXCEPTION 'aceitou 121 caracteres';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'S6 descrição da seção', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'S6 descrição da seção', 'ok', false, 'erro', SQLERRM);
  END;

  -- S7: só admin salva.
  casos := casos + 1;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.loja_salvar_vitrine(p_produto_id => v_chipa, p_nome_loja => NULL, p_frase_card => NULL, p_resumo => NULL, p_destaque_hero => false, p_leva_junto => false, p_disponivel => true, p_usa_estoque => false, p_usar_ancoragem => false);
      RAISE EXCEPTION 'não-admin conseguiu salvar';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
    IF has_function_privilege('anon', 'public.loja_salvar_vitrine(uuid, text, text, text, boolean, boolean, boolean, boolean, boolean, uuid, integer)', 'EXECUTE') THEN
      RAISE EXCEPTION 'anon pode executar';
    END IF;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'S7 só admin', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'S7 só admin', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% loja_salvar_vitrine %/% | contagens_antes=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, jsonb_build_object('loja_vitrine', jsonb_array_length(antes->'loja_vitrine'),
                                      'cat_secoes', jsonb_array_length(antes->'cat_secoes')), resultados;
END
$suite$;

-- Conferência antes e depois (tem que bater):
-- SELECT md5((SELECT jsonb_agg(to_jsonb(lv) - 'atualizado_em' ORDER BY produto_id) FROM public.loja_vitrine lv)::text) vitrine,
--        md5((SELECT jsonb_agg(to_jsonb(s) - 'updated_at' ORDER BY id) FROM public.cat_secoes s)::text) secoes;
