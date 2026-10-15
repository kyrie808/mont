-- Pacote da auditoria das notas reais (Luccas, 15/10/2026), antes da E5:
--
--   4a. templateMessage (mensagem automática de empresa) vira tipo_midia próprio,
--       'template_empresa', e não conta como mensagem de cliente: o ingestor grava já fora
--       da fila do analista e não cria contato por ela. As já gravadas são reclassificadas.
--   4b. O analista ignora esse tipo (filtro na fila; ver a Edge Function).
--   4c. Contato arquivado não ganha interação da IA: o analista descarta o segmento sem
--       nota; a RPC recusa; o pedido do catálogo de um arquivado fica registrado em
--       wa_pedido_catalogo, mas sem nota na timeline. (Nada desarquiva contato: só a view
--       do kanban lê arquivado_em, e ela já os esconde.)
--   4d. Segmento em que a "frase do cliente" seria só uma marca de mídia ([outro],
--       [sticker], [audio]) não gera interação nem move card: rpc_analista_descartar.
--
-- Os dados dos 4 contatos de empresa (arquivados, 22 interações apagadas) foram tratados
-- pelo Luccas à mão; esta migration não mexe neles além de reclassificar as mensagens.
-- Teste: supabase/tests/analista_adiou.sql (casos A13–A16), transação descartada.

-- ── 4a. tipo_midia 'template_empresa' ────────────────────────────────────────────
ALTER TABLE public.mensagens_whatsapp DROP CONSTRAINT mensagens_whatsapp_tipo_midia_check;
ALTER TABLE public.mensagens_whatsapp ADD CONSTRAINT mensagens_whatsapp_tipo_midia_check
  CHECK (tipo_midia = ANY (ARRAY[
    'texto', 'audio', 'imagem', 'video', 'documento', 'sticker',
    'localizacao', 'contato', 'pedido', 'outro', 'template_empresa'
  ]));

UPDATE public.mensagens_whatsapp
   SET tipo_midia   = 'template_empresa',
       processado_em = coalesce(processado_em, now())
 WHERE payload -> 'message' ? 'templateMessage'
   AND tipo_midia IS DISTINCT FROM 'template_empresa';

-- ── Contador de descartes por rodada ──────────────────────────────────────────────
ALTER TABLE public.wa_analista_rodadas
  ADD COLUMN IF NOT EXISTS descartados integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.wa_analista_rodadas.descartados IS
  'Segmentos que saíram da fila sem nota: contato arquivado ou cliente que só mandou mídia sem texto.';

-- ── 4c/4d. Descarte de segmento, conferido no banco ───────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_analista_descartar(
  p_contato_id  uuid,
  p_message_ids text[],
  p_motivo      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_arquivado boolean;
  v_alheias   int;
  v_entradas  int;
  v_com_texto int;
  v_marcadas  int;
BEGIN
  IF p_message_ids IS NULL OR cardinality(p_message_ids) = 0 THEN
    RAISE EXCEPTION 'p_message_ids vazio';
  END IF;

  SELECT arquivado_em IS NOT NULL INTO v_arquivado FROM public.contatos WHERE id = p_contato_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contato % nao encontrado', p_contato_id USING ERRCODE = 'no_data_found';
  END IF;

  SELECT count(*) FILTER (WHERE contato_id IS DISTINCT FROM p_contato_id),
         count(*) FILTER (WHERE direcao = 'entrada'),
         count(*) FILTER (WHERE direcao = 'entrada' AND nullif(btrim(conteudo), '') IS NOT NULL)
    INTO v_alheias, v_entradas, v_com_texto
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids);

  IF v_alheias > 0 THEN
    RAISE EXCEPTION '% mensagem(ns) nao pertencem ao contato %', v_alheias, p_contato_id;
  END IF;

  -- O banco confere o motivo: descartar é deixar de registrar, não pode ser atalho.
  IF p_motivo = 'contato_arquivado' THEN
    IF NOT v_arquivado THEN
      RAISE EXCEPTION 'contato % nao esta arquivado', p_contato_id USING ERRCODE = 'check_violation';
    END IF;
  ELSIF p_motivo = 'so_marcador' THEN
    IF v_entradas = 0 OR v_com_texto > 0 THEN
      RAISE EXCEPTION 'segmento tem texto do cliente (ou nenhuma mensagem dele): nao e so marcador'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    RAISE EXCEPTION 'motivo de descarte desconhecido: %', p_motivo USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.mensagens_whatsapp
     SET processado_em = now()
   WHERE message_id = ANY(p_message_ids)
     AND processado_em IS NULL
     AND NOT historico;
  GET DIAGNOSTICS v_marcadas = ROW_COUNT;

  RETURN jsonb_build_object('descartado', p_motivo, 'mensagens', v_marcadas);
