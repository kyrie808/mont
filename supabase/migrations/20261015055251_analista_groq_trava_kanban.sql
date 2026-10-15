-- E4: o analista de conversa sai do n8n e passa a rodar no Supabase (pg_cron → Edge
-- Function `whatsapp-analista`, ação `rodar`, Groq gpt-oss-20b). Esta migration é o lado
-- do banco. O agendamento do cron vem numa migration à parte, aplicada só depois da
-- rodada de teste aprovada.
--
--   1. Reabertura do Resolvido: uma função, usada pela view do kanban (e, através dela,
--      pela trava da IA). Regra de EXIBIÇÃO: nenhum status gravado muda.
--   2. Trava da IA no kanban: interação gerada por IA só AVANÇA a coluna
--      (a_contatar → contatado → em_negociacao); nunca grava nem tira de `resolvido`
--      (só sai de lá quando a view já mostra o card reaberto); grava `recusou` só com
--      recusa explícita; quem está em `recusou` e escreve vai para em_negociacao.
--      Interação de gente segue a regra de sempre.
--   3. rpc_registrar_interacao_ia: trava contato e mensagens (fim da corrida entre duas
--      rodadas), data = última mensagem do segmento, sentido decidido pelo banco,
--      recusa só com o trecho do cliente, e devolve o movimento do card.
--   4. Falhas por segmento em mensagens_whatsapp (5 rodadas → travado) e o registro de
--      cada rodada em wa_analista_rodadas. Nada engolido.

