-- RPC do Ranking de Compras com recorte OPCIONAL de mês (as duas visões: "Do mês" e "Geral").
--
-- A view ranking_compras é all-time; a página precisa também da visão mensal. Esta RPC é a
-- fonte única da PÁGINA nas duas visões: sem params = geral; com (p_ano, p_mes) = só o mês.
-- Retorna TODOS os contatos (sem LIMIT) — a página fatia o top-N e calcula os KPIs honestos
-- (nº real de clientes, soma de pontos) sobre o conjunto inteiro.
--
-- Fórmula produto-only IDÊNTICA à da view ranking_compras (20260716141500). Manter as duas
-- em sincronia — não deixar divergir (bug histórico de view-vs-RPC).
--
-- SECURITY INVOKER: mesmo modelo da view — RLS decide (admin vê tudo). Sem gate is_admin.

CREATE OR REPLACE FUNCTION public.rpc_ranking_compras(
    p_ano integer DEFAULT NULL,
    p_mes integer DEFAULT NULL
)
RETURNS TABLE (
    contato_id uuid,
    nome text,
    total_pontos numeric,
    total_compras bigint,
    ultima_compra date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
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
      AND (
          p_ano IS NULL OR p_mes IS NULL
          OR (EXTRACT(year FROM v.data) = p_ano AND EXTRACT(month FROM v.data) = p_mes)
      )
    GROUP BY c.id, c.nome
    HAVING sum(v.total - COALESCE(v.taxa_entrega, 0)) > 0::numeric
    ORDER BY total_pontos DESC;
$function$;
