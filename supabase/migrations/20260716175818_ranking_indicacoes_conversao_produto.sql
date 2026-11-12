-- Ranking de Indicações: distinguir "trazidos" de "convertidos" + valor produto-only.
--
-- Decisão do diretor: mostrar os dois números (trouxe N · M compraram) e ORDENAR o
-- ranking por CONVERSÃO (quem comprou), alinhado ao prêmio (5 que compram = 1kg).
-- A ordenação em si é feita nos consumidores (hook + CTE do Início); a view só passa
-- a expor `total_convertidos`.
--
-- `total_vendas_indicados` vira produto-only (frete fora), alinhado ao programa de pontos.
--
-- ⚠️ FOOTGUN: CREATE OR REPLACE VIEW reseta security_invoker. Re-declarar WITH (...).

CREATE OR REPLACE VIEW public.ranking_indicacoes
WITH (security_invoker = 'on') AS
    -- Ordem das colunas mantida (indicador_id, nome, total_indicados, total_vendas_indicados)
    -- e total_convertidos ADICIONADO no fim — CREATE OR REPLACE VIEW não reordena/renomeia,
    -- só acrescenta no final. Consumidores selecionam por nome, então a posição é indiferente.
    SELECT
        i.id AS indicador_id,
        i.nome,
        count(DISTINCT c.id) AS total_indicados,
        COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0)) FILTER (
            WHERE v.status = 'entregue' AND v.pago = true AND v.forma_pagamento <> 'brinde'
        ), 0::numeric) AS total_vendas_indicados,
        count(DISTINCT c.id) FILTER (
            WHERE v.status = 'entregue' AND v.pago = true AND v.forma_pagamento <> 'brinde'
        ) AS total_convertidos
    FROM contatos i
    JOIN contatos c ON c.indicado_por_id = i.id
    LEFT JOIN vendas v ON v.contato_id = c.id
    GROUP BY i.id, i.nome
    HAVING count(c.id) > 0;
