-- ROLLBACK da migração retomada_e_adiamento (26/10/2026): volta exatamente ao estado anterior.

CREATE OR REPLACE FUNCTION public.rpc_registrar_interacao_ia(p_contato_id uuid, p_payload jsonb, p_message_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_status_antes  public.enum_relacionamento_status;
  v_status_depois public.enum_relacionamento_status;
  v_coluna_antes  public.enum_relacionamento_status;
  v_coluna_depois public.enum_relacionamento_status;
  v_aba           public.enum_relacionamento_aba;
  v_arquivado boolean;
  v_alheias   int;
  v_pendentes int;
  v_data      timestamptz;
  v_sentido   text;
  v_tem_cliente boolean;
  v_cliente   text;
  v_tipo      text;
  v_resultado text;
  v_obs       text;
  v_trecho    text;
  v_achou     boolean;
  v_citacao   text;
  v_retomar   date;
  v_dia       date;
  v_degradou  text;
  v_id        uuid;
BEGIN
  IF p_message_ids IS NULL OR cardinality(p_message_ids) = 0 THEN
    RAISE EXCEPTION 'p_message_ids vazio';
  END IF;

  SELECT status_relacionamento, arquivado_em IS NOT NULL INTO v_status_antes, v_arquivado
    FROM public.contatos
   WHERE id = p_contato_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contato % nao encontrado', p_contato_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_arquivado THEN
    RAISE EXCEPTION 'Contato % esta arquivado: sem interacao da IA', p_contato_id USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1 FROM public.mensagens_whatsapp WHERE message_id = ANY(p_message_ids) FOR UPDATE;

  SELECT count(*) FILTER (WHERE contato_id IS DISTINCT FROM p_contato_id),
         count(*) FILTER (WHERE contato_id = p_contato_id AND processado_em IS NULL AND NOT historico)
    INTO v_alheias, v_pendentes
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids);

  IF v_alheias > 0 THEN
    RAISE EXCEPTION '% mensagem(ns) nao pertencem ao contato %', v_alheias, p_contato_id;
  END IF;

  IF v_pendentes = 0 THEN
    RETURN jsonb_build_object('ja_processada', true);
  END IF;

  SELECT enviada_em, direcao INTO v_data, v_sentido
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids)
   ORDER BY enviada_em DESC, criado_em DESC
   LIMIT 1;

  SELECT count(*) > 0,
         string_agg(conteudo, ' ' ORDER BY enviada_em) FILTER (WHERE nullif(btrim(conteudo), '') IS NOT NULL)
    INTO v_tem_cliente, v_cliente
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids)
     AND direcao = 'entrada'
     AND tipo_midia <> 'template_empresa';

  v_tipo := coalesce(p_payload->>'tipo', 'ponto_contato');
  IF v_tipo NOT IN ('ponto_contato', 'feedback') THEN
    v_tipo := 'ponto_contato';
  END IF;

  v_resultado := nullif(p_payload->>'resultado', '');
  IF v_resultado IS NOT NULL AND v_resultado NOT IN ('respondeu', 'aceitou', 'recusou', 'adiou') THEN
    v_resultado := NULL;
  END IF;
  IF v_resultado IS NOT NULL AND NOT v_tem_cliente THEN
    v_resultado := NULL;
    v_degradou := 'resultado sem mensagem do cliente';
  END IF;
  IF v_resultado IS NOT NULL THEN
    v_tipo := 'ponto_contato';
  END IF;

  IF v_resultado IS NOT NULL THEN
    v_trecho := nullif(btrim(p_payload->>'trecho_cliente'), '');
    IF v_trecho ~ '^\[[a-z_]+\]$' THEN
      RAISE EXCEPTION 'trecho_cliente % e marca de midia, nao frase do cliente', v_trecho
        USING ERRCODE = 'check_violation';
    END IF;
    v_achou := v_trecho IS NOT NULL AND length(v_trecho) >= 2 AND v_cliente IS NOT NULL
               AND position(lower(regexp_replace(v_trecho, '\s+', ' ', 'g'))
                            IN lower(regexp_replace(v_cliente, '\s+', ' ', 'g'))) > 0;
    IF NOT v_achou THEN
      IF v_resultado = 'recusou' THEN
        v_resultado := NULL;
        v_trecho := NULL;
        v_degradou := 'recusa sem trecho do cliente';
      ELSE
        RAISE EXCEPTION 'resultado % sem a frase do cliente numa mensagem de entrada', v_resultado
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF v_resultado = 'adiou' THEN
    v_dia := (v_data AT TIME ZONE 'America/Sao_Paulo')::date;
    IF nullif(btrim(p_payload->>'retomar_em'), '') IS NOT NULL THEN
      BEGIN
        v_retomar := (p_payload->>'retomar_em')::date;
      EXCEPTION WHEN others THEN
        v_retomar := NULL;
      END;
      IF v_retomar IS NULL OR v_retomar <= v_dia OR v_retomar > v_dia + 60 THEN
        v_retomar := NULL;
        v_degradou := 'retomar_em fora da janela; lembrete em 7 dias';
      END IF;
    END IF;
    v_retomar := coalesce(v_retomar, v_dia + 7);
  END IF;

  v_obs := nullif(btrim(p_payload->>'observacao'), '');
  IF v_resultado IS DISTINCT FROM 'recusou' AND v_obs ~* 'recus' THEN
    RAISE EXCEPTION 'observacao fala em recusa, mas o resultado é %', coalesce(v_resultado, 'nenhum')
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_trecho IS NOT NULL THEN
    v_citacao := CASE WHEN v_resultado = 'recusou' THEN 'Recusa: "' ELSE 'Cliente: "' END
                 || left(v_trecho, 150) || '"';
    v_obs := btrim(concat_ws(' ', left(v_obs, 400 - length(v_citacao) - 1), v_citacao));
  END IF;
  IF length(v_obs) > 400 THEN
    v_obs := left(v_obs, 397) || '...';
  END IF;

  SELECT coluna_efetiva, aba_atual INTO v_coluna_antes, v_aba
    FROM public.view_relacionamento_kanban
   WHERE contato_id = p_contato_id;

  INSERT INTO public.interacoes
      (contato_id, data, tipo, canal, sentido, resultado, retomar_em, observacao, gerado_por_ia)
  VALUES
      (p_contato_id, v_data, v_tipo, 'whatsapp', v_sentido, v_resultado, v_retomar, v_obs, true)
  RETURNING id INTO v_id;

  UPDATE public.mensagens_whatsapp
     SET processado_em = now()
   WHERE message_id = ANY(p_message_ids)
     AND processado_em IS NULL
     AND NOT historico;

  SELECT status_relacionamento INTO v_status_depois FROM public.contatos WHERE id = p_contato_id;
  SELECT coluna_efetiva INTO v_coluna_depois
    FROM public.view_relacionamento_kanban
   WHERE contato_id = p_contato_id;

  RETURN jsonb_build_object(
    'interacao_id', v_id,
    'data', v_data,
    'sentido', v_sentido,
    'tipo', v_tipo,
    'resultado', v_resultado,
    'retomar_em', v_retomar,
    'observacao', v_obs,
    'degradou', v_degradou,
    'aba', v_aba,
    'status_antes', v_status_antes,
    'status_depois', v_status_depois,
    'coluna_antes', v_coluna_antes,
    'coluna_depois', v_coluna_depois
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_ia_destino_coluna(p_coluna enum_relacionamento_status, p_sentido text, p_resultado text)
 RETURNS enum_relacionamento_status
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  -- p_coluna é a coluna EFETIVA (a que o Gilmar vê). NULL = não mover.
  SELECT (CASE
    -- Fora do kanban (arquivado) ou Resolvido não reaberto: a IA não mexe.
    WHEN p_coluna IS NULL OR p_coluna = 'resolvido' THEN NULL
    -- Recusa explícita (a RPC só deixa passar com o trecho do cliente).
    WHEN p_resultado = 'recusou' THEN
      CASE WHEN p_coluna = 'recusou' THEN NULL ELSE 'recusou' END
    -- Adiamento: como uma tentativa nossa. Só tira de a_contatar; quem está à frente
    -- fica onde está e a cadência (ou o retomar_em) traz o follow_up.
    WHEN p_resultado = 'adiou' THEN
      CASE WHEN p_coluna = 'a_contatar' THEN 'contatado' END
    -- Aceitou sempre avança; o cliente falou (entrada) também, inclusive saindo de recusou.
    WHEN p_resultado IN ('aceitou', 'respondeu') OR p_sentido = 'entrada' THEN
      CASE WHEN p_coluna = 'em_negociacao' THEN NULL ELSE 'em_negociacao' END
    -- Só nós falamos: avança só de a_contatar. Nunca volta.
    WHEN p_coluna = 'a_contatar' THEN 'contatado'
    ELSE NULL
  END)::public.enum_relacionamento_status
$function$;

DROP TRIGGER IF EXISTS trg_interacao_herda_retomada ON public.interacoes;
DROP FUNCTION IF EXISTS public.fn_interacao_herda_retomada();
DROP FUNCTION IF EXISTS public.fn_frase_adiamento(text);
