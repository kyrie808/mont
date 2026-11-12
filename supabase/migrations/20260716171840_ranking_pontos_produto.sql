-- Ranking de pontos = PRODUTO, não dinheiro-com-frete.
--
-- Programa Embaixadores (decisão do diretor): cada R$1 gasto em PRODUTO vale 1 ponto;
-- frete NÃO conta. A view somava vendas.total (que inclui taxa_entrega) — passa a somar
-- só o produto (total - taxa_entrega), no SELECT e no HAVING.
--
-- Impacto hoje: desprezível (~R$5 no ranking inteiro), pois o frete mal começou. Fica
-- certo para quando crescer. Consumida por useContatosResumo (segmentação) e — até a
-- migration da RPC — pela página de Ranking; ambos herdam a correção.
--
-- ⚠️ FOOTGUN: CREATE OR REPLACE VIEW reseta security_invoker. Re-declarar WITH (...).
-- (mesma pegadinha da separação frete×produto)

CREATE OR REPLACE VIEW public.ranking_compras
WITH (security_invoker = 'on') AS
    SELECT
        c.id AS contato_id,
        c.nome,
        COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0)), 0::numeric) AS total_pontos,
        count(v.id) AS total_compras,
        max(v.data) AS ultima_compra
    FROM contatos c
    JOIN vendas v ON v.contato_id = c.id
    WHERE v.status = 'entregue'
      AND v.pago = true
      AND v.forma_pagamento <> 'brinde'
    GROUP BY c.id, c.nome
    HAVING sum(v.total - COALESCE(v.taxa_entrega, 0)) > 0::numeric;
