-- Rollback de 20261030181711_combos_preco_campanha_nova_venda (+ 20261030181909, que já tirou a FK de combo_id).
-- ATENÇÃO: só roda limpo se nenhuma venda foi gravada com combo (itens com combo_id) — essas
-- linhas perderiam a marca de qual combo vieram. Confira antes:
--   SELECT count(*) FROM public.itens_venda WHERE combo_id IS NOT NULL;
BEGIN;

DROP FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text);

CREATE FUNCTION public.criar_venda(p_contato_id uuid, p_data date, p_forma_pagamento text, p_taxa_entrega numeric, p_itens jsonb, p_idempotency_key uuid, p_data_prevista_pagamento date DEFAULT NULL::date, p_entregador_id uuid DEFAULT NULL::uuid, p_observacao_entregador text DEFAULT NULL::text, p_dinheiro_na_entrega boolean DEFAULT false, p_desconto numeric DEFAULT 0, p_status text DEFAULT 'pendente'::text, p_data_entrega_prevista date DEFAULT NULL::date)
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

    IF COALESCE(p_status, 'pendente') NOT IN ('pendente', 'entregue') THEN
        RAISE EXCEPTION 'Status inválido para criação de venda: %', p_status
            USING ERRCODE = '22023';
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
        entregador_id, observacao_entregador, dinheiro_na_entrega, desconto,
        data_entrega_prevista
    ) VALUES (
        p_contato_id, p_data, COALESCE(p_status, 'pendente'), v_total, false, p_forma_pagamento,
        COALESCE(p_taxa_entrega, 0), p_data_prevista_pagamento, v_custo_total, p_idempotency_key,
        p_entregador_id, p_observacao_entregador, COALESCE(p_dinheiro_na_entrega, false), COALESCE(p_desconto, 0),
        p_data_entrega_prevista
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
REVOKE EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date) TO authenticated, service_role;

DROP FUNCTION public.combo_itens(uuid, jsonb, text, timestamptz);
DROP FUNCTION public.precos_vigentes(timestamptz);
DROP FUNCTION public.preco_tabela(uuid, text, timestamptz);
DROP FUNCTION public.campanha_vigente(timestamptz);

DROP INDEX public.idx_itens_venda_combo_id;
ALTER TABLE public.itens_venda DROP CONSTRAINT itens_venda_combo_par_check;
ALTER TABLE public.itens_venda DROP COLUMN combo_instancia, DROP COLUMN combo_id;
ALTER TABLE public.vendas DROP COLUMN tabela_preco;

-- O REVOKE da replace_combo_componentes para anon NÃO volta: era exposição sem uso.

NOTIFY pgrst, 'reload schema';
COMMIT;