END;
$$;

COMMENT ON FUNCTION public.rpc_analista_descartar(uuid, text[], text) IS
  'Tira um segmento da fila do analista SEM nota e sem mexer no card. Só para contato arquivado ou segmento em que o cliente só mandou mídia sem texto; o banco confere o motivo.';

REVOKE EXECUTE ON FUNCTION public.rpc_analista_descartar(uuid, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_analista_descartar(uuid, text[], text) TO service_role;

-- ── rpc_registrar_interacao_ia: recusa arquivado e frase que é só marca de mídia ──
CREATE OR REPLACE FUNCTION public.rpc_registrar_interacao_ia(
  p_contato_id  uuid,
  p_payload     jsonb,
  p_message_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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

  -- Trava o contato e depois as mensagens. Duas rodadas sobre o mesmo cliente passam a
  -- ser uma depois da outra; a segunda vê as mensagens já processadas e sai abaixo.
  SELECT status_relacionamento, arquivado_em IS NOT NULL INTO v_status_antes, v_arquivado
    FROM public.contatos
   WHERE id = p_contato_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contato % nao encontrado', p_contato_id USING ERRCODE = 'no_data_found';
  END IF;
  -- Contato arquivado não ganha interação da IA (o analista descarta o segmento antes).
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

  -- Idempotência: segmento já registrado não gera segunda interação.
  IF v_pendentes = 0 THEN
    RETURN jsonb_build_object('ja_processada', true);
  END IF;

  -- Data e sentido vêm do banco, não de quem chama: a última mensagem do segmento.
  SELECT enviada_em, direcao INTO v_data, v_sentido
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids)
   ORDER BY enviada_em DESC, criado_em DESC
   LIMIT 1;

  -- Só o que o CLIENTE escreveu (mensagem automática de empresa não é fala do cliente).
  SELECT count(*) > 0,
         string_agg(conteudo, ' ' ORDER BY enviada_em) FILTER (WHERE nullif(btrim(conteudo), '') IS NOT NULL)
    INTO v_tem_cliente, v_cliente
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids)
     AND direcao = 'entrada'
     AND tipo_midia <> 'template_empresa';

  -- ── Vocabulário fechado (degrada para o neutro em vez de abortar) ──────────────
  v_tipo := coalesce(p_payload->>'tipo', 'ponto_contato');
  IF v_tipo NOT IN ('ponto_contato', 'feedback') THEN
    v_tipo := 'ponto_contato';
  END IF;

  v_resultado := nullif(p_payload->>'resultado', '');
  IF v_resultado IS NOT NULL AND v_resultado NOT IN ('respondeu', 'aceitou', 'recusou', 'adiou') THEN
    v_resultado := NULL;
  END IF;
  -- Sem mensagem do cliente não há resposta do cliente.
  IF v_resultado IS NOT NULL AND NOT v_tem_cliente THEN
    v_resultado := NULL;
    v_degradou := 'resultado sem mensagem do cliente';
  END IF;
  -- Resultado preenchido vence feedback: a constraint zeraria o resultado de um feedback.
  IF v_resultado IS NOT NULL THEN
    v_tipo := 'ponto_contato';
  END IF;

  -- ── Frase-chave do cliente: todo resultado cita um TEXTO que o cliente escreveu ─
  IF v_resultado IS NOT NULL THEN
    v_trecho := nullif(btrim(p_payload->>'trecho_cliente'), '');
    -- Marca de mídia ("[outro]", "[sticker]") não é frase: segmento assim não vira nota.
    IF v_trecho ~ '^\[[a-z_]+\]$' THEN
      RAISE EXCEPTION 'trecho_cliente % e marca de midia, nao frase do cliente', v_trecho
        USING ERRCODE = 'check_violation';
    END IF;
    v_achou := v_trecho IS NOT NULL AND length(v_trecho) >= 2 AND v_cliente IS NOT NULL
               AND position(lower(regexp_replace(v_trecho, '\s+', ' ', 'g'))
                            IN lower(regexp_replace(v_cliente, '\s+', ' ', 'g'))) > 0;
    IF NOT v_achou THEN
      IF v_resultado = 'recusou' THEN
        -- Recusa sem as palavras do cliente não congela o card: vira registro neutro.
        v_resultado := NULL;
        v_trecho := NULL;
        v_degradou := 'recusa sem trecho do cliente';
      ELSE
        RAISE EXCEPTION 'resultado % sem a frase do cliente numa mensagem de entrada', v_resultado
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  -- ── Retomada: só no adiamento; sem prazo válido, 7 dias depois da conversa ─────
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
  -- A palavra vale mais que o rótulo para quem lê: nota que fala em recusa só com recusou.
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

  -- O trigger fn_contato_assistido_status aplica a trava da IA sobre o card.
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
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) TO service_role;

