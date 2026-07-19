-- Marketing E4.3 — views de campanhas e de fonte de tráfego (vitalícias).
--
-- Alimentam a seção "Promoção · campanhas & tráfego". Infra nova (a campanha é
-- vinculada ao lead só quando origem='anuncio'), cresce com os anúncios da Copa.
--
-- rpt_campanhas: por campanha → leads trazidos, quantos converteram (compraram
--   entregue+não-brinde) e a receita PRODUTO gerada por esses leads.
-- rpt_aquisicao_fonte: por fonte de anúncio (meta_ads/google_ads/tiktok) →
--   leads e conversões. Só linhas com fonte preenchida.
-- security_invoker respeita a RLS do chamador.

CREATE OR REPLACE VIEW public.rpt_campanhas
WITH (security_invoker = 'true') AS
    SELECT ca.id AS campanha_id, ca.nome, ca.ativo,
        count(DISTINCT c.id) AS leads,
        count(DISTINCT c.id) FILTER (WHERE vw.contato_id IS NOT NULL) AS converteram,
        COALESCE(sum(vw.receita), 0) AS receita_gerada
    FROM campanhas ca
    LEFT JOIN contatos c ON c.campanha_id = ca.id
    LEFT JOIN (
        SELECT v.contato_id, sum(v.total - COALESCE(v.taxa_entrega, 0)) AS receita
        FROM vendas v
        WHERE v.status = 'entregue' AND v.forma_pagamento <> 'brinde'
        GROUP BY v.contato_id
    ) vw ON vw.contato_id = c.id
    GROUP BY ca.id, ca.nome, ca.ativo;

CREATE OR REPLACE VIEW public.rpt_aquisicao_fonte
WITH (security_invoker = 'true') AS
    SELECT c.fonte,
        count(*) AS leads,
        count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM vendas v
            WHERE v.contato_id = c.id
              AND v.status = 'entregue' AND v.forma_pagamento <> 'brinde'
        )) AS converteram
    FROM contatos c
    WHERE c.fonte IS NOT NULL
    GROUP BY c.fonte;
