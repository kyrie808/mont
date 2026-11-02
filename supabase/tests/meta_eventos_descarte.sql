-- Suíte: regra de descarte da fila da Meta (migration 20261030173318_meta_capi_horario_descarte).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION, então
-- nada é gravado (ver meta_eventos_triggers.sql). Roda como o dono do banco no
-- `execute_sql` do MCP, porque `meta_eventos` só aceita escrita de service_role; o contato
-- e os eventos são fictícios e morrem com a transação.
--   SUITE_OK     meta_eventos_descarte 4/4 | [...]
--   SUITE_FALHOU meta_eventos_descarte 3/4 | [...]

DO $suite$
DECLARE
  c_tel constant text := '119000015';
  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  total int := 0;
  antes jsonb;
  v_contato uuid;
BEGIN
  antes := jsonb_build_object(
    'contatos', (SELECT count(*) FROM public.contatos),
    'meta_eventos', (SELECT count(*) FROM public.meta_eventos)
  );

  IF EXISTS (SELECT 1 FROM public.contatos WHERE telefone LIKE c_tel || '%') THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe contato com o prefixo fictício %', c_tel;
  END IF;

  INSERT INTO public.contatos (nome, telefone, tipo, status, origem)
  VALUES ('Suite descarte', c_tel || '01', 'B2C', 'cliente', 'direto') RETURNING id INTO v_contato;

  -- D1: descartado COM motivo é aceito.
  total := total + 1;
  BEGIN
    INSERT INTO public.meta_eventos (evento, event_id, contato_id, event_time, moeda, status, motivo_descarte)
    VALUES ('Lead', 'suite_descarte_d1', v_contato, now() - interval '30 days', 'BRL', 'descartado', 'fora_da_janela_7d');
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'D1 descartado com motivo', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'D1 descartado com motivo', 'ok', false, 'erro', SQLERRM);
  END;

  -- D2: descartado SEM motivo é recusado.
  total := total + 1;
  BEGIN
    BEGIN
      INSERT INTO public.meta_eventos (evento, event_id, contato_id, event_time, moeda, status)
      VALUES ('Lead', 'suite_descarte_d2', v_contato, now(), 'BRL', 'descartado');
      RAISE EXCEPTION 'aceitou descartado sem motivo';
    EXCEPTION WHEN check_violation THEN
      NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'D2 descartado sem motivo recusado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'D2 descartado sem motivo recusado', 'ok', false, 'erro', SQLERRM);
  END;

  -- D3: motivo em evento que NÃO está descartado é recusado (o motivo não pode mentir).
  total := total + 1;
  BEGIN
    BEGIN
      INSERT INTO public.meta_eventos (evento, event_id, contato_id, event_time, moeda, status, motivo_descarte)
      VALUES ('Lead', 'suite_descarte_d3', v_contato, now(), 'BRL', 'pendente', 'fora_da_janela_7d');
      RAISE EXCEPTION 'aceitou pendente com motivo';
    EXCEPTION WHEN check_violation THEN
      NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'D3 pendente com motivo recusado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'D3 pendente com motivo recusado', 'ok', false, 'erro', SQLERRM);
  END;

  -- D4: status desconhecido continua recusado.
  total := total + 1;
  BEGIN
    BEGIN
      INSERT INTO public.meta_eventos (evento, event_id, contato_id, event_time, moeda, status)
      VALUES ('Lead', 'suite_descarte_d4', v_contato, now(), 'BRL', 'ignorado');
      RAISE EXCEPTION 'aceitou status desconhecido';
    EXCEPTION WHEN check_violation THEN
      NULL;
    END;
    passou := passou + 1;
    resultados := resultados || jsonb_build_object('caso', 'D4 status desconhecido recusado', 'ok', true);
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'D4 status desconhecido recusado', 'ok', false, 'erro', SQLERRM);
  END;

  RAISE EXCEPTION '% meta_eventos_descarte %/% | contagens_antes=% | %',
    CASE WHEN passou = total THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, total, antes, resultados;
END
$suite$;

-- Contagens para rodar antes e depois (têm que bater):
-- SELECT (SELECT count(*) FROM public.contatos) contatos, (SELECT count(*) FROM public.meta_eventos) meta_eventos;
