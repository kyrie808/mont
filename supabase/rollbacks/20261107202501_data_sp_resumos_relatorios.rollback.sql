-- Rollback de 20261107202501_data_sp_resumos_relatorios: volta as definições de antes (CURRENT_DATE)
-- e remove as funções novas. Antes, voltar o app para a versão que não chama os resumos novos.

drop function if exists public.rpc_ranking_compras_resumo(integer, integer);
drop function if exists public.rpt_ltv_por_origem_periodo(date, date);
drop function if exists public.rpt_ltv_resumo_periodo(date, date);

create or replace view public.view_relacionamento_kanban
with (security_invoker = true) as
WITH compras AS (
         SELECT v.contato_id,
            (count(DISTINCT v.data))::integer AS total_pedidos,
            min(v.data) AS primeira_compra,
            max(v.data) AS ultima_compra
           FROM vendas v
          WHERE ((v.status = 'entregue'::text) AND (v.forma_pagamento <> 'brinde'::text))
          GROUP BY v.contato_id
        ), fiado_aberto AS (
         SELECT v.contato_id,
            bool_or(((v.status = 'entregue'::text) AND (v.forma_pagamento = 'fiado'::text) AND (v.pago = false))) AS tem_fiado_aberto
           FROM vendas v
          GROUP BY v.contato_id
        ), cfg AS (
         SELECT COALESCE(max(((configuracoes.valor ->> 'limiar_reativacao'::text))::integer), 30) AS limiar_reativacao,
            COALESCE(max(((configuracoes.valor ->> 'multiplicador_sumido'::text))::numeric), 1.5) AS multiplicador_sumido,
            COALESCE(max(((configuracoes.valor ->> 'cooldown_recusa_dias'::text))::integer), 30) AS cooldown_recusa_dias
           FROM configuracoes
          WHERE (configuracoes.chave = 'relacionamento'::text)
        ), respostas AS (
         SELECT i.contato_id,
            max(i.data) AS reset_at
           FROM interacoes i
          WHERE (((i.tipo = 'ponto_contato'::text) AND (i.resultado IS DISTINCT FROM 'adiou'::text) AND ((i.sentido = 'entrada'::text) OR (i.resultado = ANY (ARRAY['respondeu'::text, 'aceitou'::text, 'recusou'::text])))) OR (i.tipo = 'movimentacao_kanban'::text))
          GROUP BY i.contato_id
        ), saidas AS (
         SELECT i.contato_id,
            count(*) FILTER (WHERE ((r.reset_at IS NULL) OR (i.data > r.reset_at))) AS tentativas,
            max(i.data) FILTER (WHERE ((r.reset_at IS NULL) OR (i.data > r.reset_at))) AS ultimo_saida,
            (array_agg(i.retomar_em ORDER BY i.data DESC) FILTER (WHERE ((r.reset_at IS NULL) OR (i.data > r.reset_at))))[1] AS retomar_em
           FROM (interacoes i
             LEFT JOIN respostas r ON ((r.contato_id = i.contato_id)))
          WHERE ((i.tipo = 'ponto_contato'::text) AND (((i.sentido = 'saida'::text) AND (i.resultado IS NULL)) OR (i.resultado = 'adiou'::text)))
          GROUP BY i.contato_id
        ), cadencia AS (
         SELECT s.contato_id,
            s.tentativas,
            s.ultimo_saida,
            s.retomar_em,
                CASE
                    WHEN (s.retomar_em IS NOT NULL) THEN ((s.retomar_em)::timestamp without time zone AT TIME ZONE 'America/Sao_Paulo'::text)
                    WHEN (s.tentativas = 1) THEN (s.ultimo_saida + '00:30:00'::interval)
                    WHEN (s.tentativas = 2) THEN (s.ultimo_saida + '04:00:00'::interval)
                    WHEN (s.tentativas = 3) THEN ((date_trunc('day'::text, (s.ultimo_saida AT TIME ZONE 'America/Sao_Paulo'::text)) + '1 day 09:00:00'::interval) AT TIME ZONE 'America/Sao_Paulo'::text)
                    WHEN (s.tentativas = 4) THEN (s.ultimo_saida + '3 days'::interval)
                    ELSE NULL::timestamp with time zone
                END AS prazo
           FROM saidas s
        ), recusas AS (
         SELECT i.contato_id,
            max(i.data) AS recusa_at
           FROM interacoes i
          WHERE ((i.tipo = 'ponto_contato'::text) AND (i.resultado = 'recusou'::text))
          GROUP BY i.contato_id
        ), metricas AS (
         SELECT cp.contato_id,
            cp.total_pedidos,
            cp.primeira_compra,
            cp.ultima_compra,
            (CURRENT_DATE - cp.ultima_compra) AS dias_sem_compra,
                CASE
                    WHEN (cp.total_pedidos >= 2) THEN (((cp.ultima_compra - cp.primeira_compra))::numeric / ((cp.total_pedidos - 1))::numeric)
                    ELSE NULL::numeric
                END AS intervalo_medio,
                CASE
                    WHEN (cp.total_pedidos >= 2) THEN (cp.ultima_compra + ((cp.ultima_compra - cp.primeira_compra) / (cp.total_pedidos - 1)))
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
            WHEN (m.proxima_esperada IS NOT NULL) THEN (CURRENT_DATE - m.proxima_esperada)
            ELSE NULL::integer
        END AS atraso,
        CASE
            WHEN ((m.proxima_esperada IS NOT NULL) AND (((CURRENT_DATE - m.proxima_esperada))::numeric >= round((m.intervalo_medio * cfg.multiplicador_sumido)))) THEN true
            ELSE false
        END AS sumido,
        CASE
            WHEN ((COALESCE(m.total_pedidos, 0) = 1) AND (m.dias_sem_compra < cfg.limiar_reativacao)) THEN true
            ELSE false
        END AS balde_cheio,
    (COALESCE(cad.tentativas, (0)::bigint))::integer AS tentativas,
        CASE
            WHEN ((c.status_relacionamento = 'contatado'::enum_relacionamento_status) AND (COALESCE(cad.tentativas, (0)::bigint) >= 5)) THEN 'sem_retorno'::enum_relacionamento_status
            WHEN ((c.status_relacionamento = 'contatado'::enum_relacionamento_status) AND (cad.prazo IS NOT NULL) AND (now() >= cad.prazo)) THEN 'follow_up'::enum_relacionamento_status
            WHEN ((c.status_relacionamento = 'em_negociacao'::enum_relacionamento_status) AND (cad.retomar_em IS NOT NULL) AND (now() >= cad.prazo)) THEN 'follow_up'::enum_relacionamento_status
            WHEN ((c.status_relacionamento = 'recusou'::enum_relacionamento_status) AND (rec.recusa_at IS NOT NULL) AND (now() < (rec.recusa_at + make_interval(days => cfg.cooldown_recusa_dias)))) THEN 'recusou'::enum_relacionamento_status
            WHEN (c.status_relacionamento = 'recusou'::enum_relacionamento_status) THEN 'a_contatar'::enum_relacionamento_status
            WHEN ((c.status_relacionamento = 'resolvido'::enum_relacionamento_status) AND fn_relacionamento_reaberto(ab.aba,
            CASE
                WHEN (m.proxima_esperada IS NOT NULL) THEN (CURRENT_DATE - m.proxima_esperada)
                ELSE NULL::integer
            END)) THEN 'a_contatar'::enum_relacionamento_status
            ELSE COALESCE(c.status_relacionamento, 'a_contatar'::enum_relacionamento_status)
        END AS coluna_efetiva,
        CASE
            WHEN ((c.status_relacionamento = 'recusou'::enum_relacionamento_status) AND (rec.recusa_at IS NOT NULL)) THEN (GREATEST((0)::numeric, ceil((EXTRACT(epoch FROM ((rec.recusa_at + make_interval(days => cfg.cooldown_recusa_dias)) - now())) / 86400.0))))::integer
            ELSE NULL::integer
        END AS recusa_dias_restantes
   FROM ((((((contatos c
     CROSS JOIN cfg)
     LEFT JOIN metricas m ON ((m.contato_id = c.id)))
     LEFT JOIN fiado_aberto fa ON ((fa.contato_id = c.id)))
     LEFT JOIN cadencia cad ON ((cad.contato_id = c.id)))
     LEFT JOIN recusas rec ON ((rec.contato_id = c.id)))
     CROSS JOIN LATERAL ( SELECT
                CASE
                    WHEN COALESCE(fa.tem_fiado_aberto, false) THEN 'cobranca'::enum_relacionamento_aba
                    WHEN (COALESCE(m.total_pedidos, 0) = 0) THEN 'leads'::enum_relacionamento_aba
                    WHEN ((COALESCE(m.total_pedidos, 0) = 1) AND (m.dias_sem_compra >= cfg.limiar_reativacao)) THEN 'reativacao'::enum_relacionamento_aba
                    ELSE 'recompra'::enum_relacionamento_aba
                END AS aba) ab)
  WHERE (c.arquivado_em IS NULL);

create or replace view public.rpt_ltv_por_cliente
with (security_invoker = true) as
WITH cfg AS (
         SELECT COALESCE(max(((configuracoes.valor ->> 'limiar_reativacao'::text))::integer), 30) AS limiar_reativacao,
            COALESCE(max(((configuracoes.valor ->> 'multiplicador_sumido'::text))::numeric), 1.5) AS multiplicador_sumido
           FROM configuracoes
          WHERE (configuracoes.chave = 'relacionamento'::text)
        ), base AS (
         SELECT c.id AS contato_id,
            c.nome,
            c.telefone,
            c.tipo,
            c.status,
            count(DISTINCT v.data) AS total_pedidos,
            sum(v.total) AS ltv_total,
            round((sum(v.total) / (NULLIF(count(DISTINCT v.data), 0))::numeric), 2) AS ticket_medio,
            min(v.data) AS primeira_compra,
            max(v.data) AS ultima_compra,
            (max(v.data) - min(v.data)) AS dias_relacionamento
           FROM (contatos c
             JOIN vendas v ON ((v.contato_id = c.id)))
          WHERE ((v.status <> 'cancelada'::text) AND (v.forma_pagamento <> 'brinde'::text))
          GROUP BY c.id, c.nome, c.telefone, c.tipo, c.status
        ), ritmo AS (
         SELECT b.contato_id,
            b.nome,
            b.telefone,
            b.tipo,
            b.status,
            b.total_pedidos,
            b.ltv_total,
            b.ticket_medio,
            b.primeira_compra,
            b.ultima_compra,
            b.dias_relacionamento,
            (CURRENT_DATE - b.ultima_compra) AS dias_sem_compra,
                CASE
                    WHEN (b.total_pedidos >= 2) THEN (((b.ultima_compra - b.primeira_compra))::numeric / ((b.total_pedidos - 1))::numeric)
                    ELSE NULL::numeric
                END AS intervalo_medio,
                CASE
                    WHEN (b.total_pedidos >= 2) THEN (CURRENT_DATE - (b.ultima_compra + (((b.ultima_compra - b.primeira_compra) / (b.total_pedidos - 1)))::integer))
                    ELSE NULL::integer
                END AS atraso
           FROM base b
        )
 SELECT r.contato_id,
    r.nome,
    r.telefone,
    r.tipo,
    r.status,
    r.total_pedidos,
    r.ltv_total,
    r.ticket_medio,
    r.primeira_compra,
    r.ultima_compra,
    r.dias_relacionamento,
        CASE
            WHEN (r.total_pedidos >= 2) THEN
            CASE
                WHEN (r.atraso < 0) THEN 'ativo'::text
                WHEN ((r.atraso)::numeric < round((r.intervalo_medio * cfg.multiplicador_sumido))) THEN 'risco'::text
                ELSE 'adormecido'::text
            END
            ELSE
            CASE
                WHEN (r.dias_sem_compra < cfg.limiar_reativacao) THEN 'ativo'::text
                WHEN ((r.dias_sem_compra)::numeric < round(((cfg.limiar_reativacao)::numeric * cfg.multiplicador_sumido))) THEN 'risco'::text
                ELSE 'adormecido'::text
            END
        END AS status_atividade
   FROM (ritmo r
     CROSS JOIN cfg)
  ORDER BY r.ltv_total DESC;

CREATE OR REPLACE FUNCTION public.rpt_ltv_por_cliente_periodo(p_desde date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS TABLE(contato_id uuid, nome text, telefone text, tipo text, status text, total_pedidos bigint, ltv_total numeric, ticket_medio numeric, primeira_compra date, ultima_compra date, dias_relacionamento integer, status_atividade text, origem text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    WITH cfg AS (
        SELECT COALESCE(max((valor ->> 'limiar_reativacao')::integer), 30) AS limiar_reativacao,
               COALESCE(max((valor ->> 'multiplicador_sumido')::numeric), 1.5) AS multiplicador_sumido
        FROM configuracoes WHERE chave = 'relacionamento'
    ), base AS (
        SELECT c.id AS contato_id, c.nome, c.telefone, c.tipo, c.status, c.origem,
            count(DISTINCT v.data) AS total_pedidos,
            sum(v.total - COALESCE(v.taxa_entrega, 0)) AS ltv_total,
            round(sum(v.total - COALESCE(v.taxa_entrega, 0)) / NULLIF(count(DISTINCT v.data), 0)::numeric, 2) AS ticket_medio,
            min(v.data) AS primeira_compra, max(v.data) AS ultima_compra,
            (max(v.data) - min(v.data)) AS dias_relacionamento
        FROM contatos c
        JOIN vendas v ON v.contato_id = c.id
        WHERE v.status = 'entregue' AND v.forma_pagamento <> 'brinde'
          AND (p_desde IS NULL OR v.data >= p_desde)
          AND (p_ate IS NULL OR v.data <= p_ate)
        GROUP BY c.id, c.nome, c.telefone, c.tipo, c.status, c.origem
    ), ritmo AS (
        SELECT b.*,
            (CURRENT_DATE - b.ultima_compra) AS dias_sem_compra,
            CASE WHEN b.total_pedidos >= 2
                 THEN (b.ultima_compra - b.primeira_compra)::numeric / (b.total_pedidos - 1)::numeric
                 ELSE NULL END AS intervalo_medio,
            CASE WHEN b.total_pedidos >= 2
                 THEN CURRENT_DATE - (b.ultima_compra + ((b.ultima_compra - b.primeira_compra) / (b.total_pedidos - 1))::integer)
                 ELSE NULL END AS atraso
        FROM base b
    )
    SELECT r.contato_id, r.nome, r.telefone, r.tipo, r.status,
        r.total_pedidos, r.ltv_total, r.ticket_medio,
        r.primeira_compra, r.ultima_compra, r.dias_relacionamento,
        CASE WHEN r.total_pedidos >= 2 THEN
                CASE WHEN r.atraso < 0 THEN 'ativo'
                     WHEN r.atraso::numeric < round(r.intervalo_medio * cfg.multiplicador_sumido) THEN 'risco'
                     ELSE 'adormecido' END
             ELSE
                CASE WHEN r.dias_sem_compra < cfg.limiar_reativacao THEN 'ativo'
                     WHEN r.dias_sem_compra::numeric < round(cfg.limiar_reativacao::numeric * cfg.multiplicador_sumido) THEN 'risco'
                     ELSE 'adormecido' END
        END AS status_atividade,
        r.origem
    FROM ritmo r CROSS JOIN cfg
    ORDER BY r.ltv_total DESC;
$function$;

create or replace view public.view_contatos_segmento
with (security_invoker = true) as
SELECT contato_id,
    nome,
    tipo,
    criado_em,
    nome_norm,
    apelido_norm,
    telefone_norm,
    indicado_por_id,
    arquivado_em,
    origem_rotulo,
    segmento,
    precisa_revisao,
    total_compras,
    total_gasto,
    ultima_compra,
    total_pedidos,
    intervalo_medio,
    dias_sem_compra,
    atraso,
    sumido,
    temperatura,
    temperatura_ordem
   FROM fn_contatos_segmento(((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date) fn_contatos_segmento(contato_id, nome, tipo, criado_em, nome_norm, apelido_norm, telefone_norm, indicado_por_id, arquivado_em, origem_rotulo, segmento, precisa_revisao, total_compras, total_gasto, ultima_compra, total_pedidos, intervalo_medio, dias_sem_compra, atraso, sumido, temperatura, temperatura_ordem);

drop function if exists public.hoje_sp(timestamptz);

notify pgrst, 'reload schema';
