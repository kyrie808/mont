-- ============================================================
-- H-3: Guard is_admin() em 9 RPCs (2026-05-20)
-- Design: zero REVOKE de authenticated
--         Guard: NOT is_admin() AND COALESCE(auth.role(),'') <> 'service_role'
-- Anon:         401 (proacl — sem EXECUTE grant, confirmado pré-apply)
-- Non-admin:    403 + {"code":"42501","message":"Acesso negado: apenas administradores"}
--               exceto rpc_total_a_receber_dashboard -> 200 + {zeros}
-- Admin:        200 (is_admin()=true -> guard nao dispara)
-- Service_role: passa (auth.role()='service_role' -> segunda condicao false)
-- Rollback:     apps/interno/reports/hardening/h3/ddl-snapshot-pre.sql
-- ============================================================


-- ============================================================
-- TIER 1 -- 6 RPCs FINANCEIRAS (plpgsql)
-- ============================================================

-- 1/9 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pagamento_venda(
    p_venda_id    uuid,
    p_valor       numeric,
    p_metodo      text,
    p_data        date,
    p_conta_id    uuid,
    p_observacao  text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_plano_id      uuid;
    v_lancamento_id uuid;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

    -- 1. Registra o pagamento -- trigger trigger_update_venda_pagamento dispara
    --    automaticamente e recalcula vendas.valor_pago e vendas.pago
    INSERT INTO public.pagamentos_venda (venda_id, valor, data, metodo, observacao)
    VALUES (p_venda_id, p_valor, p_data::timestamptz, p_metodo, p_observacao);

    -- 2. Lookup do plano de contas por codigo tecnico imutavel
    SELECT id INTO v_plano_id
    FROM public.plano_de_contas
    WHERE codigo = 'RECEBIMENTO_VENDA'
    LIMIT 1;

    -- 3. Cria lancamento no fluxo de caixa
    INSERT INTO public.lancamentos (
        data, descricao, valor, tipo, conta_id, plano_conta_id, venda_id, origem
    ) VALUES (
        p_data,
        CASE
            WHEN p_metodo IS NOT NULL THEN 'Pagamento venda - ' || p_metodo
            ELSE 'Recebimento de venda'
        END,
        p_valor,
        'entrada',
        p_conta_id,
        v_plano_id,
        p_venda_id,
        'venda'
    )
    RETURNING id INTO v_lancamento_id;

    RETURN v_lancamento_id;
END;
$function$;


-- 2/9 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pagamento_conta_a_pagar(
    p_conta_a_pagar_id  uuid,
    p_valor             numeric,
    p_data_pagamento    date,
    p_conta_id          uuid,
    p_metodo_pagamento  text DEFAULT 'pix'::text,
    p_observacao        text DEFAULT NULL::text,
    p_conta_credor_id   uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
-- ==========================================================================
-- NOTA DE ARQUITETURA (Divida Tecnica):
-- Este RPC cria lancamentos no fluxo de caixa (tabela lancamentos) para cada
-- pagamento. O trigger tr_lancamentos_saldo atualiza o saldo da conta de
-- origem automaticamente.
--
-- Ja os pagamentos de purchase_orders (purchase_order_payments) NAO geram
-- lancamentos. Eles debitam o saldo da conta diretamente via trigger
-- tr_po_payments_saldo em purchase_order_payments.
--
-- Essa assimetria e intencional por enquanto. A view_extrato_mensal usa UNION
-- para consolidar ambos os fluxos na mesma visualizacao.
-- Ref: Auditoria Financeira 2026-03-21
-- ==========================================================================
DECLARE
    v_cap              RECORD;
    v_lancamento_id    UUID;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

    -- 1. Validar que a obrigacao existe e nao esta paga
    SELECT id, descricao, credor, valor_total, valor_pago, saldo_devedor, status, plano_conta_id
    INTO v_cap
    FROM public.contas_a_pagar
    WHERE id = p_conta_a_pagar_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta a pagar % nao encontrada', p_conta_a_pagar_id;
    END IF;

    IF v_cap.status = 'pago' THEN
        RAISE EXCEPTION 'Esta obrigacao ja esta totalmente paga';
    END IF;

    -- 2. Validar que nao ha overpayment
    IF ROUND(p_valor::numeric, 2) > ROUND(v_cap.saldo_devedor::numeric, 2) THEN
        RAISE EXCEPTION 'Valor do pagamento (%) excede o saldo devedor (%)',
            p_valor, v_cap.saldo_devedor;
    END IF;

    -- 3. Inserir pagamento (trigger recalcula valor_pago + status)
    INSERT INTO public.pagamentos_conta_a_pagar (
        conta_a_pagar_id, valor, data_pagamento, conta_id, metodo_pagamento, observacao
    ) VALUES (
        p_conta_a_pagar_id, p_valor, p_data_pagamento, p_conta_id, p_metodo_pagamento, p_observacao
    );

    -- 4. Criar lancamento de saida no fluxo de caixa (debita conta de origem)
    INSERT INTO public.lancamentos (
        data, descricao, valor, tipo, conta_id, plano_conta_id, origem
    ) VALUES (
        p_data_pagamento,
        'Pgto ' || v_cap.credor || ' - ' || v_cap.descricao,
        p_valor,
        'saida',
        p_conta_id,
        v_cap.plano_conta_id,
        'contas_a_pagar'
    )
    RETURNING id INTO v_lancamento_id;

    -- 5. Se conta do credor informada, criar lancamento de entrada (credita conta do credor)
    IF p_conta_credor_id IS NOT NULL THEN
        INSERT INTO public.lancamentos (
            data, descricao, valor, tipo, conta_id, plano_conta_id, origem
        ) VALUES (
            p_data_pagamento,
            'Reembolso ' || v_cap.credor || ' - ' || v_cap.descricao,
            p_valor,
            'entrada',
            p_conta_credor_id,
            v_cap.plano_conta_id,
            'contas_a_pagar'
        );
    END IF;

    RETURN v_lancamento_id;
END;
$function$;


-- 3/9 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_obrigacao_parcelada(
    p_descricao       text,
    p_credor          text,
    p_valor_total     numeric,
    p_data_vencimento date,
    p_plano_conta_id  uuid,
    p_total_parcelas  integer DEFAULT 1,
    p_referencia      text    DEFAULT NULL::text,
    p_observacao      text    DEFAULT NULL::text
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valor_parcela NUMERIC;
  v_valor_ultima  NUMERIC;
  v_data          DATE;
  v_id            UUID;
  i               INT;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

  IF p_total_parcelas < 1 THEN
    RAISE EXCEPTION 'Total de parcelas deve ser >= 1';
  END IF;

  v_valor_parcela := TRUNC(p_valor_total / p_total_parcelas, 2);
  v_valor_ultima  := p_valor_total - (v_valor_parcela * (p_total_parcelas - 1));

  FOR i IN 1..p_total_parcelas LOOP
    v_data := p_data_vencimento + ((i - 1) * INTERVAL '1 month');

    INSERT INTO contas_a_pagar (
      descricao, credor, valor_total, data_vencimento,
      plano_conta_id, parcela_atual, total_parcelas,
      referencia, observacao
    ) VALUES (
      CASE WHEN p_total_parcelas > 1
        THEN p_descricao || ' - Parcela ' || i || '/' || p_total_parcelas
        ELSE p_descricao
      END,
      p_credor,
      CASE WHEN i = p_total_parcelas THEN v_valor_ultima ELSE v_valor_parcela END,
      v_data,
      p_plano_conta_id,
      i,
      p_total_parcelas,
      p_referencia,
      p_observacao
    ) RETURNING id INTO v_id;

    RETURN NEXT v_id;
  END LOOP;
END;
$function$;


-- 4/9 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_purchase_order_with_items(
    p_order_id       uuid,
    p_fornecedor_id  uuid,
    p_order_date     date,
    p_total_amount   numeric,
    p_notes          text,
    p_status         text,
    p_payment_status text,
    p_items          jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

    UPDATE purchase_orders
    SET
        fornecedor_id  = p_fornecedor_id,
        order_date     = p_order_date,
        total_amount   = p_total_amount,
        notes          = p_notes,
        status         = p_status::purchase_order_status,
        payment_status = p_payment_status::purchase_order_payment_status
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase_order % not found', p_order_id;
    END IF;

    DELETE FROM purchase_order_items
    WHERE purchase_order_id = p_order_id;

    INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost)
    SELECT
        p_order_id,
        (item->>'product_id')::UUID,
        (item->>'quantity')::INTEGER,
        (item->>'unit_cost')::NUMERIC
    FROM jsonb_array_elements(p_items) AS item;
END;
$function$;


-- 5/9 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_despesa_manual(
    p_valor          numeric,
    p_descricao      text,
    p_data           date,
    p_conta_id       uuid,
    p_plano_conta_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lancamento_id UUID;
  v_conta         RECORD;
  v_plano         RECORD;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero. Recebido: %', p_valor;
  END IF;

  SELECT id, nome, ativo INTO v_conta
  FROM contas WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta nao encontrada: %', p_conta_id;
  END IF;
  IF NOT v_conta.ativo THEN
    RAISE EXCEPTION 'Conta inativa: %', v_conta.nome;
  END IF;

  SELECT id, nome, tipo, ativo, automatica INTO v_plano
  FROM plano_de_contas WHERE id = p_plano_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de contas nao encontrado: %', p_plano_conta_id;
  END IF;
  IF NOT v_plano.ativo THEN
    RAISE EXCEPTION 'Categoria inativa: %', v_plano.nome;
  END IF;
  IF v_plano.tipo <> 'despesa' THEN
    RAISE EXCEPTION 'Categoria "%" nao e do tipo despesa (tipo atual: %)',
      v_plano.nome, v_plano.tipo;
  END IF;
  IF v_plano.automatica = true THEN
    RAISE EXCEPTION 'Categoria "%" e automatica e nao aceita lancamento manual',
      v_plano.nome;
  END IF;

  IF p_data > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data nao pode ser futura: %', p_data;
  END IF;

  INSERT INTO lancamentos (
    tipo, valor, data, descricao, conta_id,
    plano_conta_id, origem
  ) VALUES (
    'saida', p_valor, p_data, p_descricao, p_conta_id,
    p_plano_conta_id, 'manual'
  )
  RETURNING id INTO v_lancamento_id;

  RETURN v_lancamento_id;
END;
$function$;


-- 6/9 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_entrada_manual(
    p_valor          numeric,
    p_descricao      text,
    p_data           date,
    p_conta_id       uuid,
    p_plano_conta_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lancamento_id UUID;
  v_conta         RECORD;
  v_plano         RECORD;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero. Recebido: %', p_valor;
  END IF;

  SELECT id, nome, ativo INTO v_conta
  FROM contas WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta nao encontrada: %', p_conta_id;
  END IF;
  IF NOT v_conta.ativo THEN
    RAISE EXCEPTION 'Conta inativa: %', v_conta.nome;
  END IF;

  SELECT id, nome, tipo, ativo, automatica INTO v_plano
  FROM plano_de_contas WHERE id = p_plano_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de contas nao encontrado: %', p_plano_conta_id;
  END IF;
  IF NOT v_plano.ativo THEN
    RAISE EXCEPTION 'Categoria inativa: %', v_plano.nome;
  END IF;
  IF v_plano.tipo <> 'receita' THEN
    RAISE EXCEPTION 'Categoria "%" nao e do tipo receita (tipo atual: %)',
      v_plano.nome, v_plano.tipo;
  END IF;
  IF v_plano.automatica = true THEN
    RAISE EXCEPTION 'Categoria "%" e automatica e nao aceita lancamento manual',
      v_plano.nome;
  END IF;

  IF p_data > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data nao pode ser futura: %', p_data;
  END IF;

  INSERT INTO lancamentos (
    tipo, valor, data, descricao, conta_id,
    plano_conta_id, origem
  ) VALUES (
    'entrada', p_valor, p_data, p_descricao, p_conta_id,
    p_plano_conta_id, 'manual'
  )
  RETURNING id INTO v_lancamento_id;

  RETURN v_lancamento_id;
END;
$function$;


-- ============================================================
-- TIER 2 -- 3 RPCs NAO-FINANCEIRAS
-- ============================================================

-- 7/9 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_image_reference(
    p_produto_id uuid,
    p_url        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

  -- Remove referencias antigas
  DELETE FROM sis_imagens_produto WHERE produto_id = p_produto_id;
  DELETE FROM cat_imagens_produto WHERE produto_id = p_produto_id;

  -- Insere nas duas tabelas atomicamente
  INSERT INTO sis_imagens_produto (produto_id, url, tipo, ordem, ativo)
  VALUES (p_produto_id, p_url, 'internal', 0, true);

  INSERT INTO cat_imagens_produto (produto_id, url, tipo, ordem, ativo)
  VALUES (p_produto_id, p_url, 'cover', 0, true);
END;
$function$;


-- 8/9 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_image_reference(
    p_produto_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

  DELETE FROM sis_imagens_produto WHERE produto_id = p_produto_id;
  DELETE FROM cat_imagens_produto WHERE produto_id = p_produto_id;
END;
$function$;


-- 9/9 (LANGUAGE sql -- guard via WHERE filter) ----------------
-- Non-admin:    retorna {"total_a_receber":0,"total_vendas_abertas":0}
-- Admin:        retorna dados reais (is_admin()=true -> AND true)
-- Service_role: is_admin()=false -> zeros (sem caller service_role desta funcao em prod)
CREATE OR REPLACE FUNCTION public.rpc_total_a_receber_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT jsonb_build_object(
        'total_a_receber',      COALESCE(SUM(total), 0),
        'total_vendas_abertas', COUNT(*)
    )
    FROM public.vendas
    WHERE pago = false
      AND status = 'entregue'
      AND forma_pagamento <> 'brinde'
      AND (origem IS NULL OR origem <> 'catalogo')
      AND (SELECT public.is_admin());
$function$;
