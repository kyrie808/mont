-- D4.4 coluna "Recusou" com cooldown (parte 2/2): trigger + config + view.
--
-- Recusa vira QUARENTENA: o card vai pra coluna 'recusou' e descansa
-- cooldown_recusa_dias (default 30) antes de voltar pra 'a_contatar' (reofertar).
-- Tudo derivado na view, sem cron. A recusa fica registrada em interacoes.resultado.

-- 1) Trigger: recusou tem destino próprio (antes caía em em_negociacao).
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

    IF NEW.resultado = 'recusou' THEN
        -- cliente recusou → quarentena (cooldown derivado na view)
        UPDATE public.contatos
        SET status_relacionamento = 'recusou'
        WHERE id = NEW.contato_id
          AND status_relacionamento IS DISTINCT FROM 'recusou'::enum_relacionamento_status;
    ELSIF NEW.sentido = 'entrada' OR NEW.resultado IN ('respondeu', 'aceitou') THEN
        -- cliente respondeu (positivo/neutro) → conversa
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

-- 2) Cooldown configurável (default 30 dias) no config do relacionamento.
UPDATE public.configuracoes
SET valor = valor || jsonb_build_object('cooldown_recusa_dias', 30)
WHERE chave = 'relacionamento'
  AND NOT (valor ? 'cooldown_recusa_dias');

-- 3) View: cooldown de recusa derivado. CREATE OR REPLACE (coluna_efetiva mantém
--    nome/tipo/posição; recusa_dias_restantes anexada no fim). ⚠️ security_invoker.
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
            COALESCE(max((configuracoes.valor ->> 'cooldown_recusa_dias'::text)::integer), 30) AS cooldown_recusa_dias
        FROM configuracoes
        WHERE configuracoes.chave = 'relacionamento'::text
    ), respostas AS (
        SELECT i.contato_id, max(i.data) AS reset_at
        FROM interacoes i
        WHERE (i.tipo = 'ponto_contato'::text AND (i.sentido = 'entrada'::text OR i.resultado IN ('respondeu','aceitou','recusou')))
           OR i.tipo = 'movimentacao_kanban'::text
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
        SELECT s.contato_id, s.tentativas, s.ultimo_saida,
            CASE s.tentativas
                WHEN 1 THEN s.ultimo_saida + interval '30 minutes'
                WHEN 2 THEN s.ultimo_saida + interval '4 hours'
                WHEN 3 THEN (date_trunc('day', s.ultimo_saida AT TIME ZONE 'America/Sao_Paulo') + interval '1 day 9 hours') AT TIME ZONE 'America/Sao_Paulo'
                WHEN 4 THEN s.ultimo_saida + interval '3 days'
                ELSE NULL::timestamptz
            END AS prazo
        FROM saidas s
    ), recusas AS (
        -- data da última recusa (base do cooldown). Só relevante quando status='recusou'.
        SELECT i.contato_id, max(i.data) AS recusa_at
        FROM interacoes i
        WHERE i.tipo = 'ponto_contato'::text AND i.resultado = 'recusou'::text
        GROUP BY i.contato_id
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
        COALESCE(cad.tentativas, 0)::integer AS tentativas,
        CASE
            WHEN c.status_relacionamento = 'contatado'::enum_relacionamento_status AND COALESCE(cad.tentativas, 0) >= 5
                THEN 'sem_retorno'::enum_relacionamento_status
            WHEN c.status_relacionamento = 'contatado'::enum_relacionamento_status AND cad.prazo IS NOT NULL AND now() >= cad.prazo
                THEN 'follow_up'::enum_relacionamento_status
            -- recusa em quarentena → coluna 'recusou'; cooldown expirado → volta pra fila
            WHEN c.status_relacionamento = 'recusou'::enum_relacionamento_status
                 AND rec.recusa_at IS NOT NULL
                 AND now() < rec.recusa_at + make_interval(days => cfg.cooldown_recusa_dias)
                THEN 'recusou'::enum_relacionamento_status
            WHEN c.status_relacionamento = 'recusou'::enum_relacionamento_status
                THEN 'a_contatar'::enum_relacionamento_status
            ELSE COALESCE(c.status_relacionamento, 'a_contatar'::enum_relacionamento_status)
        END AS coluna_efetiva,
        CASE
            WHEN c.status_relacionamento = 'recusou'::enum_relacionamento_status AND rec.recusa_at IS NOT NULL
                THEN GREATEST(0, ceil(EXTRACT(epoch FROM (rec.recusa_at + make_interval(days => cfg.cooldown_recusa_dias) - now())) / 86400.0))::integer
            ELSE NULL::integer
        END AS recusa_dias_restantes
    FROM contatos c
        CROSS JOIN cfg
        LEFT JOIN metricas m ON m.contato_id = c.id
        LEFT JOIN fiado_aberto fa ON fa.contato_id = c.id
        LEFT JOIN cadencia cad ON cad.contato_id = c.id
        LEFT JOIN recusas rec ON rec.contato_id = c.id
    WHERE c.arquivado_em IS NULL;
