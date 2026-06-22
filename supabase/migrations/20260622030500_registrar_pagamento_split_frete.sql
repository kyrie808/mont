-- Estágio 3 (parte 2/2): split de frete no registrar_pagamento_venda.
-- O pagamento é dividido proporcionalmente entre produto (RECEBIMENTO_VENDA) e
-- frete (RECEBIMENTO_FRETE); ambos os lançamentos carregam pagamento_id (link
-- explícito). Venda sem frete → 1 lançamento (idêntico ao comportamento antigo).
-- Backup: dump-{schema,data}-20260622-025133.sql

CREATE OR REPLACE FUNCTION public.registrar_pagamento_venda(
    p_venda_id uuid,
    p_valor numeric,
    p_metodo text,
    p_data date,
    p_conta_id uuid,
    p_observacao text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_plano_venda_id  uuid;
    v_plano_frete_id  uuid;
    v_pagamento_id    uuid;
    v_lancamento_id   uuid;
    v_total           numeric;
    v_taxa            numeric;
    v_frete_portion   numeric;
    v_produto_portion numeric;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

    -- 1. Registra o pagamento -- trigger trigger_update_venda_pagamento recalcula
    --    vendas.valor_pago e vendas.pago automaticamente.
    INSERT INTO public.pagamentos_venda (venda_id, valor, data, metodo, observacao, conta_id)
    VALUES (p_venda_id, p_valor, p_data::timestamptz, p_metodo, p_observacao, p_conta_id)
    RETURNING id INTO v_pagamento_id;

    -- 2. Dados da venda para o split.
    SELECT total, COALESCE(taxa_entrega, 0)
      INTO v_total, v_taxa
      FROM public.vendas WHERE id = p_venda_id;

    -- 3. Split proporcional deste pagamento entre frete e produto (stateless).
    IF v_taxa > 0 AND v_total > 0 THEN
        v_frete_portion := round(p_valor * v_taxa / v_total, 2);
    ELSE
        v_frete_portion := 0;
    END IF;
    v_produto_portion := p_valor - v_frete_portion;

    -- 4. Lançamento de PRODUTO (sempre).
    SELECT id INTO v_plano_venda_id
      FROM public.plano_de_contas WHERE codigo = 'RECEBIMENTO_VENDA' LIMIT 1;

    INSERT INTO public.lancamentos (
        data, descricao, valor, tipo, conta_id, plano_conta_id, venda_id, origem, pagamento_id
    ) VALUES (
        p_data,
        CASE WHEN p_metodo IS NOT NULL THEN 'Pagamento venda - ' || p_metodo ELSE 'Recebimento de venda' END,
        v_produto_portion, 'entrada', p_conta_id, v_plano_venda_id, p_venda_id, 'venda', v_pagamento_id
    )
    RETURNING id INTO v_lancamento_id;

    -- 5. Lançamento de FRETE (só quando há frete neste pagamento).
    IF v_frete_portion > 0 THEN
        SELECT id INTO v_plano_frete_id
          FROM public.plano_de_contas WHERE codigo = 'RECEBIMENTO_FRETE' LIMIT 1;

        INSERT INTO public.lancamentos (
            data, descricao, valor, tipo, conta_id, plano_conta_id, venda_id, origem, pagamento_id
        ) VALUES (
            p_data, 'Frete - venda', v_frete_portion, 'entrada', p_conta_id, v_plano_frete_id, p_venda_id, 'venda', v_pagamento_id
        );
    END IF;

    RETURN v_lancamento_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';
