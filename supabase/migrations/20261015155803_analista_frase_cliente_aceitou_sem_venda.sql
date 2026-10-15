-- E4, ajustes da simulação final aprovada (15/10/2026). Decisões do Luccas:
--
--   2. Adiamento sem prazo claro: retomar_em = dia da conversa + 7. Nenhum adiamento fica
--      sem lembrete (em qualquer coluna).
--   3. View aceitou_sem_venda: pedido aceito nas últimas 72h que não virou venda no sistema.
--   6. Toda nota com resultado termina com a frase-chave do CLIENTE entre aspas, conferida
--      numa mensagem de entrada (Cliente: "Estou viajando"; na recusa, Recusa: "...").
--      O payload passa a ter UM campo de trecho: `trecho_cliente` (substitui trecho_recusa).
--
-- Teste: supabase/tests/analista_adiou.sql e analista_trava_kanban.sql (transação descartada).

-- ── 1. rpc_registrar_interacao_ia ───────────────────────────────────────────────

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
  SELECT status_relacionamento INTO v_status_antes
    FROM public.contatos
   WHERE id = p_contato_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contato % nao encontrado', p_contato_id USING ERRCODE = 'no_data_found';
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

  -- O texto do cliente como o analista o viu: mídia sem texto vira "[audio]", "[imagem]"…
  -- (a mesma marca do prompt), para a frase citada poder ser conferida.
  SELECT count(*) > 0,
         string_agg(coalesce(conteudo, '[' || tipo_midia || ']'), ' ' ORDER BY enviada_em)
    INTO v_tem_cliente, v_cliente
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids)
     AND direcao = 'entrada';

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

  -- ── Frase-chave do cliente: todo resultado cita o que o CLIENTE escreveu ───────
  IF v_resultado IS NOT NULL THEN
    v_trecho := nullif(btrim(p_payload->>'trecho_cliente'), '');
    v_achou := v_trecho IS NOT NULL AND length(v_trecho) >= 2
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

COMMENT ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) IS
  'Única porta de escrita do analista na timeline. Trava contato e mensagens, valida o vocabulário, exige a frase do cliente (trecho_cliente) em todo resultado e a cita no fim da nota, dá lembrete de 7 dias ao adiamento sem prazo, data a interação pela última mensagem do segmento e devolve o movimento do card.';

REVOKE EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) TO service_role;

-- ── 2. aceitou_sem_venda ─────────────────────────────────────────────────────────
-- Pedido aceito que não virou venda no sistema. Regras:
--   • interação ponto_contato com resultado aceitou nas últimas 72h (da IA ou de gente);
--   • 24h de tolerância: só aparece depois de 24h sem venda (tempo de lançar a venda);
--   • conta como venda a pendente ou entregue com data a partir do DIA da interação
--     (Brasília). Não "depois do instante": a nota da IA leva a hora da ÚLTIMA mensagem
--     da conversa, e a venda costuma ser lançada durante ela (Maria, 14/10: venda 16:37,
--     nota 16:40);
--   • uma linha por contato (o aceite mais recente que se encaixa).
CREATE OR REPLACE VIEW public.aceitou_sem_venda
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (i.contato_id)
       i.contato_id,
       c.nome,
       c.telefone,
       i.id            AS interacao_id,
       i.data          AS aceitou_em,
       i.gerado_por_ia,
       i.observacao,
       c.status_relacionamento
  FROM public.interacoes i
  JOIN public.contatos c ON c.id = i.contato_id
 WHERE i.tipo = 'ponto_contato'
   AND i.resultado = 'aceitou'
   AND i.data >= now() - interval '72 hours'
   AND i.data <= now() - interval '24 hours'
   AND c.arquivado_em IS NULL
   AND NOT EXISTS (
         SELECT 1
           FROM public.vendas v
          WHERE v.contato_id = i.contato_id
            AND v.status IN ('pendente', 'entregue')
            AND v.data >= (i.data AT TIME ZONE 'America/Sao_Paulo')::date
       )
 ORDER BY i.contato_id, i.data DESC;

COMMENT ON VIEW public.aceitou_sem_venda IS
  'Contatos com aceite (resultado aceitou) nas últimas 72h, há mais de 24h e sem venda pendente/entregue lançada a partir do dia do aceite. Pega pedido que nunca virou venda no sistema.';

REVOKE ALL ON public.aceitou_sem_venda FROM anon;
GRANT SELECT ON public.aceitou_sem_venda TO authenticated;

NOTIFY pgrst, 'reload schema';
