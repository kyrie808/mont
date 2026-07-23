-- Fase 2 (Integração Meta): ROAS por campanha × mês (números crus; a UI calcula as razões).
--
-- Vitalícia (a página /campanhas recorta por período no client, padrão rpt_aquisicao_mensal).
-- Por campanha origem='meta' × (ano,mes): gasto (métricas), receita+converteram (vendas
-- entregues não-brinde, produto sem frete, por mês da venda) e leads (contatos com
-- campanha_id, por mês de criação em SP). ROAS = receita/gasto e CAC = gasto/converteram
-- são calculados na UI (só quando fazem sentido).

CREATE VIEW public.rpt_campanhas_roas_mensal
WITH (security_invoker = true) AS
    WITH gasto AS (
        SELECT m.campanha_id,
            EXTRACT(YEAR  FROM m.dia)::int AS ano,
            EXTRACT(MONTH FROM m.dia)::int AS mes,
            SUM(m.gasto)      AS gasto,
            SUM(m.impressoes) AS impressoes,
            SUM(m.cliques)    AS cliques
        FROM campanha_meta_metricas m
        GROUP BY 1, 2, 3
    ),
    vendas_camp AS (
        SELECT c.campanha_id,
            EXTRACT(YEAR  FROM v.data)::int AS ano,
            EXTRACT(MONTH FROM v.data)::int AS mes,
            SUM(v.total - COALESCE(v.taxa_entrega, 0::numeric)) AS receita,
            COUNT(DISTINCT v.contato_id) AS converteram
        FROM vendas v
            JOIN contatos c ON c.id = v.contato_id
        WHERE c.campanha_id IS NOT NULL
          AND v.status = 'entregue'::text
          AND v.forma_pagamento <> 'brinde'::text
        GROUP BY 1, 2, 3
    ),
    leads AS (
        SELECT c.campanha_id,
            EXTRACT(YEAR  FROM (c.criado_em AT TIME ZONE 'America/Sao_Paulo'))::int AS ano,
            EXTRACT(MONTH FROM (c.criado_em AT TIME ZONE 'America/Sao_Paulo'))::int AS mes,
            COUNT(*) AS leads
        FROM contatos c
        WHERE c.campanha_id IS NOT NULL
        GROUP BY 1, 2, 3
    ),
    keys AS (
        SELECT campanha_id, ano, mes FROM gasto
        UNION SELECT campanha_id, ano, mes FROM vendas_camp
        UNION SELECT campanha_id, ano, mes FROM leads
    )
    SELECT ca.id AS campanha_id,
        ca.nome,
        ca.meta_status,
        k.ano,
        k.mes,
        COALESCE(g.gasto, 0::numeric) AS gasto,
        COALESCE(g.impressoes, 0::bigint) AS impressoes,
        COALESCE(g.cliques, 0::bigint) AS cliques,
        COALESCE(vc.receita, 0::numeric) AS receita,
        COALESCE(vc.converteram, 0::bigint) AS converteram,
        COALESCE(l.leads, 0::bigint) AS leads
    FROM keys k
        JOIN campanhas ca ON ca.id = k.campanha_id
        LEFT JOIN gasto g       ON g.campanha_id = k.campanha_id AND g.ano = k.ano AND g.mes = k.mes
        LEFT JOIN vendas_camp vc ON vc.campanha_id = k.campanha_id AND vc.ano = k.ano AND vc.mes = k.mes
        LEFT JOIN leads l       ON l.campanha_id = k.campanha_id AND l.ano = k.ano AND l.mes = k.mes
    WHERE ca.origem_campanha = 'meta';
