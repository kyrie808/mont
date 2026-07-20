-- D2 — Colunas do kanban derivadas + assistidas.
--
-- (1) ASSISTIDO (event-driven): registrar um ponto de contato passa a MOVER a
--     coluna do card automaticamente — sem depender da UI (vale no kanban, no
--     perfil e em qualquer entrada). Trigger em interacoes:
--       resultado NULL (Aguardando)          → contatado    (Aguardando resposta)
--       respondeu / aceitou / recusou        → em_negociacao (Em conversa)
--     Drag manual (fn_mover) continua sendo override até o próximo evento.
--
-- (2) DERIVADO (temporal, sem cron): a view calcula a coluna EFETIVA. Se o card
--     está em 'contatado' mas o último contato segue Aguardando e já passou a
--     janela (24h) → ele reaparece em 'a_contatar' com selo "ignorou · re-contatar"
--     (reengajar=true). O valor gravado NÃO muda — é só leitura.

-- ── (1) Trigger assistido ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_contato_assistido_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.tipo <> 'ponto_contato' THEN
        RETURN NEW;
    END IF;

    IF NEW.resultado IN ('respondeu', 'aceitou', 'recusou') THEN
        UPDATE public.contatos
        SET status_relacionamento = 'em_negociacao'
        WHERE id = NEW.contato_id
          AND status_relacionamento IS DISTINCT FROM 'em_negociacao'::enum_relacionamento_status;
    ELSIF NEW.resultado IS NULL THEN
        UPDATE public.contatos
        SET status_relacionamento = 'contatado'
        WHERE id = NEW.contato_id
          AND status_relacionamento IS DISTINCT FROM 'contatado'::enum_relacionamento_status;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contato_assistido_status ON public.interacoes;
CREATE TRIGGER trg_contato_assistido_status
AFTER INSERT OR UPDATE OF resultado, tipo, contato_id ON public.interacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_contato_assistido_status();

-- ── (2) View com coluna efetiva derivada ───────────────────────────────────────
-- ⚠️ preservar security_invoker=true (CREATE OR REPLACE reseta). Mantém a lógica
--    de abas (incl. 'leads') e adiciona coluna_efetiva + reengajar.
CREATE OR REPLACE VIEW public.view_relacionamento_kanban
WITH (security_invoker = true) AS
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
            COALESCE(max((configuracoes.valor ->> 'janela_resposta_horas'::text)::integer), 24) AS janela_resposta_horas
        FROM configuracoes
        WHERE configuracoes.chave = 'relacionamento'::text
    ), ultimo_contato AS (
        SELECT DISTINCT ON (i.contato_id) i.contato_id, i.data AS ultimo_contato_data, i.resultado AS ultimo_contato_resultado
        FROM interacoes i
        WHERE i.tipo = 'ponto_contato'::text
        ORDER BY i.contato_id, i.data DESC
    ), metricas AS (
        SELECT cp.contato_id, cp.total_pedidos, cp.primeira_compra, cp.ultima_compra,
            CURRENT_DATE - cp.ultima_compra AS dias_sem_compra,
            CASE WHEN cp.total_pedidos >= 2 THEN (cp.ultima_compra - cp.primeira_compra)::numeric / (cp.total_pedidos - 1)::numeric ELSE NULL::numeric END AS intervalo_medio,
            CASE WHEN cp.total_pedidos >= 2 THEN cp.ultima_compra + (cp.ultima_compra - cp.primeira_compra) / (cp.total_pedidos - 1) ELSE NULL::date END AS proxima_esperada
        FROM compras cp
    )
    SELECT c.id AS contato_id, c.nome, c.telefone, c.status_relacionamento, c.arquivado_em,
        CASE
            WHEN COALESCE(fa.tem_fiado_aberto, false) THEN 'cobranca'::enum_relacionamento_aba
            WHEN COALESCE(m.total_pedidos, 0) = 0 THEN 'leads'::enum_relacionamento_aba
            WHEN COALESCE(m.total_pedidos, 0) = 1 AND m.dias_sem_compra >= cfg.limiar_reativacao THEN 'reativacao'::enum_relacionamento_aba
            ELSE 'recompra'::enum_relacionamento_aba
        END AS aba_atual,
        COALESCE(m.total_pedidos, 0) AS total_pedidos,
        m.primeira_compra, m.ultima_compra, m.dias_sem_compra, m.intervalo_medio, m.proxima_esperada,
        CASE WHEN m.proxima_esperada IS NOT NULL THEN CURRENT_DATE - m.proxima_esperada ELSE NULL::integer END AS atraso,
        CASE WHEN m.proxima_esperada IS NOT NULL AND (CURRENT_DATE - m.proxima_esperada)::numeric >= round(m.intervalo_medio * cfg.multiplicador_sumido) THEN true ELSE false END AS sumido,
        CASE WHEN COALESCE(m.total_pedidos, 0) = 1 AND m.dias_sem_compra < cfg.limiar_reativacao THEN true ELSE false END AS balde_cheio,
        -- ⬇️ colunas novas ANEXADAS no fim (CREATE OR REPLACE VIEW não permite inserir no meio)
        -- coluna efetiva: 'contatado' que estourou a janela sem retorno reaparece em 'a_contatar'
        CASE
            WHEN c.status_relacionamento = 'contatado'::enum_relacionamento_status
                 AND uc.ultimo_contato_resultado IS NULL
                 AND uc.ultimo_contato_data IS NOT NULL
                 AND uc.ultimo_contato_data < now() - make_interval(hours => cfg.janela_resposta_horas)
            THEN 'a_contatar'::enum_relacionamento_status
            ELSE COALESCE(c.status_relacionamento, 'a_contatar'::enum_relacionamento_status)
        END AS coluna_efetiva,
        CASE
            WHEN c.status_relacionamento = 'contatado'::enum_relacionamento_status
                 AND uc.ultimo_contato_resultado IS NULL
                 AND uc.ultimo_contato_data IS NOT NULL
                 AND uc.ultimo_contato_data < now() - make_interval(hours => cfg.janela_resposta_horas)
            THEN true ELSE false
        END AS reengajar
    FROM contatos c
        CROSS JOIN cfg
        LEFT JOIN metricas m ON m.contato_id = c.id
        LEFT JOIN fiado_aberto fa ON fa.contato_id = c.id
        LEFT JOIN ultimo_contato uc ON uc.contato_id = c.id
    WHERE c.arquivado_em IS NULL;
