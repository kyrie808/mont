-- Fase 1 (Integração Meta): rpt_campanhas expõe origem + campos da Meta,
-- pra a página /campanhas separar Tráfego (origem='meta') de campanhas internas.
-- CREATE OR REPLACE só anexa colunas no fim (evita 42P16); preserva security_invoker.
CREATE OR REPLACE VIEW public.rpt_campanhas
WITH (security_invoker = true) AS
    SELECT ca.id AS campanha_id,
        ca.nome,
        ca.ativo,
        count(DISTINCT c.id) AS leads,
        count(DISTINCT c.id) FILTER (WHERE vw.contato_id IS NOT NULL) AS converteram,
        COALESCE(sum(vw.receita), 0::numeric) AS receita_gerada,
        ca.origem_campanha,
        ca.meta_campaign_id,
        ca.meta_objetivo,
        ca.meta_status
    FROM campanhas ca
        LEFT JOIN contatos c ON c.campanha_id = ca.id
        LEFT JOIN ( SELECT v.contato_id,
                sum(v.total - COALESCE(v.taxa_entrega, 0::numeric)) AS receita
               FROM vendas v
              WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text
              GROUP BY v.contato_id) vw ON vw.contato_id = c.id
    WHERE ca.tipo IN ('aquisicao', 'ambos')
    GROUP BY ca.id, ca.nome, ca.ativo, ca.origem_campanha, ca.meta_campaign_id, ca.meta_objetivo, ca.meta_status;
