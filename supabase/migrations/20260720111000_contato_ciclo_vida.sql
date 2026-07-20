-- Ciclo de vida do ponto de contato (D1).
--
-- "Sem resposta" não é um fato no ato do contato — só se sabe após uma JANELA (24h).
-- Modelo: resultado NULL = "Aguardando"; após a janela sem retorno = "Sem resposta"
-- (DERIVADO na leitura, sem cron); respondeu/aceitou/recusou = retorno explícito.

-- 1) Janela configurável (default 24h) no config do relacionamento.
UPDATE public.configuracoes
SET valor = valor || jsonb_build_object('janela_resposta_horas', 24)
WHERE chave = 'relacionamento';

-- 2) Os "sem_resposta" antigos (marcados no ato) viram NULL = aguardando; por serem
--    velhos (>janela), já derivam "sem resposta" na leitura. Uma representação só.
UPDATE public.interacoes
SET resultado = NULL
WHERE tipo = 'ponto_contato' AND resultado = 'sem_resposta';

-- 3) Esforço de relacionamento recalculado com a janela (lê do config).
DROP FUNCTION IF EXISTS public.rpt_relacionamento_esforco_periodo(date, date);

CREATE FUNCTION public.rpt_relacionamento_esforco_periodo(p_desde date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS TABLE(tentativas bigint, sem_resposta bigint, respondeu bigint, aguardando bigint, aceitou bigint)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
    WITH cfg AS (
        SELECT COALESCE(max((valor ->> 'janela_resposta_horas')::int), 24) AS janela
        FROM configuracoes WHERE chave = 'relacionamento'
    )
    SELECT
        count(*) AS tentativas,
        count(*) FILTER (
            WHERE (i.resultado IS NULL OR i.resultado = 'sem_resposta')
              AND i.data < now() - make_interval(hours => cfg.janela)
        ) AS sem_resposta,
        count(*) FILTER (WHERE i.resultado IN ('respondeu', 'aceitou', 'recusou')) AS respondeu,
        count(*) FILTER (
            WHERE (i.resultado IS NULL OR i.resultado = 'sem_resposta')
              AND i.data >= now() - make_interval(hours => cfg.janela)
        ) AS aguardando,
        count(*) FILTER (WHERE i.resultado = 'aceitou') AS aceitou
    FROM interacoes i CROSS JOIN cfg
    WHERE i.tipo = 'ponto_contato'
      AND (p_desde IS NULL OR (i.data AT TIME ZONE 'America/Sao_Paulo')::date >= p_desde)
      AND (p_ate   IS NULL OR (i.data AT TIME ZONE 'America/Sao_Paulo')::date <= p_ate);
$function$;
