-- Ranking de Indicações passa a ordenar por VALOR gerado (R$), não por nº de convertidos.
--
-- Decisão do diretor: como o R$ gerado pelos indicados é o número em destaque, o ranking
-- deve descer por ele (senão a coluna verde aparece fora de ordem). Desempate = convertidos.
-- O prêmio "5 convertidas = 1kg" segue como regra à parte (não é o critério de ordenação).
--
-- Muda SÓ o ORDER BY do CTE `ranking`; resto do corpo reproduzido verbatim.
-- (append-only sobre 20260716145700, que ordenava por conversão — a iteração fica no log.)
--
-- ⚠️ FOOTGUN: re-declarar security_invoker ('true').

CREATE OR REPLACE VIEW public.view_home_operacional
WITH (security_invoker = 'true') AS
    WITH itens_agg AS (
        SELECT itens_venda.venda_id,
            sum(itens_venda.quantidade) AS total_itens
        FROM itens_venda
        GROUP BY itens_venda.venda_id
    ), monthly_metrics AS (
        SELECT EXTRACT(year FROM v.data)::integer AS ano,
            EXTRACT(month FROM v.data)::integer AS mes,
            count(*) FILTER (WHERE v.status = 'entregue'::text) AS total_vendas,
            sum(COALESCE(ia.total_itens, 0::numeric)) FILTER (WHERE v.status = 'entregue'::text) AS total_itens
        FROM vendas v
            LEFT JOIN itens_agg ia ON ia.venda_id = v.id
        GROUP BY (EXTRACT(year FROM v.data)), (EXTRACT(month FROM v.data))
    ), ranking AS (
        SELECT json_agg(r.*) AS indicacoes
        FROM ( SELECT ri.indicador_id,
                    ri.nome,
                    ri.total_indicados,
                    ri.total_convertidos,
                    ri.total_vendas_indicados
                FROM ranking_indicacoes ri
                ORDER BY ri.total_vendas_indicados DESC, ri.total_convertidos DESC
                LIMIT 3) r
    ), ultimas AS (
        SELECT json_agg(uv.*) AS vendas
        FROM ( SELECT v.id,
                    v.data,
                    v.total,
                    v.status,
                    v.pago,
                    c.nome AS contato_nome
                FROM vendas v
                    JOIN contatos c ON c.id = v.contato_id
                ORDER BY v.data DESC, v.criado_em DESC
                LIMIT 5) uv
    )
    SELECT ano,
        mes,
        total_vendas,
        total_itens,
        ( SELECT count(*) AS count
            FROM vendas
            WHERE vendas.status = 'pendente'::text) AS pedidos_pendentes,
        ( SELECT count(*) AS count
            FROM vendas
            WHERE vendas.status = 'entregue'::text AND vendas.data = CURRENT_DATE) AS pedidos_entregues_hoje,
        ( SELECT count(DISTINCT vendas.contato_id) AS count
            FROM vendas
            WHERE vendas.status = 'entregue'::text) AS clientes_ativos,
        COALESCE(( SELECT ranking.indicacoes
            FROM ranking), '[]'::json) AS ranking_indicacoes,
        COALESCE(( SELECT ultimas.vendas
            FROM ultimas), '[]'::json) AS ultimas_vendas
    FROM monthly_metrics m;
