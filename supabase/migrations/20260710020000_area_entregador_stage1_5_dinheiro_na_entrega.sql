-- Área do Entregador — Stage 1.5: cobrança em dinheiro na entrega (correção).
--
-- Achado no teste real (10/07): derivar "receber em dinheiro" de pago=false
-- marcava quase toda venda como "receber" — mas o normal é o cliente pagar a
-- Mont por PIX (pago=false na hora da entrega é só o PIX não baixado ainda). E o
-- app mostrava o valor do FRETE, não o total. Correção: flag EXPLÍCITO
-- dinheiro_na_entrega, marcado no cadastro da venda quando o cliente combinou
-- pagar em dinheiro ao entregador. Só nesse caso o app pede pra coletar (o total).
--
-- Backup: dump-schema/-data-20260710 (Stage 1.5).

ALTER TABLE public.vendas
    ADD COLUMN IF NOT EXISTS dinheiro_na_entrega boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- entregador_minhas_entregas: estado derivado do flag (não de pago) + valor_a_receber.
-- (muda o RETURNS TABLE → precisa DROP antes.)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.entregador_minhas_entregas();
CREATE FUNCTION public.entregador_minhas_entregas()
 RETURNS TABLE (
    venda_id             uuid,
    data                 date,
    status_entrega       text,
    estado_pagamento     text,
    taxa_entrega         numeric,
    valor_a_receber      numeric,
    repasse              numeric,
    observacao_entregador text,
    recebido_em          timestamptz,
    cliente_nome         text,
    cliente_apelido      text,
    cliente_telefone     text,
    endereco             text,
    logradouro           text,
    numero               text,
    complemento          text,
    bairro               text,
    cidade               text,
    uf                   text,
    cep                  text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entregador_id uuid;
    v_repasse       numeric;
BEGIN
    IF NOT (SELECT public.is_entregador()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas entregadores' USING ERRCODE = '42501';
    END IF;

    SELECT e.id, e.repasse_por_entrega
      INTO v_entregador_id, v_repasse
      FROM public.entregadores e
     WHERE e.user_id = (SELECT auth.uid()) AND e.ativo = true;

    RETURN QUERY
    SELECT
        v.id,
        COALESCE(v.data_entrega, v.data),
        v.status,
        CASE
            WHEN v.dinheiro_na_entrega = true AND v.pago = false THEN 'receber_na_entrega'
            ELSE 'so_entregar'
        END,
        COALESCE(v.taxa_entrega, 0),
        GREATEST(v.total - COALESCE(v.valor_pago, 0), 0),
        v_repasse,
        v.observacao_entregador,
        v.recebido_em,
        c.nome,
        c.apelido,
        c.telefone,
        c.endereco,
        c.logradouro,
        c.numero,
        c.complemento,
        c.bairro,
        c.cidade,
        c.uf,
        c.cep
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    WHERE v.entregador_id = v_entregador_id
      AND v.status <> 'cancelada'
    ORDER BY COALESCE(v.data_entrega, v.data) ASC, v.criado_em ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_minhas_entregas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_minhas_entregas() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- marcar_recebido_dinheiro: valida o flag dinheiro_na_entrega (no lugar de "não
-- fiado/brinde"). Só coleta dinheiro quando o comercial marcou explicitamente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.entregador_marcar_recebido_dinheiro(p_venda_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entregador_id uuid;
    v_pago          boolean;
    v_dinheiro      boolean;
    v_total         numeric;
    v_valor_pago    numeric;
    v_restante      numeric;
    v_conta_caixa   uuid;
    v_lancamento_id uuid;
BEGIN
    IF NOT (SELECT public.is_entregador()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas entregadores' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_entregador_id
      FROM public.entregadores WHERE user_id = (SELECT auth.uid()) AND ativo = true;

    SELECT pago, dinheiro_na_entrega, total, COALESCE(valor_pago, 0)
      INTO v_pago, v_dinheiro, v_total, v_valor_pago
      FROM public.vendas
     WHERE id = p_venda_id AND entregador_id = v_entregador_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Entrega não encontrada ou não atribuída a você' USING ERRCODE = '42501';
    END IF;

    IF NOT v_dinheiro THEN
        RAISE EXCEPTION 'Esta entrega não é pagamento em dinheiro na entrega' USING ERRCODE = '22000';
    END IF;

    IF v_pago THEN
        RAISE EXCEPTION 'Venda já está paga' USING ERRCODE = '22000';
    END IF;

    v_restante := v_total - v_valor_pago;
    IF v_restante <= 0 THEN
        RAISE EXCEPTION 'Nada a receber nesta venda' USING ERRCODE = '22000';
    END IF;

    SELECT id INTO v_conta_caixa FROM public.contas WHERE tipo = 'dinheiro' ORDER BY criado_em ASC LIMIT 1;
    IF v_conta_caixa IS NULL THEN
        RAISE EXCEPTION 'Conta Caixa (dinheiro) não configurada' USING ERRCODE = '22000';
    END IF;

    v_lancamento_id := public._pagamento_venda_core(
        p_venda_id, v_restante, 'dinheiro', current_date, v_conta_caixa,
        'Recebido pelo entregador na entrega'
    );

    UPDATE public.vendas
       SET recebido_por_entregador_id = v_entregador_id,
           recebido_em = now()
     WHERE id = p_venda_id;

    RETURN v_lancamento_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_marcar_recebido_dinheiro(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_marcar_recebido_dinheiro(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- criar_venda: ganha p_dinheiro_na_entrega (opcional, default false).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text);

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
    p_dinheiro_na_entrega boolean DEFAULT false
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
        taxa_entrega, data_prevista_pagamento, custo_total, idempotency_key,
        entregador_id, observacao_entregador, dinheiro_na_entrega
    ) VALUES (
        p_contato_id, p_data, 'pendente', v_total, false, p_forma_pagamento,
        COALESCE(p_taxa_entrega, 0), p_data_prevista_pagamento, v_custo_total, p_idempotency_key,
        p_entregador_id, p_observacao_entregador, COALESCE(p_dinheiro_na_entrega, false)
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

REVOKE EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
