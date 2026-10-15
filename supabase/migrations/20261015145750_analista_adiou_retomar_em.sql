-- E4, correções da rodada de teste (15/10/2026). Decisões do Luccas:
--
--   1. Resultado novo `adiou` ("agora não", "semana que vem", "estou viajando"). Adiar não
--      é recusar nem é conversa andando: o card fica onde está (só a_contatar → contatado),
--      o adiamento CONTA como tentativa e NÃO zera a cadência — o follow_up aparece.
--   2. `retomar_em`: quando o cliente dá prazo ("amanhã", "fim de semana"), o follow_up
--      aparece NESSE dia, não pela cadência. Sem prazo, vale a cadência.
--   3. Nota da IA não fala em recusa quando o resultado não é recusou (a RPC barra).
--   4. orderMessage já registrado pela E1 sai da fila do analista: a nota do pedido já
--      está na timeline; o resto da conversa segue sendo analisado.
--
-- Teste: supabase/tests/analista_adiou.sql (transação descartada).

-- ── 1. Vocabulário: adiou + retomar_em ──────────────────────────────────────────

ALTER TABLE public.interacoes ADD COLUMN IF NOT EXISTS retomar_em date;

COMMENT ON COLUMN public.interacoes.retomar_em IS
  'Só em ponto_contato com resultado adiou: o dia em que o cliente pediu para ser procurado de novo. O card aparece em follow_up nesse dia (view_relacionamento_kanban).';

ALTER TABLE public.interacoes DROP CONSTRAINT interacoes_vocabulario_check;
ALTER TABLE public.interacoes ADD CONSTRAINT interacoes_vocabulario_check CHECK (
  tipo IS NOT NULL
  AND tipo = ANY (ARRAY['ponto_contato', 'feedback', 'movimentacao_kanban'])
  AND (canal IS NULL OR canal = ANY (ARRAY['whatsapp', 'sistema', 'instagram', 'google', 'outro']))
  AND CASE tipo
        WHEN 'ponto_contato' THEN resultado IS NULL OR resultado = ANY (ARRAY['respondeu', 'aceitou', 'recusou', 'adiou'])
        WHEN 'feedback' THEN resultado IS NULL
        WHEN 'movimentacao_kanban' THEN resultado IS NULL OR resultado = ANY (ARRAY[
          'a_contatar', 'contatado', 'em_negociacao', 'resolvido', 'follow_up', 'sem_retorno', 'recusou'])
        ELSE NULL::boolean
      END
);

ALTER TABLE public.interacoes ADD CONSTRAINT interacoes_retomar_em_check
  CHECK (retomar_em IS NULL OR (tipo = 'ponto_contato' AND resultado = 'adiou'));

