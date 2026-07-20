-- Relatórios · Esforço de relacionamento — métricas do kanban/interações.
--
-- rpt_relacionamento_esforco_periodo: tentativas de contato (interacoes tipo='ponto_contato')
--   e desfecho (respondeu/sem_resposta/aceitou), com recorte de período. Alimenta o
--   alerta "N de M contatos não responderam".
-- rpt_relacionamento_funil (vitalício): quanto da base foi trabalhada (status_relacionamento)
--   + qualidade (contatos marcados "Whatsapp Incorreto" = não-alcançáveis).
-- SECURITY INVOKER (respeita RLS do chamador).

CREATE OR REPLACE FUNCTION public.rpt_relacionamento_esforco_periodo(p_desde date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS TABLE(tentativas bigint, sem_resposta bigint, respondeu bigint, aceitou bigint)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
    SELECT
        count(*)                                                                          AS tentativas,
        count(*) FILTER (WHERE i.resultado = 'sem_resposta')                              AS sem_resposta,
        count(*) FILTER (WHERE i.resultado IS NOT NULL AND i.resultado <> 'sem_resposta') AS respondeu,
        count(*) FILTER (WHERE i.resultado = 'aceitou')                                   AS aceitou
    FROM interacoes i
    WHERE i.tipo = 'ponto_contato'
      AND (p_desde IS NULL OR (i.data AT TIME ZONE 'America/Sao_Paulo')::date >= p_desde)
      AND (p_ate   IS NULL OR (i.data AT TIME ZONE 'America/Sao_Paulo')::date <= p_ate);
$function$;

CREATE OR REPLACE VIEW public.rpt_relacionamento_funil
WITH (security_invoker = 'true') AS
    SELECT
        count(*) FILTER (WHERE c.status_relacionamento = 'a_contatar')    AS a_contatar,
        count(*) FILTER (WHERE c.status_relacionamento = 'contatado')     AS contatado,
        count(*) FILTER (WHERE c.status_relacionamento = 'em_negociacao') AS em_negociacao,
        count(*) FILTER (WHERE c.status_relacionamento = 'resolvido')     AS resolvido,
        count(*)                                                          AS total,
        (SELECT count(DISTINCT ct.contato_id)
           FROM contato_tags ct JOIN tags t ON t.id = ct.tag_id
          WHERE lower(t.nome) = lower('Whatsapp Incorreto'))              AS whatsapp_incorreto
    FROM contatos c
    WHERE c.arquivado_em IS NULL;
