-- D4: esforço de contato ciente da direção (sentido).
-- Antes contava TODO ponto_contato como tentativa; com beats de entrada (resposta do
-- cliente) isso inflaria. Agora: tentativa = saída (eu contatei); resposta = entrada
-- (ou saída marcada respondeu, compat legado). Mesmo formato de retorno (UI intacta).
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
        -- tentativas = minhas saídas ainda sem resposta marcada
        count(*) FILTER (WHERE i.sentido = 'saida' AND i.resultado IS NULL) AS tentativas,
        count(*) FILTER (
            WHERE i.sentido = 'saida' AND i.resultado IS NULL
              AND i.data < now() - make_interval(hours => cfg.janela)
        ) AS sem_resposta,
        -- respostas = entradas (ou saída marcada respondeu no modelo antigo)
        count(*) FILTER (WHERE i.sentido = 'entrada' OR i.resultado IN ('respondeu','aceitou','recusou')) AS respondeu,
        count(*) FILTER (
            WHERE i.sentido = 'saida' AND i.resultado IS NULL
              AND i.data >= now() - make_interval(hours => cfg.janela)
        ) AS aguardando,
        count(*) FILTER (WHERE i.resultado = 'aceitou') AS aceitou
    FROM interacoes i CROSS JOIN cfg
    WHERE i.tipo = 'ponto_contato'
      AND (p_desde IS NULL OR (i.data AT TIME ZONE 'America/Sao_Paulo')::date >= p_desde)
      AND (p_ate   IS NULL OR (i.data AT TIME ZONE 'America/Sao_Paulo')::date <= p_ate);
$function$;