-- ── 2. View: adiamento na cadência ───────────────────────────────────────────────
-- Mudanças, só nos CTEs da cadência e numa linha da coluna:
--   • respostas: `adiou` não zera a contagem;
--   • saidas: `adiou` conta como tentativa, e guarda o retomar_em da ÚLTIMA tentativa;
--   • cadencia: com retomar_em, o prazo é a meia-noite (Brasília) desse dia;
--   • coluna: em_negociacao com adiamento datado vencido também aparece em follow_up
--     (sem isso o prazo do cliente que já estava conversando não lembraria ninguém).
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
          WHERE i.tipo = 'ponto_contato'::text
                AND i.resultado IS DISTINCT FROM 'adiou'::text
                AND (i.sentido = 'entrada'::text OR (i.resultado = ANY (ARRAY['respondeu'::text, 'aceitou'::text, 'recusou'::text])))
             OR i.tipo = 'movimentacao_kanban'::text
          GROUP BY i.contato_id
        ), saidas AS (
         SELECT i.contato_id,
            count(*) FILTER (WHERE r.reset_at IS NULL OR i.data > r.reset_at) AS tentativas,
            max(i.data) FILTER (WHERE r.reset_at IS NULL OR i.data > r.reset_at) AS ultimo_saida,
            (array_agg(i.retomar_em ORDER BY i.data DESC) FILTER (WHERE r.reset_at IS NULL OR i.data > r.reset_at))[1] AS retomar_em
           FROM interacoes i
             LEFT JOIN respostas r ON r.contato_id = i.contato_id
          WHERE i.tipo = 'ponto_contato'::text
            AND ((i.sentido = 'saida'::text AND i.resultado IS NULL) OR i.resultado = 'adiou'::text)
          GROUP BY i.contato_id
        ), cadencia AS (
         SELECT s.contato_id,
            s.tentativas,
            s.ultimo_saida,
            s.retomar_em,
                CASE
                    WHEN s.retomar_em IS NOT NULL THEN (s.retomar_em::timestamp without time zone AT TIME ZONE 'America/Sao_Paulo'::text)
                    WHEN s.tentativas = 1 THEN s.ultimo_saida + '00:30:00'::interval
                    WHEN s.tentativas = 2 THEN s.ultimo_saida + '04:00:00'::interval
                    WHEN s.tentativas = 3 THEN ((date_trunc('day'::text, (s.ultimo_saida AT TIME ZONE 'America/Sao_Paulo'::text)) + '1 day 09:00:00'::interval) AT TIME ZONE 'America/Sao_Paulo'::text)
                    WHEN s.tentativas = 4 THEN s.ultimo_saida + '3 days'::interval
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
            -- Novo: o cliente que já conversava e pediu "me chama no sábado".
            WHEN c.status_relacionamento = 'em_negociacao'::enum_relacionamento_status AND cad.retomar_em IS NOT NULL AND now() >= cad.prazo THEN 'follow_up'::enum_relacionamento_status
            WHEN c.status_relacionamento = 'recusou'::enum_relacionamento_status AND rec.recusa_at IS NOT NULL AND now() < (rec.recusa_at + make_interval(days => cfg.cooldown_recusa_dias)) THEN 'recusou'::enum_relacionamento_status
            WHEN c.status_relacionamento = 'recusou'::enum_relacionamento_status THEN 'a_contatar'::enum_relacionamento_status
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

-- ── 3. Trava da IA: adiou ────────────────────────────────────────────────────────

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
$$;

-- ── 4. rpc_registrar_interacao_ia: adiou, retomar_em, nota sem "recusa" ──────────

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

  -- Cliente que só mandou áudio também respondeu: conta a mensagem, não o texto.
  SELECT count(*) > 0, string_agg(conteudo, ' ' ORDER BY enviada_em)
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

  -- Recusa só com as palavras do cliente que a justificam.
  IF v_resultado = 'recusou' THEN
    v_trecho := nullif(btrim(p_payload->>'trecho_recusa'), '');
    IF v_trecho IS NULL OR length(v_trecho) < 3
       OR position(lower(regexp_replace(v_trecho, '\s+', ' ', 'g'))
                   IN lower(regexp_replace(coalesce(v_cliente, ''), '\s+', ' ', 'g'))) = 0 THEN
      v_resultado := NULL;
      v_trecho := NULL;
      v_degradou := 'recusa sem trecho do cliente';
    END IF;
  END IF;

  -- Retomada: só no adiamento, depois do dia da conversa (Brasília) e até 60 dias.
  IF v_resultado = 'adiou' AND nullif(btrim(p_payload->>'retomar_em'), '') IS NOT NULL THEN
    v_dia := (v_data AT TIME ZONE 'America/Sao_Paulo')::date;
    BEGIN
      v_retomar := (p_payload->>'retomar_em')::date;
    EXCEPTION WHEN others THEN
      v_retomar := NULL;
    END;
    IF v_retomar IS NULL OR v_retomar <= v_dia OR v_retomar > v_dia + 60 THEN
      v_retomar := NULL;
      v_degradou := 'retomar_em fora da janela; vale a cadência';
    END IF;
  END IF;

  v_obs := nullif(btrim(p_payload->>'observacao'), '');
  -- A palavra vale mais que o rótulo para quem lê: nota que fala em recusa só com recusou.
  IF v_resultado IS DISTINCT FROM 'recusou' AND v_obs ~* 'recus' THEN
    RAISE EXCEPTION 'observacao fala em recusa, mas o resultado é %', coalesce(v_resultado, 'nenhum')
      USING ERRCODE = 'check_violation';
  END IF;
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
    'degradou', v_degradou,
    'aba', v_aba,
    'status_antes', v_status_antes,
    'status_depois', v_status_depois,
    'coluna_antes', v_coluna_antes,
    'coluna_depois', v_coluna_depois
  );
END;
$$;

-- CREATE OR REPLACE mantém os grants da E4 (só service_role); reafirmados por clareza.
REVOKE EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_interacao_ia(uuid, jsonb, text[]) TO service_role;

-- ── 5. orderMessage registrado pela E1 sai da fila do analista ───────────────────
-- A nota do pedido já está na timeline. Sem isto o analista escrevia uma segunda nota
-- sobre o mesmo pedido (Ana Paula, 14/10 08:27). Só a mensagem do pedido sai; o resto
-- da conversa continua na fila e é analisado normalmente.

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

  -- A nota acima já é o registro desta mensagem: o analista não a lê de novo.
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

-- Dados: os pedidos que a E1 já registrou com nota (2 em 15/10/2026) saem da fila.
UPDATE public.mensagens_whatsapp m
   SET processado_em = now()
  FROM public.wa_pedido_catalogo p
 WHERE p.message_id = m.message_id
   AND p.interacao_id IS NOT NULL
   AND m.processado_em IS NULL
   AND NOT m.historico;

NOTIFY pgrst, 'reload schema';
