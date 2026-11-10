-- Rollback de 20261110142732_datas_sp_gravacao: volta defaults e funções para CURRENT_DATE / ::date (UTC)
-- e devolve a data_emissao 08/07 às 2 contas (como estavam antes; ver o CSV de backup).

alter table public.contas_a_pagar alter column data_emissao set default CURRENT_DATE;
alter table public.lancamentos alter column data set default CURRENT_DATE;
alter table public.pagamentos_conta_a_pagar alter column data_pagamento set default CURRENT_DATE;
alter table public.purchase_orders alter column order_date set default CURRENT_DATE;
alter table public.vendas alter column data set default CURRENT_DATE;

CREATE OR REPLACE FUNCTION public.admin_extrato_entregadores(p_inicio date, p_fim date)
 RETURNS TABLE(entregador_id uuid, nome text, repasse_por_entrega numeric, entregas bigint, devido numeric, pago numeric, dinheiro_coletado numeric, saldo_repasse numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.nome,
        e.repasse_por_entrega,
        COALESCE(ent.cnt, 0) AS entregas,
        COALESCE(ent.cnt, 0)::numeric * e.repasse_por_entrega AS devido,
        COALESCE(pg.total, 0) AS pago,
        COALESCE(col.total, 0) AS dinheiro_coletado,
        (COALESCE(ent.cnt, 0)::numeric * e.repasse_por_entrega) - COALESCE(pg.total, 0) AS saldo_repasse
    FROM public.entregadores e
    LEFT JOIN LATERAL (
        SELECT count(*) AS cnt
        FROM public.vendas v
        WHERE v.entregador_id = e.id
          AND v.status = 'entregue'
          AND COALESCE(v.data_entrega, v.data) BETWEEN p_inicio AND p_fim
    ) ent ON true
    LEFT JOIN LATERAL (
        SELECT COALESCE(sum(l.valor), 0) AS total
        FROM public.lancamentos l
        WHERE l.entregador_id = e.id
          AND l.tipo = 'saida'
          AND l.data BETWEEN p_inicio AND p_fim
    ) pg ON true
    LEFT JOIN LATERAL (
        SELECT COALESCE(sum(v.total), 0) AS total
        FROM public.vendas v
        WHERE v.recebido_por_entregador_id = e.id
          AND v.dinheiro_acertado_em IS NULL
          AND v.recebido_em::date BETWEEN p_inicio AND p_fim
    ) col ON true
    WHERE e.ativo = true
    ORDER BY e.nome;
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_pedido(p_nome_cliente text, p_telefone_cliente text, p_endereco_entrega text, p_metodo_entrega text, p_metodo_pagamento text, p_subtotal numeric, p_frete numeric, p_total numeric, p_observacoes text DEFAULT NULL::text, p_indicado_por text DEFAULT NULL::text, p_itens jsonb DEFAULT '[]'::jsonb, p_cep text DEFAULT NULL::text, p_logradouro text DEFAULT NULL::text, p_numero text DEFAULT NULL::text, p_complemento text DEFAULT NULL::text, p_bairro text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text, p_uf text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido_id uuid;
  v_numero_pedido integer;
  v_pedido jsonb;
  v_item jsonb;
  v_contato_id uuid;
  v_venda_id uuid;
  v_telefone_norm text;
  v_custo_unitario numeric;
  v_custo_total numeric := 0;
  v_nome_atual text;
  v_nome_novo_capitalizado text;
BEGIN
  v_nome_novo_capitalizado := fn_capitalize_name(p_nome_cliente);

  INSERT INTO cat_pedidos (
    nome_cliente, telefone_cliente, endereco_entrega, metodo_entrega,
    metodo_pagamento, subtotal, frete, total,
    observacoes, indicado_por, status, status_pagamento
  ) VALUES (
    v_nome_novo_capitalizado, p_telefone_cliente, p_endereco_entrega, p_metodo_entrega,
    p_metodo_pagamento, p_subtotal, p_frete, p_total,
    p_observacoes, p_indicado_por, 'pendente', 'pendente'
  ) RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO cat_itens_pedido (
      pedido_id, produto_id, nome_produto, quantidade,
      preco_unitario, total
    ) VALUES (
      v_pedido_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total')::numeric
    );
  END LOOP;

  BEGIN
    v_telefone_norm := regexp_replace(p_telefone_cliente, '[^0-9]', '', 'g');

    SELECT id, nome INTO v_contato_id, v_nome_atual
    FROM contatos
    WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone_norm
    LIMIT 1;

    IF v_contato_id IS NULL THEN
      INSERT INTO contatos (
        nome, telefone, tipo, status, origem, origem_cadastro,
        endereco, cep, logradouro, numero, complemento, bairro, cidade, uf
      ) VALUES (
        v_nome_novo_capitalizado, v_telefone_norm, 'B2C', 'cliente', 'catalogo', 'catalogo',
        p_endereco_entrega, p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_uf
      )
      RETURNING id INTO v_contato_id;
    ELSE
      IF fn_count_words(v_nome_novo_capitalizado) > fn_count_words(v_nome_atual) THEN
        UPDATE contatos SET
          nome = v_nome_novo_capitalizado,
          endereco = COALESCE(p_endereco_entrega, endereco),
          cep = COALESCE(p_cep, cep),
          logradouro = COALESCE(p_logradouro, logradouro),
          numero = COALESCE(p_numero, numero),
          complemento = COALESCE(p_complemento, complemento),
          bairro = COALESCE(p_bairro, bairro),
          cidade = COALESCE(p_cidade, cidade),
          uf = COALESCE(p_uf, uf),
          atualizado_em = now()
        WHERE id = v_contato_id;
      ELSE
        UPDATE contatos SET
          endereco = COALESCE(p_endereco_entrega, endereco),
          cep = COALESCE(p_cep, cep),
          logradouro = COALESCE(p_logradouro, logradouro),
          numero = COALESCE(p_numero, numero),
          complemento = COALESCE(p_complemento, complemento),
          bairro = COALESCE(p_bairro, bairro),
          cidade = COALESCE(p_cidade, cidade),
          uf = COALESCE(p_uf, uf),
          atualizado_em = now()
        WHERE id = v_contato_id;
      END IF;
    END IF;

    UPDATE cat_pedidos SET contato_id = v_contato_id WHERE id = v_pedido_id;

    INSERT INTO vendas (
      contato_id, data, total, forma_pagamento, status, pago, valor_pago,
      taxa_entrega, origem, cat_pedido_id, observacoes
    ) VALUES (
      v_contato_id, current_date, p_total, p_metodo_pagamento,
      'pendente', false, 0, p_frete, 'catalogo', v_pedido_id, p_observacoes
    ) RETURNING id INTO v_venda_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      SELECT COALESCE(custo, 0) INTO v_custo_unitario FROM produtos WHERE id = (v_item->>'product_id')::uuid;
      IF v_custo_unitario IS NULL THEN v_custo_unitario := 0; END IF;
      v_custo_total := v_custo_total + (v_custo_unitario * (v_item->>'quantity')::integer);

      INSERT INTO itens_venda (
        venda_id, produto_id, quantidade, preco_unitario, subtotal, custo_unitario
      ) VALUES (
        v_venda_id,
        (v_item->>'product_id')::uuid,
        (v_item->>'quantity')::integer,
        (v_item->>'unit_price')::numeric,
        (v_item->>'total')::numeric,
        v_custo_unitario
      );
    END LOOP;

    UPDATE vendas SET custo_total = v_custo_total WHERE id = v_venda_id;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_pedidos_pendentes_vinculacao (cat_pedido_id, motivo_falha)
    VALUES (v_pedido_id, SQLERRM);
  END;

  v_pedido := jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'status', 'pendente',
    'total', p_total
  );

  RETURN v_pedido;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.fn_sync_cat_pedido_to_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_contato_id uuid;
    v_telefone_normalizado text;
    v_venda_id uuid;
    v_item record;
    v_custo_unitario numeric;
    v_custo_total numeric := 0;
BEGIN
    -- Pedido da loja vira venda só pela confirmação no sistema interno (loja_confirmar_pedido),
    -- com frete e forma de pagamento; nunca por mudança de status do pedido.
    IF NEW.canal = 'loja' THEN
        RETURN NEW;
    END IF;

    -- Só processar se o status mudar para 'entregue'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status != 'entregue')) THEN

        -- Verificar se já existe venda para este pedido (salvaguarda)
        IF EXISTS (SELECT 1 FROM public.vendas WHERE cat_pedido_id = NEW.id) THEN
            RETURN NEW;
        END IF;

        BEGIN
            -- Normalizar telefone
            v_telefone_normalizado := regexp_replace(NEW.telefone_cliente, '\D', '', 'g');
            IF LENGTH(v_telefone_normalizado) >= 12 AND LEFT(v_telefone_normalizado, 2) = '55' THEN
                v_telefone_normalizado := SUBSTRING(v_telefone_normalizado FROM 3);
            END IF;

            -- Get-or-create contato
            SELECT id INTO v_contato_id FROM public.contatos
            WHERE regexp_replace(telefone, '\D', '', 'g') = v_telefone_normalizado LIMIT 1;

            IF v_contato_id IS NULL THEN
                INSERT INTO public.contatos (nome, telefone, status, tipo, origem, endereco, observacoes)
                VALUES (NEW.nome_cliente, NEW.telefone_cliente, 'cliente', 'B2C', 'catalogo',
                        NEW.endereco_entrega, 'Criado automaticamente via pedido do catálogo #' || NEW.numero_pedido)
                RETURNING id INTO v_contato_id;
            END IF;

            -- Inserir venda — DIRETO em reais, sem conversão
            INSERT INTO public.vendas (
                contato_id, data, total, forma_pagamento, status, pago,
                origem, cat_pedido_id, observacoes, taxa_entrega
            ) VALUES (
                v_contato_id,
                COALESCE(NEW.criado_em::date, CURRENT_DATE),
                NEW.total,
                COALESCE(NEW.metodo_pagamento, 'pix'),
                'entregue',
                true,
                'catalogo',
                NEW.id,
                'Pedido Catálogo #' || NEW.numero_pedido || COALESCE(E'\nObs: ' || NEW.observacoes, ''),
                COALESCE(NEW.frete, 0)
            ) RETURNING id INTO v_venda_id;

            -- Copiar cat_itens_pedido → itens_venda
            FOR v_item IN
                SELECT ci.produto_id, ci.quantidade, ci.preco_unitario, ci.total
                FROM cat_itens_pedido ci
                WHERE ci.pedido_id = NEW.id
            LOOP
                SELECT COALESCE(custo, 0) INTO v_custo_unitario
                FROM produtos WHERE id = v_item.produto_id;
                IF v_custo_unitario IS NULL THEN v_custo_unitario := 0; END IF;

                v_custo_total := v_custo_total + (v_custo_unitario * v_item.quantidade);

                INSERT INTO itens_venda (
                    venda_id, produto_id, quantidade, preco_unitario, subtotal, custo_unitario
                ) VALUES (
                    v_venda_id,
                    v_item.produto_id,
                    v_item.quantidade,
                    v_item.preco_unitario,
                    v_item.total,
                    v_custo_unitario
                );
            END LOOP;

            -- Atualizar custo total na venda
            UPDATE vendas SET custo_total = v_custo_total WHERE id = v_venda_id;

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.cat_pedidos_pendentes_vinculacao (cat_pedido_id, motivo_falha)
            VALUES (NEW.id, SQLERRM);
        END;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_ajuste_saldo(p_conta_id uuid, p_saldo_real numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conta   RECORD;
  v_cat_id  uuid;
  v_diff    numeric;
  v_tipo    text;
  v_lanc_id uuid;
BEGIN
  IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
  END IF;

  IF p_saldo_real IS NULL THEN
    RAISE EXCEPTION 'Saldo real e obrigatorio';
  END IF;

  SELECT id, nome, ativo, COALESCE(saldo_atual, 0) AS saldo_atual INTO v_conta
  FROM contas WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta nao encontrada: %', p_conta_id;
  END IF;
  IF NOT v_conta.ativo THEN
    RAISE EXCEPTION 'Conta inativa: %', v_conta.nome;
  END IF;

  v_diff := round(p_saldo_real - v_conta.saldo_atual, 2);
  IF v_diff = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_cat_id FROM plano_de_contas WHERE codigo = 'AJUSTE_SALDO' LIMIT 1;
  IF v_cat_id IS NULL THEN
    RAISE EXCEPTION 'Categoria AJUSTE_SALDO nao encontrada';
  END IF;

  IF v_diff > 0 THEN
    v_tipo := 'entrada';
  ELSE
    v_tipo := 'saida';
    v_diff := -v_diff;
  END IF;

  INSERT INTO lancamentos (tipo, valor, data, descricao, conta_id, plano_conta_id, origem)
  VALUES (v_tipo, v_diff, CURRENT_DATE,
          'Ajuste de saldo (reconciliação)', p_conta_id, v_cat_id, 'ajuste')
  RETURNING id INTO v_lanc_id;

  RETURN v_lanc_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_despesa_manual(p_valor numeric, p_descricao text, p_data date, p_conta_id uuid, p_plano_conta_id uuid, p_entregador_id uuid DEFAULT NULL::uuid, p_comprovante_url text DEFAULT NULL::text)
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
    plano_conta_id, origem, entregador_id, comprovante_url
  ) VALUES (
    'saida', p_valor, p_data, p_descricao, p_conta_id,
    p_plano_conta_id, 'manual', p_entregador_id, p_comprovante_url
  )
  RETURNING id INTO v_lancamento_id;

  RETURN v_lancamento_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_entrada_manual(p_valor numeric, p_descricao text, p_data date, p_conta_id uuid, p_plano_conta_id uuid)
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

update public.contas_a_pagar set data_emissao = date '2026-07-08'
 where id in ('df0b2cbb-6007-4b31-891a-fe6afb141b72', '4c3159a7-5222-4f68-beee-38e8c198e5e0') and data_emissao = date '2026-07-07';

notify pgrst, 'reload schema';