-- ── 4c. Pedido do catálogo de contato arquivado: registra o pedido, sem nota ──────
CREATE OR REPLACE FUNCTION public.rpc_registrar_pedido_catalogo_wa(
  p_message_id text,
  p_order_id   text,
  p_titulo     text,
  p_itens_qtd  integer,
  p_total      numeric,
  p_moeda      text,
  p_observacao text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_msg       record;
  v_arquivado boolean;
  v_pedido    uuid;
  v_interacao uuid;
  v_obs       text;
BEGIN
  SELECT contato_id, telefone_wa, direcao, enviada_em, conteudo
    INTO v_msg
    FROM public.mensagens_whatsapp
   WHERE message_id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem % nao encontrada', p_message_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_msg.direcao <> 'entrada' THEN
    RAISE EXCEPTION 'Pedido do catalogo so existe em mensagem de entrada (%)', p_message_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_msg.contato_id IS NULL THEN
    RAISE EXCEPTION 'Mensagem % ainda sem contato', p_message_id USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.wa_pedido_catalogo
      (message_id, contato_id, telefone_wa, order_id, titulo, itens_qtd, total, moeda, observacao, pedido_em)
  VALUES
      (p_message_id, v_msg.contato_id, v_msg.telefone_wa, p_order_id, p_titulo, p_itens_qtd,
       p_total, p_moeda, p_observacao, v_msg.enviada_em)
  ON CONFLICT (message_id) DO NOTHING
  RETURNING id INTO v_pedido;

  -- Já registrado: nada a fazer, e nada de nota duplicada.
  IF v_pedido IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT arquivado_em IS NOT NULL INTO v_arquivado FROM public.contatos WHERE id = v_msg.contato_id;

  -- Contato arquivado: o pedido fica em wa_pedido_catalogo, mas sem nota da IA.
  IF NOT v_arquivado THEN
    v_obs := coalesce(v_msg.conteudo, '🛒 Pedido pelo catálogo do WhatsApp') || '. Aguardando virar venda.';
    IF length(v_obs) > 400 THEN
      v_obs := left(v_obs, 397) || '...';
    END IF;

    INSERT INTO public.interacoes
        (contato_id, data, tipo, canal, sentido, resultado, observacao, gerado_por_ia)
    VALUES
        (v_msg.contato_id, v_msg.enviada_em, 'ponto_contato', 'whatsapp', 'entrada', 'aceitou', v_obs, true)
    RETURNING id INTO v_interacao;

    UPDATE public.wa_pedido_catalogo SET interacao_id = v_interacao WHERE id = v_pedido;
  END IF;

  -- A nota acima (ou o arquivamento) já resolve esta mensagem: o analista não a lê.
  UPDATE public.mensagens_whatsapp
     SET processado_em = now()
   WHERE message_id = p_message_id
     AND processado_em IS NULL
     AND NOT historico;

  RETURN v_pedido;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_registrar_pedido_catalogo_wa(text, text, text, integer, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pedido_catalogo_wa(text, text, text, integer, numeric, text, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
