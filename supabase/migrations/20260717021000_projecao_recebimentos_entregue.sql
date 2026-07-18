-- "A receber" dos relatórios = fiado canônico (entregue + não pago, sem catálogo).
--
-- rpt_projecao_recebimentos incluía vendas PENDENTES (não entregues) e do CATÁLOGO,
-- divergindo do A Receber do Início (só entregue). Alinha somando os mesmos filtros.
-- Só o Relatórios consome esta view (verificado) → seguro. Zero mudança de estrutura.
--
-- ⚠️ FOOTGUN: re-declarar security_invoker ('true').

CREATE OR REPLACE VIEW public.rpt_projecao_recebimentos
WITH (security_invoker = 'true') AS
    SELECT v.id AS venda_id,
        c.nome AS contato_nome,
        c.telefone AS contato_telefone,
        v.data AS data_venda,
        v.data_prevista_pagamento,
        v.total,
        v.valor_pago,
        v.total - v.valor_pago AS saldo_aberto,
        CASE
            WHEN v.data_prevista_pagamento IS NULL THEN 'sem_data'
            WHEN v.data_prevista_pagamento < CURRENT_DATE THEN 'vencido'
            WHEN v.data_prevista_pagamento = CURRENT_DATE THEN 'vence_hoje'
            WHEN v.data_prevista_pagamento <= (CURRENT_DATE + '7 days'::interval) THEN 'proximos_7_dias'
            WHEN v.data_prevista_pagamento <= (CURRENT_DATE + '30 days'::interval) THEN 'proximos_30_dias'
            ELSE 'futuro'
        END AS situacao
    FROM vendas v
    JOIN contatos c ON c.id = v.contato_id
    WHERE v.pago = false
      AND v.status = 'entregue'
      AND v.forma_pagamento <> 'brinde'
      AND (v.origem IS NULL OR v.origem <> 'catalogo')
    ORDER BY v.data_prevista_pagamento;
