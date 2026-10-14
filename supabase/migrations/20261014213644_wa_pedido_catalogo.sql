-- Pedido do catálogo NATIVO do WhatsApp (`orderMessage`) deixa de virar "[outro]".
--
-- Antes: o ingestor gravava o pedido como tipo_midia='outro' e conteudo=NULL. Título,
-- total e itens ficavam enterrados no payload; o analista lia "[outro]" e nenhum registro
-- de pedido nascia. Ex.: Ana Paula, 14/10 08:27, 3 itens, R$ 90 — passou batido.
--
-- Por que NÃO `wa_pedido`: ela é o rascunho estruturado da secretária (exige produto_id
-- por item, e um 'rascunho' ali dispara o aviso de abandono do W4). O orderMessage traz
-- só o título com os nomes juntos, a contagem e o total — sem produto_id nem quantidade.
--
-- Teste: supabase/tests/wa_pedido_catalogo.sql (transação descartada).

-- ── 1. tipo_midia ganha 'pedido' ─────────────────────────────────────────────────
ALTER TABLE public.mensagens_whatsapp DROP CONSTRAINT mensagens_whatsapp_tipo_midia_check;
ALTER TABLE public.mensagens_whatsapp ADD CONSTRAINT mensagens_whatsapp_tipo_midia_check
  CHECK (tipo_midia = ANY (ARRAY[
    'texto', 'audio', 'imagem', 'video', 'documento', 'sticker',
    'localizacao', 'contato', 'pedido', 'outro'
  ]));

