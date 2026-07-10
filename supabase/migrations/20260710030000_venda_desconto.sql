-- Desconto na venda: valor fixo em R$ (por venda), aplicado ao produto.
--
-- Hoje não existe desconto de verdade (a linha "Desconto" no recibo era hardcoded
-- em R$0). Aqui a coluna vendas.desconto + criar_venda passa a computar o total
-- líquido: total = GREATEST(soma_subtotais - desconto, 0) + frete. O frete fica
-- inteiro (pass-through); o desconto reduz só o produto. Downstream (pagamento,
-- split de frete, KPIs/lucro) usa o total líquido → reflete o desconto sozinho.
--
-- Backup: dump-{schema,data}-20260710 (desconto).

ALTER TABLE public.vendas
    ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.criar_venda(
    p_contato_id uuid,
    p_data date,
    p_forma_pagamento text,
    p_taxa_entrega numeric,
    p_itens jsonb,
    p_idempotency_key uuid,
    p_data_prevista_pagamento date DEFAULT NULL,
    p_entregador_id uuid DEFAULT NULL,
    p_observacao_entregador text DEFAULT NULL,
    p_dinheiro_na_entrega boolean DEFAULT false,
    p_desconto numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_venda_id    uuid;
    v_subtotais   numeric;
    v_total       numeric;
    v_custo_total numeric;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores'
            USING ERRCODE = '42501';
    END IF;

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_venda_id
          FROM public.vendas
         WHERE idempotency_key = p_idempotency_key;
        IF v_venda_id IS NOT NULL THEN
            RETURN v_venda_id;
        END IF;
    END IF;

    -- Total = (soma dos subtotais − desconto, piso 0) + frete. Frete fica inteiro.
    SELECT COALESCE(sum((i->>'subtotal')::numeric), 0)
      INTO v_subtotais
      FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS i;
    v_total := GREATEST(v_subtotais - COALESCE(p_desconto, 0), 0) + COALESCE(p_taxa_entrega, 0);

    SELECT COALESCE(sum((i->>'quantidade')::numeric * COALESCE(pr.custo, 0)), 0)
      INTO v_custo_total
      FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS i
      JOIN public.produtos pr ON pr.id = (i->>'produto_id')::uuid;

    INSERT INTO public.vendas (
        contato_id, data, status, total, pago, forma_pagamento,
        taxa_entrega, data_prevista_pagamento, custo_total, idempotency_key,
        entregador_id, observacao_entregador, dinheiro_na_entrega, desconto
    ) VALUES (
        p_contato_id, p_data, 'pendente', v_total, false, p_forma_pagamento,
        COALESCE(p_taxa_entrega, 0), p_data_prevista_pagamento, v_custo_total, p_idempotency_key,
        p_entregador_id, p_observacao_entregador, COALESCE(p_dinheiro_na_entrega, false), COALESCE(p_desconto, 0)
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_venda_id;

    IF v_venda_id IS NULL THEN
        SELECT id INTO v_venda_id
          FROM public.vendas
         WHERE idempotency_key = p_idempotency_key;
        RETURN v_venda_id;
    END IF;

    INSERT INTO public.itens_venda (
        venda_id, produto_id, quantidade, preco_unitario, subtotal, custo_unitario
    )
    SELECT
        v_venda_id,
        (i->>'produto_id')::uuid,
        (i->>'quantidade')::numeric,
        (i->>'preco_unitario')::numeric,
        (i->>'subtotal')::numeric,
        COALESCE(pr.custo, 0)
    FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS i
    JOIN public.produtos pr ON pr.id = (i->>'produto_id')::uuid;

    RETURN v_venda_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
