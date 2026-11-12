-- RPC atômica de criação de venda: grava o header (vendas) e os itens
-- (itens_venda) numa ÚNICA transação, com idempotência.
--
-- Motivação: o fluxo antigo (vendaService) fazia 2 inserts separados, sem
-- transação e sem chave de idempotência. Em sinal fraco/instável (uso do
-- Gilmar em campo) isso podia gravar parcial, perder a venda em silêncio ou
-- duplicar num retry. Uma função plpgsql é atômica e resolve tudo de uma vez,
-- num único round-trip (custos calculados no servidor).
--
-- Espelha o padrão já validado de registrar_pagamento_venda:
-- SECURITY DEFINER + guard is_admin() + SET search_path.
--
-- p_data_prevista_pagamento fica por último com DEFAULT NULL (vendas à vista
-- não têm data prevista) — assim o tipo gerado o marca como opcional.

CREATE OR REPLACE FUNCTION public.criar_venda(
    p_contato_id uuid,
    p_data date,
    p_forma_pagamento text,
    p_taxa_entrega numeric,
    p_data_prevista_pagamento date,
    p_itens jsonb,
    p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_venda_id    uuid;
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

    SELECT COALESCE(sum((i->>'subtotal')::numeric), 0)
      INTO v_total
      FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS i;
    v_total := v_total + COALESCE(p_taxa_entrega, 0);

    SELECT COALESCE(sum((i->>'quantidade')::numeric * COALESCE(pr.custo, 0)), 0)
      INTO v_custo_total
      FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS i
      JOIN public.produtos pr ON pr.id = (i->>'produto_id')::uuid;

    INSERT INTO public.vendas (
        contato_id, data, status, total, pago, forma_pagamento,
        taxa_entrega, data_prevista_pagamento, custo_total, idempotency_key
    ) VALUES (
        p_contato_id, p_data, 'pendente', v_total, false, p_forma_pagamento,
        COALESCE(p_taxa_entrega, 0), p_data_prevista_pagamento, v_custo_total, p_idempotency_key
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

REVOKE EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, date, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, date, jsonb, uuid) TO authenticated;
