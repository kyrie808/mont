-- Fase C — Relatórios separam aquisição × promoção.
--
-- rpt_campanhas (AQUISIÇÃO): filtra tipo IN ('aquisicao','ambos') — para de listar
--   campanhas de promoção (que aparecem com 0 leads, pois promoção não usa campanha_id).
-- rpt_campanhas_promocao (PROMOÇÃO, nova): por campanha tipo IN ('promocao','ambos'),
--   base em contato_campanhas: participantes, quantos compraram APÓS entrar na campanha,
--   receita gerada (produto sem frete — regra canônica).

-- 1) Aquisição: mesma view, só filtra por tipo. ⚠️ preservar security_invoker=true.
CREATE OR REPLACE VIEW public.rpt_campanhas
WITH (security_invoker = true) AS
    SELECT ca.id AS campanha_id,
        ca.nome,
        ca.ativo,
        count(DISTINCT c.id) AS leads,
        count(DISTINCT c.id) FILTER (WHERE vw.contato_id IS NOT NULL) AS converteram,
        COALESCE(sum(vw.receita), 0::numeric) AS receita_gerada
    FROM campanhas ca
        LEFT JOIN contatos c ON c.campanha_id = ca.id
        LEFT JOIN ( SELECT v.contato_id,
                sum(v.total - COALESCE(v.taxa_entrega, 0::numeric)) AS receita
               FROM vendas v
              WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text
              GROUP BY v.contato_id) vw ON vw.contato_id = c.id
    WHERE ca.tipo IN ('aquisicao', 'ambos')
    GROUP BY ca.id, ca.nome, ca.ativo;

-- 2) Promoção: participação (contato_campanhas) × compra pós-oferta.
CREATE OR REPLACE VIEW public.rpt_campanhas_promocao
WITH (security_invoker = true) AS
    WITH compras AS (
        -- receita do contato em vendas feitas A PARTIR da entrada na campanha
        SELECT cc.campanha_id, cc.contato_id,
            sum(v.total - COALESCE(v.taxa_entrega, 0::numeric)) AS receita
        FROM contato_campanhas cc
            JOIN vendas v ON v.contato_id = cc.contato_id
                AND v.status = 'entregue'::text
                AND v.forma_pagamento <> 'brinde'::text
                AND v.data >= (cc.criado_em AT TIME ZONE 'America/Sao_Paulo')::date
        GROUP BY cc.campanha_id, cc.contato_id
    )
    SELECT ca.id AS campanha_id,
        ca.nome,
        ca.tipo,
        ca.ativo,
        count(DISTINCT cc.contato_id) AS participantes,
        count(DISTINCT co.contato_id) AS compraram,
        COALESCE(sum(co.receita), 0::numeric) AS receita_gerada
    FROM campanhas ca
        JOIN contato_campanhas cc ON cc.campanha_id = ca.id
        LEFT JOIN compras co ON co.campanha_id = ca.id AND co.contato_id = cc.contato_id
    WHERE ca.tipo IN ('promocao', 'ambos')
    GROUP BY ca.id, ca.nome, ca.tipo, ca.ativo;
