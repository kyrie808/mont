-- D4 cadência de follow-up (parte 2/2): direção do contato + trigger + view escalonada.
--
-- Registro vira conversa: interacoes.sentido = 'saida' (eu contatei / follow-up) ou
-- 'entrada' (cliente respondeu). A cadência (playbook do diretor) é DERIVADA na view,
-- sem cron: inicial → +30min → +4h → próxima manhã(~9h SP) → +3 dias → Sem retorno.

-- 1) Direção do beat.
ALTER TABLE public.interacoes
    ADD COLUMN IF NOT EXISTS sentido text NOT NULL DEFAULT 'saida'
    CHECK (sentido IN ('saida', 'entrada'));

-- 2) Trigger assistido por sentido (com compat: saida marcada 'respondeu' no modelo
--    antigo ainda conta como resposta enquanto a UI nova não está no ar).
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

    IF NEW.sentido = 'entrada' OR NEW.resultado IN ('respondeu', 'aceitou', 'recusou') THEN
        -- cliente respondeu → conversa
        UPDATE public.contatos
        SET status_relacionamento = 'em_negociacao'
        WHERE id = NEW.contato_id
          AND status_relacionamento IS DISTINCT FROM 'em_negociacao'::enum_relacionamento_status;
    ELSE
        -- eu contatei (saida sem resposta) → aguardando
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
AFTER INSERT OR UPDATE OF resultado, tipo, contato_id, sentido ON public.interacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_contato_assistido_status();

-- 3) View com cadência escalonada derivada. Recriada (DROP+CREATE) para limpar a
--    coluna 'reengajar' do D2 (substituída pela cadência) e expor 'tentativas'.
--    ⚠️ security_invoker=true.
DROP VIEW IF EXISTS public.view_relacionamento_kanban;
CREATE VIEW public.view_relacionamento_kanban
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
            COALESCE(max((configuracoes.valor ->> 'multiplicador_sumido'::text)::numeric), 1.5) AS multiplicador_sumido
        FROM configuracoes
        WHERE configuracoes.chave = 'relacionamento'::text
    ), respostas AS (
        -- eventos que "resetam" a cadência: resposta do cliente (entrada, ou saida
        -- marcada respondeu no modelo antigo) OU qualquer movimentação manual do kanban.
        SELECT i.contato_id, max(i.data) AS reset_at
        FROM interacoes i
        WHERE (i.tipo = 'ponto_contato'::text AND (i.sentido = 'entrada'::text OR i.resultado IN ('respondeu','aceitou','recusou')))
           OR i.tipo = 'movimentacao_kanban'::text
        GROUP BY i.contato_id
    ), saidas AS (
        -- tentativas não respondidas desde o último reset.
        SELECT i.contato_id,
            count(*) FILTER (WHERE r.reset_at IS NULL OR i.data > r.reset_at) AS tentativas,
            max(i.data) FILTER (WHERE r.reset_at IS NULL OR i.data > r.reset_at) AS ultimo_saida
        FROM interacoes i
        LEFT JOIN respostas r ON r.contato_id = i.contato_id
        WHERE i.tipo = 'ponto_contato'::text AND i.sentido = 'saida'::text AND i.resultado IS NULL
        GROUP BY i.contato_id
    ), cadencia AS (
        -- prazo do próximo toque (playbook fixo). Passo pela contagem de tentativas.
        SELECT s.contato_id, s.tentativas, s.ultimo_saida,
            CASE s.tentativas
                WHEN 1 THEN s.ultimo_saida + interval '30 minutes'
                WHEN 2 THEN s.ultimo_saida + interval '4 hours'
                WHEN 3 THEN (date_trunc('day', s.ultimo_saida AT TIME ZONE 'America/Sao_Paulo') + interval '1 day 9 hours') AT TIME ZONE 'America/Sao_Paulo'
                WHEN 4 THEN s.ultimo_saida + interval '3 days'
                ELSE NULL::timestamptz
            END AS prazo
        FROM saidas s
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
        -- cadência de follow-up (derivada, sem cron)
        COALESCE(cad.tentativas, 0)::integer AS tentativas,
        CASE
            WHEN c.status_relacionamento = 'contatado'::enum_relacionamento_status AND COALESCE(cad.tentativas, 0) >= 5
                THEN 'sem_retorno'::enum_relacionamento_status
            WHEN c.status_relacionamento = 'contatado'::enum_relacionamento_status AND cad.prazo IS NOT NULL AND now() >= cad.prazo
                THEN 'follow_up'::enum_relacionamento_status
            ELSE COALESCE(c.status_relacionamento, 'a_contatar'::enum_relacionamento_status)
        END AS coluna_efetiva
    FROM contatos c
        CROSS JOIN cfg
        LEFT JOIN metricas m ON m.contato_id = c.id
        LEFT JOIN fiado_aberto fa ON fa.contato_id = c.id
        LEFT JOIN cadencia cad ON cad.contato_id = c.id
    WHERE c.arquivado_em IS NULL;
