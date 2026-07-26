-- Segmento do cliente por venda ENTREGUE (não por pagamento).
--
-- A lista de Clientes classificava o segmento (Lead/Cliente/VIP/Inativo) via `ranking_compras`,
-- que exige `pago=true`. Resultado: quem comprou FIADO (entregue, não pago) aparecia como "Lead"
-- — errado, pois recebeu o produto. Esta view conta vendas entregues não-brinde SEM exigir pago;
-- "comprou" = recebeu (inclui fiado). `total_gasto` = produto sem frete (inclui fiado, por decisão).
--
-- `ranking_compras` fica INTOCADA (é do /ranking de pontos, que é sobre pagamento).
-- security_invoker=true → respeita RLS do chamador (admin).

CREATE VIEW public.contato_compras_resumo
WITH (security_invoker = true) AS
    SELECT c.id AS contato_id,
        count(v.id) AS total_compras,
        COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0::numeric)), 0::numeric) AS total_gasto,
        max(v.data) AS ultima_compra
    FROM contatos c
        JOIN vendas v ON v.contato_id = c.id
    WHERE v.status = 'entregue'::text
      AND v.forma_pagamento <> 'brinde'::text
    GROUP BY c.id;
