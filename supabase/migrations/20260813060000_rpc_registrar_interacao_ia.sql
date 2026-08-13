-- W2: a única porta por onde a IA escreve na timeline do CRM.
--
-- Recebe o JSON do analista, VALIDA contra o vocabulário fechado e grava — insert da
-- interação + marcação das mensagens como processadas, numa transação só. Se algo der
-- errado no meio, nada fica pela metade: ou a conversa virou registro e saiu da fila,
-- ou continua inteira na fila pra próxima rodada.
--
-- POR QUE A VALIDAÇÃO MORA AQUI, E SÓ AQUI:
-- a tentação é validar também no n8n ou na Edge Function, "por garantia". Já paguei o
-- preço dessa duplicação neste projeto — a regra de telefone acabou em três lugares e a
-- terceira cópia nasceu errada, descartando um cliente em silêncio. Aqui é o ponto mais
-- próximo do dado, é onde a `interacoes_vocabulario_check` já vive, e é o único caminho
-- de escrita. Quem chama só repassa.
--
-- DEGRADA EM VEZ DE ABORTAR: valor fora do vocabulário vira o neutro (`null`), não erro.
-- Abortar deixaria a conversa presa em loop — a fila tentaria de novo a cada 5 minutos,
-- para sempre, com o mesmo LLM produzindo o mesmo valor ruim. Degradar mantém o registro
-- útil (o resumo em texto é o que tem valor) e libera a fila.

CREATE OR REPLACE FUNCTION public.rpc_registrar_interacao_ia(
  p_telefone_wa  text,
  p_payload      jsonb,
  p_message_ids  text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_contato    uuid;
  v_pendentes  int;
  v_tipo       text;
  v_sentido    text;
  v_resultado  text;
  v_obs        text;
  v_id         uuid;
BEGIN
  -- Sem contato casado não há timeline onde escrever. Falha alto de propósito: uma
  -- interação órfã seria pior que nenhuma.
  SELECT id INTO v_contato
    FROM public.contatos
   WHERE telefone_wa = p_telefone_wa;

  IF v_contato IS NULL THEN
    RAISE EXCEPTION 'Contato não encontrado para telefone_wa %', p_telefone_wa
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Guarda de idempotência: se as mensagens já foram processadas, não gera uma segunda
  -- interação pela mesma conversa. Protege contra reentrega e contra duas rodadas da
  -- fila se cruzarem — sem isso, o card do Kanban levaria dois empurrões pelo mesmo papo.
  SELECT count(*) INTO v_pendentes
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids)
     AND processado_em IS NULL
     AND NOT historico;

  IF v_pendentes = 0 THEN
    RETURN NULL;
  END IF;

  -- ── Vocabulário fechado ─────────────────────────────────────────────────────
  -- `movimentacao_kanban` NÃO entra: aquilo é registro de quem moveu o card na mão.
  v_tipo := coalesce(p_payload->>'tipo', 'ponto_contato');
  IF v_tipo NOT IN ('ponto_contato', 'feedback') THEN
    v_tipo := 'ponto_contato';
  END IF;

  -- Sentido é determinístico (quem mandou a última mensagem) e vem decidido de fora;
  -- validado aqui só porque esta função não confia em quem chama.
  v_sentido := coalesce(p_payload->>'sentido', 'saida');
  IF v_sentido NOT IN ('entrada', 'saida') THEN
    v_sentido := 'saida';
  END IF;

  -- `resultado` só existe em ponto_contato — em feedback a constraint exige NULL.
  v_resultado := nullif(p_payload->>'resultado', '');
  IF v_tipo <> 'ponto_contato' THEN
    v_resultado := NULL;
  ELSIF v_resultado IS NOT NULL AND v_resultado NOT IN ('respondeu', 'aceitou', 'recusou') THEN
    v_resultado := NULL;
  END IF;

  -- A timeline mostra a observação truncada; texto quilométrico do LLM não ajuda o
  -- Gilmar e ainda empurra o resto do card pra fora da tela.
  v_obs := nullif(btrim(p_payload->>'observacao'), '');
  IF length(v_obs) > 400 THEN
    v_obs := left(v_obs, 397) || '...';
  END IF;

  INSERT INTO public.interacoes
      (contato_id, tipo, canal, sentido, resultado, observacao, gerado_por_ia)
  VALUES
      (v_contato, v_tipo, 'whatsapp', v_sentido, v_resultado, v_obs, true)
  RETURNING id INTO v_id;

  -- Só sai da fila o que estava na fila: histórico nunca é marcado porque nunca entra.
  UPDATE public.mensagens_whatsapp
     SET processado_em = now()
   WHERE message_id = ANY(p_message_ids)
     AND processado_em IS NULL
     AND NOT historico;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_registrar_interacao_ia(text, jsonb, text[]) IS
  'Unica porta de escrita da IA na timeline. Valida o vocabulario fechado (degradando para NULL), insere a interacao com gerado_por_ia=true e marca as mensagens como processadas, atomicamente.';

-- SECURITY DEFINER + exposta no PostgREST = precisa de REVOKE explícito. O default do
-- Supabase concede EXECUTE a `anon`, e já houve caso neste projeto de RPC nascendo
-- chamável sem login (`criar_venda`). Quem chama é a Edge Function, via service_role.
REVOKE EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(text, jsonb, text[])
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