-- ── 1. Reabertura do Resolvido ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_relacionamento_reaberto(
  p_aba    public.enum_relacionamento_aba,
  p_atraso integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  -- Reativação: estar nessa aba já significa que está na hora.
  -- Recompra: passou da próxima compra esperada (atraso >= 0).
  -- Cobrança (e leads): só gente tira do Resolvido.
  SELECT coalesce(p_aba = 'reativacao' OR (p_aba = 'recompra' AND p_atraso >= 0), false)
$$;

COMMENT ON FUNCTION public.fn_relacionamento_reaberto(public.enum_relacionamento_aba, integer) IS
  'Quando um card em resolvido volta a aparecer como a_contatar (ciclo de recompra). Regra de exibição: usada pela view_relacionamento_kanban; a trava da IA lê a coluna da view.';

-- Mesma view, com UMA mudança: `resolvido` reaberto aparece como `a_contatar`.
-- A aba sai para um LATERAL para a regra de reabertura usar exatamente a aba exibida.
-- WITH (security_invoker) explícito: CREATE OR REPLACE VIEW sem ele RESETA a opção.
CREATE OR REPLACE VIEW public.view_relacionamento_kanban
WITH (security_invoker = true)
AS
 WITH compras AS (
         SELECT v.contato_id,
            count(DISTINCT v.data)::integer AS total_pedidos,
            min(v.data) AS primeira_compra,
            max(v.data) AS ultima_compra
           FROM vendas v
          WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text
          GROUP BY v.contato_id
        ), fiado_aberto AS (
         SELECT v.contato_id,
            bool_or(v.status = 'entregue'::text AND v.forma_pagamento = 'fiado'::text AND v.pago = false) AS tem_fiado_aberto
           FROM vendas v
          GROUP BY v.contato_id
        ), cfg AS (
         SELECT COALESCE(max((configuracoes.valor ->> 'limiar_reativacao'::text)::integer), 30) AS limiar_reativacao,
            COALESCE(max((configuracoes.valor ->> 'multiplicador_sumido'::text)::numeric), 1.5) AS multiplicador_sumido,
            COALESCE(max((configuracoes.valor ->> 'cooldown_recusa_dias'::text)::integer), 30) AS cooldown_recusa_dias
           FROM configuracoes
          WHERE configuracoes.chave = 'relacionamento'::text
        ), respostas AS (
         SELECT i.contato_id,
            max(i.data) AS reset_at
           FROM interacoes i
          WHERE i.tipo = 'ponto_contato'::text AND (i.sentido = 'entrada'::text OR (i.resultado = ANY (ARRAY['respondeu'::text, 'aceitou'::text, 'recusou'::text]))) OR i.tipo = 'movimentacao_kanban'::text
          GROUP BY i.contato_id
        ), saidas AS (
         SELECT i.contato_id,
            count(*) FILTER (WHERE r.reset_at IS NULL OR i.data > r.reset_at) AS tentativas,
            max(i.data) FILTER (WHERE r.reset_at IS NULL OR i.data > r.reset_at) AS ultimo_saida
           FROM interacoes i
             LEFT JOIN respostas r ON r.contato_id = i.contato_id
          WHERE i.tipo = 'ponto_contato'::text AND i.sentido = 'saida'::text AND i.resultado IS NULL
          GROUP BY i.contato_id
        ), cadencia AS (
         SELECT s.contato_id,
            s.tentativas,
            s.ultimo_saida,
                CASE s.tentativas
                    WHEN 1 THEN s.ultimo_saida + '00:30:00'::interval
                    WHEN 2 THEN s.ultimo_saida + '04:00:00'::interval
                    WHEN 3 THEN ((date_trunc('day'::text, (s.ultimo_saida AT TIME ZONE 'America/Sao_Paulo'::text)) + '1 day 09:00:00'::interval) AT TIME ZONE 'America/Sao_Paulo'::text)
                    WHEN 4 THEN s.ultimo_saida + '3 days'::interval
                    ELSE NULL::timestamp with time zone
                END AS prazo
           FROM saidas s
        ), recusas AS (
         SELECT i.contato_id,
            max(i.data) AS recusa_at
           FROM interacoes i
          WHERE i.tipo = 'ponto_contato'::text AND i.resultado = 'recusou'::text
          GROUP BY i.contato_id
        ), metricas AS (
         SELECT cp.contato_id,
            cp.total_pedidos,
            cp.primeira_compra,
            cp.ultima_compra,
            CURRENT_DATE - cp.ultima_compra AS dias_sem_compra,
                CASE
                    WHEN cp.total_pedidos >= 2 THEN (cp.ultima_compra - cp.primeira_compra)::numeric / (cp.total_pedidos - 1)::numeric
                    ELSE NULL::numeric
                END AS intervalo_medio,
                CASE
                    WHEN cp.total_pedidos >= 2 THEN cp.ultima_compra + (cp.ultima_compra - cp.primeira_compra) / (cp.total_pedidos - 1)
                    ELSE NULL::date
                END AS proxima_esperada
           FROM compras cp
        )
 SELECT c.id AS contato_id,
    c.nome,
    c.telefone,
    c.status_relacionamento,
    c.arquivado_em,
    ab.aba AS aba_atual,
    COALESCE(m.total_pedidos, 0) AS total_pedidos,
    m.primeira_compra,
    m.ultima_compra,
    m.dias_sem_compra,
    m.intervalo_medio,
    m.proxima_esperada,
        CASE
            WHEN m.proxima_esperada IS NOT NULL THEN CURRENT_DATE - m.proxima_esperada
            ELSE NULL::integer
        END AS atraso,
        CASE
            WHEN m.proxima_esperada IS NOT NULL AND (CURRENT_DATE - m.proxima_esperada)::numeric >= round(m.intervalo_medio * cfg.multiplicador_sumido) THEN true
            ELSE false
        END AS sumido,
        CASE
            WHEN COALESCE(m.total_pedidos, 0) = 1 AND m.dias_sem_compra < cfg.limiar_reativacao THEN true
            ELSE false
        END AS balde_cheio,
    COALESCE(cad.tentativas, 0::bigint)::integer AS tentativas,
        CASE
            WHEN c.status_relacionamento = 'contatado'::enum_relacionamento_status AND COALESCE(cad.tentativas, 0::bigint) >= 5 THEN 'sem_retorno'::enum_relacionamento_status
            WHEN c.status_relacionamento = 'contatado'::enum_relacionamento_status AND cad.prazo IS NOT NULL AND now() >= cad.prazo THEN 'follow_up'::enum_relacionamento_status
            WHEN c.status_relacionamento = 'recusou'::enum_relacionamento_status AND rec.recusa_at IS NOT NULL AND now() < (rec.recusa_at + make_interval(days => cfg.cooldown_recusa_dias)) THEN 'recusou'::enum_relacionamento_status
            WHEN c.status_relacionamento = 'recusou'::enum_relacionamento_status THEN 'a_contatar'::enum_relacionamento_status
            -- Novo: Resolvido reabre quando volta a ser a hora (ciclo de recompra).
            WHEN c.status_relacionamento = 'resolvido'::enum_relacionamento_status
                 AND public.fn_relacionamento_reaberto(ab.aba,
                       CASE WHEN m.proxima_esperada IS NOT NULL THEN CURRENT_DATE - m.proxima_esperada END)
                 THEN 'a_contatar'::enum_relacionamento_status
            ELSE COALESCE(c.status_relacionamento, 'a_contatar'::enum_relacionamento_status)
        END AS coluna_efetiva,
        CASE
            WHEN c.status_relacionamento = 'recusou'::enum_relacionamento_status AND rec.recusa_at IS NOT NULL THEN GREATEST(0::numeric, ceil(EXTRACT(epoch FROM rec.recusa_at + make_interval(days => cfg.cooldown_recusa_dias) - now()) / 86400.0))::integer
            ELSE NULL::integer
        END AS recusa_dias_restantes
   FROM contatos c
     CROSS JOIN cfg
     LEFT JOIN metricas m ON m.contato_id = c.id
     LEFT JOIN fiado_aberto fa ON fa.contato_id = c.id
     LEFT JOIN cadencia cad ON cad.contato_id = c.id
     LEFT JOIN recusas rec ON rec.contato_id = c.id
     CROSS JOIN LATERAL (
       SELECT CASE
            WHEN COALESCE(fa.tem_fiado_aberto, false) THEN 'cobranca'::enum_relacionamento_aba
            WHEN COALESCE(m.total_pedidos, 0) = 0 THEN 'leads'::enum_relacionamento_aba
            WHEN COALESCE(m.total_pedidos, 0) = 1 AND m.dias_sem_compra >= cfg.limiar_reativacao THEN 'reativacao'::enum_relacionamento_aba
            ELSE 'recompra'::enum_relacionamento_aba
        END AS aba
     ) ab
  WHERE c.arquivado_em IS NULL;

-- ── 2. Trava da IA no kanban ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_ia_destino_coluna(
  p_coluna    public.enum_relacionamento_status,
  p_sentido   text,
  p_resultado text
)
RETURNS public.enum_relacionamento_status
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  -- p_coluna é a coluna EFETIVA (a que o Gilmar vê). NULL = não mover.
  SELECT (CASE
    -- Fora do kanban (arquivado) ou Resolvido não reaberto: a IA não mexe.
    WHEN p_coluna IS NULL OR p_coluna = 'resolvido' THEN NULL
    -- Recusa explícita (a RPC só deixa passar com o trecho do cliente).
    WHEN p_resultado = 'recusou' THEN
      CASE WHEN p_coluna = 'recusou' THEN NULL ELSE 'recusou' END
    -- O cliente falou: avança para em_negociacao, inclusive saindo de recusou.
    WHEN p_sentido = 'entrada' OR p_resultado IN ('respondeu', 'aceitou') THEN
      CASE WHEN p_coluna = 'em_negociacao' THEN NULL ELSE 'em_negociacao' END
    -- Só nós falamos: avança só de a_contatar. Nunca volta.
    WHEN p_coluna = 'a_contatar' THEN 'contatado'
    ELSE NULL
  END)::public.enum_relacionamento_status
$$;

COMMENT ON FUNCTION public.fn_ia_destino_coluna(public.enum_relacionamento_status, text, text) IS
  'Trava da IA: para onde uma interação gerada por IA pode levar o card, a partir da coluna efetiva. NULL = não mover. Nunca devolve resolvido nem volta coluna.';

CREATE OR REPLACE FUNCTION public.fn_contato_assistido_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_coluna  enum_relacionamento_status;
    v_destino enum_relacionamento_status;
BEGIN
    IF NEW.tipo <> 'ponto_contato' THEN
        RETURN NEW;
    END IF;

    -- IA: só avança, a partir da coluna que a view mostra (que já considera a
    -- reabertura do Resolvido, o follow_up e o fim da quarentena da recusa).
    IF NEW.gerado_por_ia THEN
        SELECT coluna_efetiva INTO v_coluna
          FROM public.view_relacionamento_kanban
         WHERE contato_id = NEW.contato_id;

        v_destino := public.fn_ia_destino_coluna(v_coluna, NEW.sentido, NEW.resultado);

        IF v_destino IS NOT NULL THEN
            UPDATE public.contatos
            SET status_relacionamento = v_destino
            WHERE id = NEW.contato_id
              AND status_relacionamento IS DISTINCT FROM v_destino;
        END IF;
        RETURN NEW;
    END IF;

    -- Gente: regra de sempre.
    IF NEW.resultado = 'recusou' THEN
        UPDATE public.contatos
        SET status_relacionamento = 'recusou'
        WHERE id = NEW.contato_id
          AND status_relacionamento IS DISTINCT FROM 'recusou'::enum_relacionamento_status;
    ELSIF NEW.sentido = 'entrada' OR NEW.resultado IN ('respondeu', 'aceitou') THEN
        UPDATE public.contatos
        SET status_relacionamento = 'em_negociacao'
        WHERE id = NEW.contato_id
          AND status_relacionamento IS DISTINCT FROM 'em_negociacao'::enum_relacionamento_status;
    ELSE
        UPDATE public.contatos
        SET status_relacionamento = 'contatado'
        WHERE id = NEW.contato_id
          AND status_relacionamento IS DISTINCT FROM 'contatado'::enum_relacionamento_status;
    END IF;

    RETURN NEW;
END;
$function$;

-- ── 4a. Falhas por segmento e registro das rodadas ─────────────────────────────

ALTER TABLE public.mensagens_whatsapp
  ADD COLUMN IF NOT EXISTS analise_falhas smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analise_ultimo_erro text,
  ADD COLUMN IF NOT EXISTS analise_travada_em timestamptz;

COMMENT ON COLUMN public.mensagens_whatsapp.analise_falhas IS
  'Rodadas do analista em que o segmento desta mensagem falhou (resposta inválida do LLM duas vezes, erro da RPC).';
COMMENT ON COLUMN public.mensagens_whatsapp.analise_travada_em IS
  'Preenchido na 5ª falha: o segmento sai da fila do analista e precisa de olho humano. Zerar para tentar de novo.';

CREATE TABLE IF NOT EXISTS public.wa_analista_rodadas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciada_em       timestamptz NOT NULL DEFAULT now(),
  terminada_em      timestamptz,
  origem            text NOT NULL CHECK (origem IN ('cron', 'manual')),
  simulacao         boolean NOT NULL DEFAULT false,
  modelo            text NOT NULL,
  status            text NOT NULL DEFAULT 'rodando'
                    CHECK (status IN ('rodando', 'ok', 'parcial', 'limite_groq', 'erro')),
  segmentos_prontos integer,
  analisados        integer NOT NULL DEFAULT 0,
  gravados          integer NOT NULL DEFAULT 0,
  falhas            integer NOT NULL DEFAULT 0,
  travados          integer NOT NULL DEFAULT 0,
  adiados           integer NOT NULL DEFAULT 0,
  aviso             text,
  detalhes          jsonb NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.wa_analista_rodadas IS
  'Uma linha por rodada do analista (cron a cada 15 min ou manual). status limite_groq = 429 encerrou a rodada; aviso explica. detalhes = um item por segmento.';

CREATE INDEX IF NOT EXISTS idx_wa_analista_rodadas_iniciada
  ON public.wa_analista_rodadas (iniciada_em DESC);

ALTER TABLE public.wa_analista_rodadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler wa_analista_rodadas"
  ON public.wa_analista_rodadas FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.wa_analista_rodadas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.wa_analista_rodadas FROM authenticated;

CREATE OR REPLACE FUNCTION public.rpc_analista_registrar_falha(
  p_message_ids text[],
  p_erro        text,
  p_limite      integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_max   integer;
  v_novas integer;
BEGIN
  SELECT max(analise_falhas) INTO v_max
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids)
     AND processado_em IS NULL
     AND NOT historico;

  IF v_max IS NULL THEN
    RETURN jsonb_build_object('falhas', NULL, 'travado', false);
  END IF;

  v_novas := v_max + 1;

  -- O segmento conta como um só: todas as mensagens ficam com o mesmo contador.
  UPDATE public.mensagens_whatsapp
     SET analise_falhas      = v_novas,
         analise_ultimo_erro = left(p_erro, 500),
         analise_travada_em  = CASE WHEN v_novas >= p_limite THEN now() ELSE NULL END
   WHERE message_id = ANY(p_message_ids)
     AND processado_em IS NULL
     AND NOT historico;

  RETURN jsonb_build_object('falhas', v_novas, 'travado', v_novas >= p_limite);
END;
$$;

-- Prévia para a rodada de simulação: o MESMO cálculo da trava, sem gravar nada.
-- p_coluna_simulada encadeia segmentos do mesmo contato dentro de uma simulação.
CREATE OR REPLACE FUNCTION public.rpc_analista_previa(
  p_contato_id      uuid,
  p_sentido         text,
  p_resultado       text,
  p_coluna_simulada public.enum_relacionamento_status DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'aba', v.aba_atual,
    'status', v.status_relacionamento,
    'coluna_antes', coalesce(p_coluna_simulada, v.coluna_efetiva),
    'destino', public.fn_ia_destino_coluna(coalesce(p_coluna_simulada, v.coluna_efetiva), p_sentido, p_resultado)
  )
  FROM public.view_relacionamento_kanban v
  WHERE v.contato_id = p_contato_id
$$;

-- ── 3. rpc_registrar_interacao_ia ───────────────────────────────────────────────
-- Assinatura nova (contato por id, retorno jsonb). Quem chamava a antiga era só o W2 do
-- n8n, pausado desde 14/10 e aposentado por esta etapa.

DROP FUNCTION IF EXISTS public.rpc_registrar_interacao_ia(text, jsonb, text[]);

CREATE FUNCTION public.rpc_registrar_interacao_ia(
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
  v_cliente   text;
  v_tipo      text;
  v_resultado text;
  v_obs       text;
  v_trecho    text;
  v_citacao   text;
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

  SELECT string_agg(conteudo, ' ' ORDER BY enviada_em) INTO v_cliente
    FROM public.mensagens_whatsapp
   WHERE message_id = ANY(p_message_ids)
     AND direcao = 'entrada';

  -- ── Vocabulário fechado (degrada para o neutro em vez de abortar) ──────────────
  v_tipo := coalesce(p_payload->>'tipo', 'ponto_contato');
  IF v_tipo NOT IN ('ponto_contato', 'feedback') THEN
    v_tipo := 'ponto_contato';
  END IF;

  v_resultado := nullif(p_payload->>'resultado', '');
  IF v_resultado IS NOT NULL AND v_resultado NOT IN ('respondeu', 'aceitou', 'recusou') THEN
    v_resultado := NULL;
  END IF;
  -- Sem mensagem do cliente não há resposta do cliente.
  IF v_resultado IS NOT NULL AND v_cliente IS NULL THEN
    v_resultado := NULL;
    v_degradou := 'resultado sem mensagem do cliente';
  END IF;
  -- Resultado preenchido vence feedback: a constraint zeraria o resultado de um feedback.
  IF v_resultado IS NOT NULL THEN
    v_tipo := 'ponto_contato';
  END IF;

  -- Recusa só com as palavras do cliente que a justificam.
  IF v_resultado = 'recusou' THEN
    v_trecho := nullif(btrim(p_payload->>'trecho_recusa'), '');
    IF v_trecho IS NULL OR length(v_trecho) < 3
       OR position(lower(regexp_replace(v_trecho, '\s+', ' ', 'g'))
                   IN lower(regexp_replace(v_cliente, '\s+', ' ', 'g'))) = 0 THEN
      v_resultado := NULL;
      v_trecho := NULL;
      v_degradou := 'recusa sem trecho do cliente';
    END IF;
  END IF;

  v_obs := nullif(btrim(p_payload->>'observacao'), '');
  IF v_trecho IS NOT NULL THEN
    v_citacao := 'Recusa: "' || left(v_trecho, 150) || '"';
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
      (contato_id, data, tipo, canal, sentido, resultado, observacao, gerado_por_ia)
  VALUES
      (p_contato_id, v_data, v_tipo, 'whatsapp', v_sentido, v_resultado, v_obs, true)
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
  'Única porta de escrita do analista na timeline. Trava contato e mensagens, valida o vocabulário (degradando), exige o trecho do cliente para recusou, data a interação pela última mensagem do segmento e devolve o movimento do card.';

-- SECURITY DEFINER exposta no PostgREST: REVOKE explícito (o default concede a anon).
REVOKE EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_analista_registrar_falha(text[], text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_analista_previa(uuid, text, text, public.enum_relacionamento_status) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_analista_registrar_falha(text[], text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_analista_previa(uuid, text, text, public.enum_relacionamento_status) TO service_role;

NOTIFY pgrst, 'reload schema';