-- ── 2. O registro do pedido pendente ─────────────────────────────────────────────
CREATE TABLE public.wa_pedido_catalogo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Idempotência: o webhook reentregue, o backfill e a reexecução caem no mesmo registro.
  message_id    text NOT NULL UNIQUE REFERENCES public.mensagens_whatsapp(message_id),
  contato_id    uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  telefone_wa   text NOT NULL,
  order_id      text,
  titulo        text,
  itens_qtd     integer CHECK (itens_qtd IS NULL OR itens_qtd >= 0),
  total         numeric(12, 2) CHECK (total IS NULL OR total >= 0),
  moeda         text,
  observacao    text,
  status        text NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente', 'convertido', 'descartado')),
  pedido_em     timestamptz NOT NULL,
  interacao_id  uuid REFERENCES public.interacoes(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wa_pedido_catalogo IS
  'Pedidos montados no catálogo nativo do WhatsApp (orderMessage). Escrita só pela RPC rpc_registrar_pedido_catalogo_wa (ingestor, service_role).';

CREATE INDEX wa_pedido_catalogo_pendentes_idx ON public.wa_pedido_catalogo (pedido_em DESC) WHERE status = 'pendente';
CREATE INDEX wa_pedido_catalogo_contato_idx ON public.wa_pedido_catalogo (contato_id);

ALTER TABLE public.wa_pedido_catalogo ENABLE ROW LEVEL SECURITY;

-- Mesmo desenho de wa_pedido / mensagens_whatsapp: o app lê, quem escreve é o servidor.
CREATE POLICY "Admins podem ler wa_pedido_catalogo"
  ON public.wa_pedido_catalogo FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── 3. A única porta de escrita ──────────────────────────────────────────────────
-- Grava o pedido E a nota na timeline numa transação só. A nota usa o `conteudo` que o
-- normalizador TS já formatou (fonte única do texto) e nasce datada do instante do
-- pedido — não de agora — para a timeline e a cadência do kanban ficarem certas.
-- `resultado='aceitou'` com `sentido='entrada'` move o card para em_negociacao pelo
-- trigger existente (fn_contato_assistido_status): o cliente pediu, falta virar venda.
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

  RETURN v_pedido;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_registrar_pedido_catalogo_wa(text, text, text, integer, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pedido_catalogo_wa(text, text, text, integer, numeric, text, text)
  TO service_role;

-- ── 4. Dados: os pedidos que já entraram como "[outro]" ──────────────────────────
-- Reescreve tipo e conteúdo de TODOS os orderMessage já gravados (14 em 14/10/2026),
-- com o mesmo texto que `descreverPedido` (packages/shared/src/whatsapp.ts) produz.
-- Só texto: não toca processado_em, não cria interação.
WITH pedidos AS (
  SELECT m.id,
         o,
         CASE WHEN jsonb_typeof(o -> 'itemCount') = 'number' THEN (o ->> 'itemCount')::int END AS itens,
         CASE jsonb_typeof(o -> 'totalAmount1000')
           WHEN 'number' THEN (o ->> 'totalAmount1000')::numeric / 1000
           WHEN 'string' THEN CASE WHEN (o ->> 'totalAmount1000') ~ '^\d+$'
                                   THEN (o ->> 'totalAmount1000')::numeric / 1000 END
           WHEN 'object' THEN (
               coalesce((o -> 'totalAmount1000' ->> 'high')::numeric, 0) * 4294967296
             + CASE WHEN (o -> 'totalAmount1000' ->> 'low')::numeric < 0
                    THEN (o -> 'totalAmount1000' ->> 'low')::numeric + 4294967296
                    ELSE (o -> 'totalAmount1000' ->> 'low')::numeric END
           ) / 1000
         END AS total,
         nullif(btrim(o ->> 'orderTitle'), '') AS titulo,
         nullif(btrim(o ->> 'message'), '') AS recado
    FROM public.mensagens_whatsapp m
   CROSS JOIN LATERAL (SELECT m.payload -> 'message' -> 'orderMessage' AS o) x
   WHERE m.payload -> 'message' ? 'orderMessage'
),
textos AS (
  SELECT id, itens, total, titulo, recado,
         concat_ws(', ',
           CASE WHEN itens IS NOT NULL THEN itens || CASE WHEN itens = 1 THEN ' item' ELSE ' itens' END END,
           CASE WHEN total IS NOT NULL
                THEN 'total R$ ' || translate(to_char(total, 'FM999,999,999,990.00'), ',.', '.,') END
         ) AS partes
    FROM pedidos
)
UPDATE public.mensagens_whatsapp m
   SET tipo_midia = 'pedido',
       conteudo = '🛒 Pedido pelo catálogo do WhatsApp'
                  || CASE WHEN t.partes <> '' THEN ' — ' || t.partes ELSE '' END
                  || CASE WHEN t.titulo IS NOT NULL THEN ': ' || t.titulo ELSE '' END
                  || CASE WHEN t.recado IS NOT NULL THEN ' — recado: "' || t.recado || '"' ELSE '' END
  FROM textos t
 WHERE m.id = t.id;

-- Registro + nota só para a janela do backfill (12/10/2026 em diante). Pedidos mais
-- antigos já foram atendidos (e analisados) no fluxo normal; criar "pendente" para eles
-- agora seria mentir sobre o estado e mexer no kanban de quem já foi resolvido.
SELECT public.rpc_registrar_pedido_catalogo_wa(
         m.message_id,
         nullif(btrim(o ->> 'orderId'), ''),
         nullif(btrim(o ->> 'orderTitle'), ''),
         CASE WHEN jsonb_typeof(o -> 'itemCount') = 'number' THEN (o ->> 'itemCount')::int END,
         CASE WHEN jsonb_typeof(o -> 'totalAmount1000') = 'object'
              THEN (coalesce((o -> 'totalAmount1000' ->> 'high')::numeric, 0) * 4294967296
                    + CASE WHEN (o -> 'totalAmount1000' ->> 'low')::numeric < 0
                           THEN (o -> 'totalAmount1000' ->> 'low')::numeric + 4294967296
                           ELSE (o -> 'totalAmount1000' ->> 'low')::numeric END) / 1000
              WHEN jsonb_typeof(o -> 'totalAmount1000') = 'number'
              THEN (o ->> 'totalAmount1000')::numeric / 1000 END,
         nullif(btrim(o ->> 'totalCurrencyCode'), ''),
         nullif(btrim(o ->> 'message'), '')
       )
  FROM public.mensagens_whatsapp m
 CROSS JOIN LATERAL (SELECT m.payload -> 'message' -> 'orderMessage' AS o) x
 WHERE m.payload -> 'message' ? 'orderMessage'
   AND m.direcao = 'entrada'
   AND NOT m.historico
   AND m.contato_id IS NOT NULL
   AND m.enviada_em >= '2026-10-12 00:00:00-03';
