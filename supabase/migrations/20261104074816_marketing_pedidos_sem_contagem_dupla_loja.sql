-- Parte G (04/11/2026): o pedido da loja pago não conta mais em dobro.
-- Backup antes: supabase/backups/dumps/dump-*-20261104-044458.sql
--
-- * vw_marketing_pedidos: a venda de origem 'loja' sai do ramo "direta", como a do catálogo antigo
--   (o pedido já entra como "online" pelo cat_pedidos pago). Mesmas colunas; security_invoker
--   reafirmado (CREATE OR REPLACE VIEW sem WITH o zera). Usada pela vw_admin_dashboard.
-- * rpt_marketing_pedidos_periodo: removida. Nenhuma tela usa desde a aba Marketing virar cockpit
--   (julho); o hook do interno que a chamava também sai.

DROP FUNCTION public.rpt_marketing_pedidos_periodo(date, date);

CREATE OR REPLACE VIEW public.vw_marketing_pedidos WITH (security_invoker = on) AS
 WITH todas_vendas AS (
         SELECT ((cat_pedidos.criado_em AT TIME ZONE 'America/Sao_Paulo'::text))::date AS data_venda,
            'online'::text AS origem_tipo,
            cat_pedidos.total AS total_reais,
            cat_pedidos.metodo_entrega,
            cat_pedidos.indicado_por AS referred_by
           FROM public.cat_pedidos
          WHERE ((cat_pedidos.status <> 'cancelado'::text) AND (cat_pedidos.status_pagamento = 'pago'::text))
        UNION ALL
         SELECT vendas.data AS data_venda,
            'direta'::text AS origem_tipo,
            vendas.total AS total_reais,
            NULL::text AS metodo_entrega,
            NULL::text AS referred_by
           FROM public.vendas
          WHERE ((vendas.status <> 'cancelada'::text) AND (vendas.pago = true)
                 AND ((vendas.origem IS NULL) OR (vendas.origem <> ALL (ARRAY['catalogo'::text, 'loja'::text])))
                 AND (vendas.forma_pagamento <> 'brinde'::text))
        )
 SELECT data_venda,
    to_char((data_venda)::timestamp with time zone, 'IYYY-IW'::text) AS semana_iso,
    to_char((data_venda)::timestamp with time zone, 'YYYY-MM'::text) AS mes_iso,
    count(*) AS total_pedidos,
    sum(total_reais) AS faturamento,
    round(avg(total_reais), 2) AS ticket_medio,
    count(*) FILTER (WHERE (origem_tipo = 'online'::text)) AS pedidos_online,
    count(*) FILTER (WHERE (origem_tipo = 'direta'::text)) AS pedidos_diretos,
    sum(total_reais) FILTER (WHERE (origem_tipo = 'online'::text)) AS faturamento_online,
    sum(total_reais) FILTER (WHERE (origem_tipo = 'direta'::text)) AS faturamento_direto,
    count(*) FILTER (WHERE (metodo_entrega = 'entrega'::text)) AS entregas_count,
    count(*) FILTER (WHERE (metodo_entrega = 'retirada'::text)) AS retiradas_count
   FROM todas_vendas
  GROUP BY data_venda
  ORDER BY data_venda DESC;
