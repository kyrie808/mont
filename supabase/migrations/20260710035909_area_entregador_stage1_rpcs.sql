-- Área do Entregador — Stage 1: RPCs do entregador + atribuição no interno.
--
-- O entregador (não-admin) NUNCA lê as tabelas direto (Stage 0 fechou o SELECT
-- aberto). Ele acessa os dados dele SÓ por estas RPCs SECURITY DEFINER, guardadas
-- por is_entregador() + posse da linha (vendas.entregador_id), devolvendo campos
-- CURADOS (endereço/frete pra entregar; zero receita/custo/margem/outros pedidos).
--
-- Backup: dump-{schema,data}-20260710-005353.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Campo livre do comercial pro entregador (ex.: "aguardar confirmação do pix").
--    Separado de vendas.observacoes (nota interna) pra não vazar nota interna.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vendas
    ADD COLUMN IF NOT EXISTS observacao_entregador text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Núcleo de pagamento (extraído de registrar_pagamento_venda, SEM o guard).
--    Motivo: o entregador precisa registrar "recebido em dinheiro", mas
--    registrar_pagamento_venda tem guard is_admin() — e dentro de um SECURITY
--    DEFINER o auth.uid() continua sendo o do entregador (não-admin), então a
--    chamada aninhada seria recusada. Extrair o núcleo (sem guard) e fazer as
--    duas RPCs públicas delegarem evita DUPLICAR a lógica de split de frete.
--    O core é REVOKED de todos: só é chamável de dentro de outra função DEFINER.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._pagamento_venda_core(
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

REVOKE EXECUTE ON FUNCTION public._pagamento_venda_core(uuid, numeric, text, date, uuid, text) FROM public, anon, authenticated;

-- registrar_pagamento_venda: mantém o guard is_admin() e delega no core (mesma
-- assinatura e comportamento de antes — split de frete idêntico).
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
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

    RETURN public._pagamento_venda_core(p_venda_id, p_valor, p_metodo, p_data, p_conta_id, p_observacao);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. entregador_minhas_entregas() — as entregas atribuídas ao entregador logado,
--    com campos curados. Estado de pagamento derivado só de pago/forma:
--    "so_entregar" (pago OU fiado OU brinde) vs "receber_na_entrega" (o resto,
--    não pago → ele coleta em dinheiro). Zero receita/custo/margem.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.entregador_minhas_entregas()
 RETURNS TABLE (
    venda_id             uuid,
    data                 date,
    status_entrega       text,
    estado_pagamento     text,
    taxa_entrega         numeric,
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
            WHEN v.pago = true THEN 'so_entregar'
            WHEN v.forma_pagamento IN ('fiado', 'brinde') THEN 'so_entregar'
            ELSE 'receber_na_entrega'
        END,
        COALESCE(v.taxa_entrega, 0),
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
-- 4. entregador_marcar_recebido_dinheiro(p_venda_id) — a ÚNICA escrita financeira
--    do entregador. Valida (dele + não paga + não fiado/brinde), registra o
--    restante como pagamento em DINHEIRO no Caixa (via core) e carimba o marcador
--    recebido_por_entregador_id/recebido_em (hedge pro extrato futuro).
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
    v_forma         text;
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

    -- Posse + estado. FOR UPDATE serializa clique-duplo.
    SELECT pago, forma_pagamento, total, COALESCE(valor_pago, 0)
      INTO v_pago, v_forma, v_total, v_valor_pago
      FROM public.vendas
     WHERE id = p_venda_id AND entregador_id = v_entregador_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Entrega não encontrada ou não atribuída a você' USING ERRCODE = '42501';
    END IF;

    IF v_pago THEN
        RAISE EXCEPTION 'Venda já está paga' USING ERRCODE = '22000';
    END IF;

    IF v_forma IN ('fiado', 'brinde') THEN
        RAISE EXCEPTION 'Esta entrega não é para receber na entrega' USING ERRCODE = '22000';
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
-- 5. entregador_marcar_entregue(p_venda_id) — flipa vendas.status='entregue'
--    (dispara os triggers existentes: baixa de estoque + Purchase CAPI + sync
--    catálogo). Liberação = a própria atribuição (o comercial só atribui quando
--    está pronto); aqui valida só posse + não-cancelada.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.entregador_marcar_entregue(p_venda_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entregador_id uuid;
    v_status        text;
BEGIN
    IF NOT (SELECT public.is_entregador()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas entregadores' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_entregador_id
      FROM public.entregadores WHERE user_id = (SELECT auth.uid()) AND ativo = true;

    SELECT status INTO v_status
      FROM public.vendas
     WHERE id = p_venda_id AND entregador_id = v_entregador_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Entrega não encontrada ou não atribuída a você' USING ERRCODE = '42501';
    END IF;

    IF v_status = 'cancelada' THEN
        RAISE EXCEPTION 'Venda cancelada não pode ser entregue' USING ERRCODE = '22000';
    END IF;

    IF v_status = 'entregue' THEN
        RETURN; -- idempotente
    END IF;

    UPDATE public.vendas SET status = 'entregue' WHERE id = p_venda_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_marcar_entregue(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_marcar_entregue(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. criar_venda ganha p_entregador_id + p_observacao_entregador (opcionais).
--    A atribuição do entregador na criação da venda faz a venda cair no app dele.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date);

CREATE OR REPLACE FUNCTION public.criar_venda(
    p_contato_id uuid,
    p_data date,
    p_forma_pagamento text,
    p_taxa_entrega numeric,
    p_itens jsonb,
    p_idempotency_key uuid,
    p_data_prevista_pagamento date DEFAULT NULL,
    p_entregador_id uuid DEFAULT NULL,
    p_observacao_entregador text DEFAULT NULL
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

    -- Idempotência: se essa chave já criou uma venda, retorna a existente.
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_venda_id
          FROM public.vendas
         WHERE idempotency_key = p_idempotency_key;
        IF v_venda_id IS NOT NULL THEN
            RETURN v_venda_id;
        END IF;
    END IF;

    -- Total = soma dos subtotais + frete (autoritativo no servidor).
    SELECT COALESCE(sum((i->>'subtotal')::numeric), 0)
      INTO v_total
      FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS i;
    v_total := v_total + COALESCE(p_taxa_entrega, 0);

    -- Custo total = soma(quantidade * custo do produto).
    SELECT COALESCE(sum((i->>'quantidade')::numeric * COALESCE(pr.custo, 0)), 0)
      INTO v_custo_total
      FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS i
      JOIN public.produtos pr ON pr.id = (i->>'produto_id')::uuid;

    INSERT INTO public.vendas (
        contato_id, data, status, total, pago, forma_pagamento,
        taxa_entrega, data_prevista_pagamento, custo_total, idempotency_key,
        entregador_id, observacao_entregador
    ) VALUES (
        p_contato_id, p_data, 'pendente', v_total, false, p_forma_pagamento,
        COALESCE(p_taxa_entrega, 0), p_data_prevista_pagamento, v_custo_total, p_idempotency_key,
        p_entregador_id, p_observacao_entregador
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

REVOKE EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
