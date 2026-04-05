


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."purchase_order_payment_status" AS ENUM (
    'paid',
    'partial',
    'unpaid'
);


ALTER TYPE "public"."purchase_order_payment_status" OWNER TO "postgres";


CREATE TYPE "public"."purchase_order_status" AS ENUM (
    'pending',
    'received',
    'cancelled'
);


ALTER TYPE "public"."purchase_order_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_image_reference"("p_produto_id" "uuid", "p_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Remove referências antigas
  DELETE FROM sis_imagens_produto WHERE produto_id = p_produto_id;
  DELETE FROM cat_imagens_produto WHERE produto_id = p_produto_id;
  
  -- Insere nas duas tabelas atomicamente
  INSERT INTO sis_imagens_produto (produto_id, url, tipo, ordem, ativo)
  VALUES (p_produto_id, p_url, 'internal', 0, true);
  
  INSERT INTO cat_imagens_produto (produto_id, url, tipo, ordem, ativo)
  VALUES (p_produto_id, p_url, 'cover', 0, true);
END;
$$;


ALTER FUNCTION "public"."add_image_reference"("p_produto_id" "uuid", "p_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_obrigacao_parcelada"("p_descricao" "text", "p_credor" "text", "p_valor_total" numeric, "p_data_vencimento" "date", "p_plano_conta_id" "uuid", "p_total_parcelas" integer DEFAULT 1, "p_referencia" "text" DEFAULT NULL::"text", "p_observacao" "text" DEFAULT NULL::"text") RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_valor_parcela NUMERIC;
  v_valor_ultima NUMERIC;
  v_data DATE;
  v_id UUID;
  i INT;
BEGIN
  IF p_total_parcelas < 1 THEN
    RAISE EXCEPTION 'Total de parcelas deve ser >= 1';
  END IF;

  v_valor_parcela := TRUNC(p_valor_total / p_total_parcelas, 2);
  v_valor_ultima := p_valor_total - (v_valor_parcela * (p_total_parcelas - 1));

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
$$;


ALTER FUNCTION "public"."criar_obrigacao_parcelada"("p_descricao" "text", "p_credor" "text", "p_valor_total" numeric, "p_data_vencimento" "date", "p_plano_conta_id" "uuid", "p_total_parcelas" integer, "p_referencia" "text", "p_observacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_pedido"("p_nome_cliente" "text", "p_telefone_cliente" "text", "p_endereco_entrega" "text", "p_metodo_entrega" "text", "p_metodo_pagamento" "text", "p_subtotal" numeric, "p_frete" numeric, "p_total" numeric, "p_observacoes" "text" DEFAULT NULL::"text", "p_indicado_por" "text" DEFAULT NULL::"text", "p_itens" "jsonb" DEFAULT '[]'::"jsonb", "p_cep" "text" DEFAULT NULL::"text", "p_logradouro" "text" DEFAULT NULL::"text", "p_numero" "text" DEFAULT NULL::"text", "p_complemento" "text" DEFAULT NULL::"text", "p_bairro" "text" DEFAULT NULL::"text", "p_cidade" "text" DEFAULT NULL::"text", "p_uf" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pedido_id       UUID;
  v_numero_pedido   INTEGER;
  v_pedido          JSONB;
  v_item            JSONB;
  v_contato_id      UUID;
  v_venda_id        UUID;
  v_telefone_norm   TEXT;
  v_custo_unitario  NUMERIC;
  v_custo_total     NUMERIC := 0;
BEGIN
  -- ============================================================
  -- PARTE 1: Pedido do catálogo (CRÍTICA — não pode falhar)
  -- ============================================================

  INSERT INTO cat_pedidos (
    nome_cliente, telefone_cliente, endereco_entrega, metodo_entrega,
    metodo_pagamento, subtotal, frete, total,
    observacoes, indicado_por, status, status_pagamento
  ) VALUES (
    p_nome_cliente, p_telefone_cliente, p_endereco_entrega, p_metodo_entrega,
    p_metodo_pagamento, p_subtotal, p_frete, p_total,
    p_observacoes, p_indicado_por, 'pendente', 'pendente'
  ) RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

  -- Insere os itens do pedido (agora recebe unit_price e total em REAIS)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO cat_itens_pedido (
      pedido_id, produto_id, nome_produto, quantidade,
      preco_unitario, total
    ) VALUES (
      v_pedido_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );
  END LOOP;

  -- ============================================================
  -- PARTE 2: Sync com sistema interno (TOLERANTE a falhas)
  -- ============================================================
  BEGIN
    v_telefone_norm := regexp_replace(p_telefone_cliente, '[^0-9]', '', 'g');
    SELECT id INTO v_contato_id FROM contatos
    WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone_norm LIMIT 1;

    IF v_contato_id IS NULL THEN
      INSERT INTO contatos (nome, telefone, tipo, status, origem,
                            endereco, cep, logradouro, numero, complemento, bairro, cidade, uf)
      VALUES (p_nome_cliente, v_telefone_norm, 'B2C', 'cliente', 'catalogo',
              p_endereco_entrega, p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_uf)
      RETURNING id INTO v_contato_id;
    ELSE
      UPDATE contatos SET
        endereco = COALESCE(p_endereco_entrega, endereco),
        cep = COALESCE(p_cep, cep), logradouro = COALESCE(p_logradouro, logradouro),
        numero = COALESCE(p_numero, numero), complemento = COALESCE(p_complemento, complemento),
        bairro = COALESCE(p_bairro, bairro), cidade = COALESCE(p_cidade, cidade),
        uf = COALESCE(p_uf, uf), atualizado_em = now()
      WHERE id = v_contato_id;
    END IF;

    UPDATE cat_pedidos SET contato_id = v_contato_id WHERE id = v_pedido_id;

    -- Inserir venda — DIRETO em reais, sem conversão
    INSERT INTO vendas (
      contato_id, data, total, forma_pagamento, status, pago, valor_pago,
      taxa_entrega, origem, cat_pedido_id, observacoes
    ) VALUES (
      v_contato_id, CURRENT_DATE, p_total, p_metodo_pagamento,
      'pendente', false, 0, p_frete, 'catalogo', v_pedido_id, p_observacoes
    ) RETURNING id INTO v_venda_id;

    -- Inserir itens da venda — DIRETO em reais, sem conversão
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      SELECT COALESCE(custo, 0) INTO v_custo_unitario FROM produtos WHERE id = (v_item->>'product_id')::UUID;
      IF v_custo_unitario IS NULL THEN v_custo_unitario := 0; END IF;
      v_custo_total := v_custo_total + (v_custo_unitario * (v_item->>'quantity')::INTEGER);

      INSERT INTO itens_venda (
        venda_id, produto_id, quantidade, preco_unitario, subtotal, custo_unitario
      ) VALUES (
        v_venda_id,
        (v_item->>'product_id')::UUID,
        (v_item->>'quantity')::INTEGER,
        (v_item->>'unit_price')::NUMERIC,
        (v_item->>'total')::NUMERIC,
        v_custo_unitario
      );
    END LOOP;

    UPDATE vendas SET custo_total = v_custo_total WHERE id = v_venda_id;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_pedidos_pendentes_vinculacao (cat_pedido_id, motivo_falha)
    VALUES (v_pedido_id, SQLERRM);
  END;

  -- ============================================================
  -- PARTE 3: Retorno (agora retorna 'total' em reais)
  -- ============================================================
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
$$;


ALTER FUNCTION "public"."criar_pedido"("p_nome_cliente" "text", "p_telefone_cliente" "text", "p_endereco_entrega" "text", "p_metodo_entrega" "text", "p_metodo_pagamento" "text", "p_subtotal" numeric, "p_frete" numeric, "p_total" numeric, "p_observacoes" "text", "p_indicado_por" "text", "p_itens" "jsonb", "p_cep" "text", "p_logradouro" "text", "p_numero" "text", "p_complemento" "text", "p_bairro" "text", "p_cidade" "text", "p_uf" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_image_reference"("p_produto_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM sis_imagens_produto WHERE produto_id = p_produto_id;
  DELETE FROM cat_imagens_produto WHERE produto_id = p_produto_id;
END;
$$;


ALTER FUNCTION "public"."delete_image_reference"("p_produto_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cat_pedidos_link_contato"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  SELECT id INTO NEW.contato_id
  FROM contatos
  WHERE telefone = NEW.telefone_cliente
  LIMIT 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_cat_pedidos_link_contato"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sync_cat_pedido_to_venda"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_contato_id uuid;
    v_telefone_normalizado text;
    v_venda_id uuid;
    v_item record;
    v_custo_unitario numeric;
    v_custo_total numeric := 0;
BEGIN
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
                VALUES (NEW.nome_cliente, NEW.telefone_cliente, 'cliente', 'B2C', 'Catálogo Online',
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
                NEW.total,  -- Já é reais, sem conversão
                COALESCE(NEW.metodo_pagamento, 'pix'),
                'entregue',
                true,
                'catalogo',
                NEW.id,
                'Pedido Catálogo #' || NEW.numero_pedido || COALESCE(E'\nObs: ' || NEW.observacoes, ''),
                COALESCE(NEW.frete, 0)  -- Já é reais
            ) RETURNING id INTO v_venda_id;

            -- NOVO: Copiar cat_itens_pedido → itens_venda (resolve ALERTA-1)
            FOR v_item IN
                SELECT ci.produto_id, ci.quantidade, ci.preco_unitario, ci.total
                FROM cat_itens_pedido ci
                WHERE ci.pedido_id = NEW.id
            LOOP
                -- Buscar custo do produto
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
                    v_item.preco_unitario,  -- Já é reais
                    v_item.total,           -- Já é reais
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
$$;


ALTER FUNCTION "public"."fn_sync_cat_pedido_to_venda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_areceber_breakdown"() RETURNS TABLE("vencidos" bigint, "vencem_hoje" bigint, "vencem_semana" bigint, "sem_data" bigint, "valor_vencido" numeric, "valor_hoje" numeric, "valor_semana" numeric, "valor_sem_data" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE data_prevista_pagamento < CURRENT_DATE) as vencidos,
    COUNT(*) FILTER (WHERE data_prevista_pagamento = CURRENT_DATE) as vencem_hoje,
    COUNT(*) FILTER (WHERE data_prevista_pagamento BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7) as vencem_semana,
    COUNT(*) FILTER (WHERE data_prevista_pagamento IS NULL) as sem_data,
    COALESCE(SUM(total) FILTER (WHERE data_prevista_pagamento < CURRENT_DATE), 0) as valor_vencido,
    COALESCE(SUM(total) FILTER (WHERE data_prevista_pagamento = CURRENT_DATE), 0) as valor_hoje,
    COALESCE(SUM(total) FILTER (WHERE data_prevista_pagamento BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7), 0) as valor_semana,
    COALESCE(SUM(total) FILTER (WHERE data_prevista_pagamento IS NULL), 0) as valor_sem_data
  FROM vendas
  WHERE pago = false
    AND status = 'entregue'
    AND forma_pagamento <> 'brinde'
    AND (origem IS NULL OR origem <> 'catalogo');
END;
$$;


ALTER FUNCTION "public"."get_areceber_breakdown"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_audit_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If it's an INSERT operation
  IF TG_OP = 'INSERT' THEN
    -- Only set created_by if it wasn't explicitly provided (or if you want to force it, overwrite it)
    -- Using auth.uid() directly for Supabase
    NEW.created_by = auth.uid();
    NEW.updated_by = auth.uid();
    
    -- Ensure times are set
    IF NEW.criado_em IS NULL THEN
        NEW.criado_em = now();
    END IF;
    NEW.atualizado_em = now();
    
  -- If it's an UPDATE operation
  ELSIF TG_OP = 'UPDATE' THEN
    -- Never allow changing created_by or criado_em during an update
    NEW.created_by = OLD.created_by;
    NEW.criado_em = OLD.criado_em;
    
    -- Always update who did it and when
    NEW.updated_by = auth.uid();
    NEW.atualizado_em = now();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_audit_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_brinde_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.forma_pagamento = 'brinde' THEN
        NEW.pago       := false;
        NEW.valor_pago := 0;
        NEW.status     := 'entregue';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_brinde_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_stock_on_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    item             RECORD;
    v_conta_id       uuid;
    v_plano_conta_id uuid;
    v_contato_nome   text;
BEGIN
    -- --------------------------------------------------------
    -- Case 1: Entrega (pendente → entregue) — debitar estoque
    -- --------------------------------------------------------
    IF OLD.status = 'pendente' AND NEW.status = 'entregue' THEN

        FOR item IN
            SELECT produto_id, quantidade
            FROM public.itens_venda
            WHERE venda_id = NEW.id
        LOOP
            UPDATE public.produtos
            SET estoque_atual = estoque_atual - item.quantidade
            WHERE id = item.produto_id;
        END LOOP;

        -- Brinde: registrar lançamento de despesa no momento da entrega
        IF NEW.forma_pagamento = 'brinde' THEN

            SELECT id INTO v_conta_id
            FROM public.contas
            WHERE codigo = 'CAIXA';

            SELECT id INTO v_plano_conta_id
            FROM public.plano_de_contas
            WHERE codigo = 'DESPESA_BRINDE';

            SELECT nome INTO v_contato_nome
            FROM public.contatos
            WHERE id = NEW.contato_id;

            INSERT INTO public.lancamentos (
                tipo, valor, data, descricao,
                conta_id, plano_conta_id, origem, venda_id
            ) VALUES (
                'saida',
                NEW.total,
                NEW.data,
                'Brinde: ' || COALESCE(v_contato_nome, 'Cliente não identificado'),
                v_conta_id,
                v_plano_conta_id,
                'brinde',
                NEW.id
            );

        END IF;

    -- --------------------------------------------------------
    -- Case 2: Cancelamento de entregue (entregue → cancelada)
    --         — restaurar estoque
    -- --------------------------------------------------------
    ELSIF OLD.status = 'entregue' AND NEW.status = 'cancelada' THEN

        FOR item IN
            SELECT produto_id, quantidade
            FROM public.itens_venda
            WHERE venda_id = NEW.id
        LOOP
            UPDATE public.produtos
            SET estoque_atual = estoque_atual + item.quantidade
            WHERE id = item.produto_id;
        END LOOP;

        -- Brinde: remover lançamento de despesa ao cancelar
        -- (update_conta_saldo_lancamento reverte saldo_atual automaticamente no DELETE)
        IF NEW.forma_pagamento = 'brinde' THEN
            DELETE FROM public.lancamentos
            WHERE venda_id = NEW.id
              AND tipo    = 'saida'
              AND origem  = 'brinde';
        END IF;

    -- Case 3: Cancelamento de pendente → sem alteração de estoque ou lançamento
    -- Case 4 (removido): cancelada → pendente não debita mais
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_stock_on_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("check_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE admin_users.user_id = is_admin.check_user_id
          AND admin_users.role IN ('admin', 'super_admin')
    );
END;
$$;


ALTER FUNCTION "public"."is_admin"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_delete_automatic_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.automatica = true THEN
    RAISE EXCEPTION
      'Não é possível deletar a categoria "%" pois é automática do sistema. Desative-a se necessário.',
      OLD.nome;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."prevent_delete_automatic_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receive_purchase_order"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_order_record RECORD;
    v_item RECORD;
    v_current_stock INTEGER;
    v_current_cost NUMERIC;
    v_new_cost NUMERIC;
    v_total_qty INTEGER;
BEGIN
    -- 1. Check Order Status
    SELECT * INTO v_order_record FROM public.purchase_orders WHERE id = p_order_id;
    
    IF v_order_record IS NULL THEN
        RAISE EXCEPTION 'Purchase Order not found';
    END IF;

    IF v_order_record.status = 'received' THEN
        RAISE EXCEPTION 'Order already received';
    END IF;

    -- 2. Loop Items
    FOR v_item IN 
        SELECT * FROM public.purchase_order_items WHERE purchase_order_id = p_order_id
    LOOP
        -- Fetch current product data
        SELECT estoque_atual, custo 
        INTO v_current_stock, v_current_cost 
        FROM public.produtos 
        WHERE id = v_item.product_id;

        -- Handle potential nulls
        v_current_stock := COALESCE(v_current_stock, 0);
        v_current_cost := COALESCE(v_current_cost, 0);

        -- Calculate Weighted Average Cost
        v_total_qty := v_current_stock + v_item.quantity;

        IF v_total_qty > 0 THEN
            v_new_cost := ((v_current_stock * v_current_cost) + (v_item.quantity * v_item.unit_cost)) / v_total_qty;
        ELSE
            v_new_cost := v_item.unit_cost;
        END IF;

        -- Update Product
        UPDATE public.produtos
        SET 
            estoque_atual = v_total_qty,
            custo = ROUND(v_new_cost, 2),
            atualizado_em = NOW()
        WHERE id = v_item.product_id;
        
    END LOOP;

    -- 3. Update Order Status
    UPDATE public.purchase_orders
    SET 
        status = 'received',
        data_recebimento = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

END;
$$;


ALTER FUNCTION "public"."receive_purchase_order"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_despesa_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_lancamento_id UUID;
  v_conta RECORD;
  v_plano RECORD;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero. Recebido: %', p_valor;
  END IF;

  SELECT id, nome, ativo INTO v_conta
  FROM contas WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada: %', p_conta_id;
  END IF;
  IF NOT v_conta.ativo THEN
    RAISE EXCEPTION 'Conta inativa: %', v_conta.nome;
  END IF;

  SELECT id, nome, tipo, ativo, automatica INTO v_plano
  FROM plano_de_contas WHERE id = p_plano_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de contas não encontrado: %', p_plano_conta_id;
  END IF;
  IF NOT v_plano.ativo THEN
    RAISE EXCEPTION 'Categoria inativa: %', v_plano.nome;
  END IF;
  IF v_plano.tipo <> 'despesa' THEN
    RAISE EXCEPTION 'Categoria "%" não é do tipo despesa (tipo atual: %)', 
      v_plano.nome, v_plano.tipo;
  END IF;
  IF v_plano.automatica = true THEN
    RAISE EXCEPTION 'Categoria "%" é automática e não aceita lançamento manual', 
      v_plano.nome;
  END IF;

  IF p_data > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data não pode ser futura: %', p_data;
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
$$;


ALTER FUNCTION "public"."registrar_despesa_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_entrada_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_lancamento_id UUID;
  v_conta RECORD;
  v_plano RECORD;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero. Recebido: %', p_valor;
  END IF;

  SELECT id, nome, ativo INTO v_conta
  FROM contas WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada: %', p_conta_id;
  END IF;
  IF NOT v_conta.ativo THEN
    RAISE EXCEPTION 'Conta inativa: %', v_conta.nome;
  END IF;

  SELECT id, nome, tipo, ativo, automatica INTO v_plano
  FROM plano_de_contas WHERE id = p_plano_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de contas não encontrado: %', p_plano_conta_id;
  END IF;
  IF NOT v_plano.ativo THEN
    RAISE EXCEPTION 'Categoria inativa: %', v_plano.nome;
  END IF;
  IF v_plano.tipo <> 'receita' THEN
    RAISE EXCEPTION 'Categoria "%" não é do tipo receita (tipo atual: %)', 
      v_plano.nome, v_plano.tipo;
  END IF;
  IF v_plano.automatica = true THEN
    RAISE EXCEPTION 'Categoria "%" é automática e não aceita lançamento manual', 
      v_plano.nome;
  END IF;

  IF p_data > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data não pode ser futura: %', p_data;
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
$$;


ALTER FUNCTION "public"."registrar_entrada_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_pagamento_conta_a_pagar"("p_conta_a_pagar_id" "uuid", "p_valor" numeric, "p_data_pagamento" "date", "p_conta_id" "uuid", "p_metodo_pagamento" "text" DEFAULT 'pix'::"text", "p_observacao" "text" DEFAULT NULL::"text", "p_conta_credor_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_cap              RECORD;
    v_lancamento_id    UUID;
BEGIN
    -- 1. Validar que a obrigação existe e não está paga
    SELECT id, descricao, credor, valor_total, valor_pago, saldo_devedor, status, plano_conta_id
    INTO v_cap
    FROM public.contas_a_pagar
    WHERE id = p_conta_a_pagar_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta a pagar % não encontrada', p_conta_a_pagar_id;
    END IF;

    IF v_cap.status = 'pago' THEN
        RAISE EXCEPTION 'Esta obrigação já está totalmente paga';
    END IF;

    -- 2. Validar que não há overpayment
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

    -- 4. Criar lançamento de saída no fluxo de caixa (debita conta de origem)
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

    -- 5. Se conta do credor informada, criar lançamento de entrada (credita conta do credor)
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
$$;


ALTER FUNCTION "public"."registrar_pagamento_conta_a_pagar"("p_conta_a_pagar_id" "uuid", "p_valor" numeric, "p_data_pagamento" "date", "p_conta_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text", "p_conta_credor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_pagamento_venda"("p_venda_id" "uuid", "p_valor" numeric, "p_metodo" "text", "p_data" "date", "p_conta_id" "uuid", "p_observacao" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_plano_id      uuid;
    v_lancamento_id uuid;
BEGIN
    -- 1. Registra o pagamento — trigger trigger_update_venda_pagamento dispara
    --    automaticamente e recalcula vendas.valor_pago e vendas.pago
    INSERT INTO public.pagamentos_venda (venda_id, valor, data, metodo, observacao)
    VALUES (p_venda_id, p_valor, p_data::timestamptz, p_metodo, p_observacao);

    -- 2. Lookup do plano de contas por código técnico imutável
    SELECT id INTO v_plano_id
    FROM public.plano_de_contas
    WHERE codigo = 'RECEBIMENTO_VENDA'
    LIMIT 1;

    -- 3. Cria lançamento no fluxo de caixa
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
$$;


ALTER FUNCTION "public"."registrar_pagamento_venda"("p_venda_id" "uuid", "p_valor" numeric, "p_metodo" "text", "p_data" "date", "p_conta_id" "uuid", "p_observacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_total_a_receber_dashboard"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT jsonb_build_object(
        'total_a_receber',    COALESCE(SUM(total), 0),
        'total_vendas_abertas', COUNT(*)
    )
    FROM public.vendas
    WHERE pago = false
      AND status = 'entregue'
      AND forma_pagamento <> 'brinde'
      AND (origem IS NULL OR origem <> 'catalogo');
$$;


ALTER FUNCTION "public"."rpc_total_a_receber_dashboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_total_a_receber_simples"() RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT COALESCE(SUM(total), 0)
    FROM public.vendas
    WHERE pago = false
      AND status <> 'cancelada'
      AND forma_pagamento <> 'brinde';
$$;


ALTER FUNCTION "public"."rpc_total_a_receber_simples"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpt_churn"("p_dias_threshold" integer DEFAULT 60) RETURNS TABLE("contato_id" "uuid", "nome" "text", "telefone" "text", "ultima_compra" "date", "dias_sem_compra" integer, "total_historico" numeric, "qtd_pedidos" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT
        c.id                                AS contato_id,
        c.nome,
        c.telefone,
        MAX(v.data)                         AS ultima_compra,
        (CURRENT_DATE - MAX(v.data))::int   AS dias_sem_compra,
        SUM(v.total)                        AS total_historico,
        COUNT(v.id)                         AS qtd_pedidos
    FROM public.contatos c
    JOIN public.vendas v ON v.contato_id = c.id
    WHERE v.status <> 'cancelada'
      AND v.forma_pagamento <> 'brinde'
      AND c.status NOT IN ('inativo', 'bloqueado')
    GROUP BY c.id, c.nome, c.telefone
    HAVING MAX(v.data) < CURRENT_DATE - p_dias_threshold
    ORDER BY dias_sem_compra DESC;
$$;


ALTER FUNCTION "public"."rpt_churn"("p_dias_threshold" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpt_vendas_por_periodo"("p_inicio" "date", "p_fim" "date", "p_agrupamento" "text" DEFAULT 'month'::"text") RETURNS TABLE("periodo" "date", "total_vendas" bigint, "faturamento" numeric, "ticket_medio" numeric, "clientes_unicos" bigint, "total_itens" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH itens_agg AS (
        SELECT iv.venda_id, SUM(iv.quantidade) AS total_itens
        FROM public.itens_venda iv
        GROUP BY iv.venda_id
    )
    SELECT
        date_trunc(p_agrupamento, v.data::timestamptz)::date AS periodo,
        COUNT(v.id)                                          AS total_vendas,
        SUM(v.total)                                         AS faturamento,
        ROUND(AVG(v.total), 2)                               AS ticket_medio,
        COUNT(DISTINCT v.contato_id)                         AS clientes_unicos,
        COALESCE(SUM(ia.total_itens), 0)                     AS total_itens
    FROM public.vendas v
    LEFT JOIN itens_agg ia ON ia.venda_id = v.id
    WHERE v.data BETWEEN p_inicio AND p_fim
      AND v.status <> 'cancelada'
      AND v.forma_pagamento <> 'brinde'
    GROUP BY date_trunc(p_agrupamento, v.data::timestamptz)
    ORDER BY periodo;
$$;


ALTER FUNCTION "public"."rpt_vendas_por_periodo"("p_inicio" "date", "p_fim" "date", "p_agrupamento" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_venda_to_cat_pedido"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Só sincroniza se a venda veio do catálogo
    IF NEW.cat_pedido_id IS NOT NULL THEN
        UPDATE cat_pedidos SET
            status = CASE 
                WHEN NEW.status = 'cancelada' THEN 'cancelado'
                ELSE NEW.status
            END,
            status_pagamento = CASE 
                WHEN NEW.pago = true THEN 'pago'
                ELSE 'pendente'
            END,
            atualizado_em = now()
        WHERE id = NEW.cat_pedido_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_venda_to_cat_pedido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conta_a_pagar_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_valor_total  NUMERIC;
    v_total_pago   NUMERIC;
    v_cap_id       UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_cap_id := OLD.conta_a_pagar_id;
    ELSE
        v_cap_id := NEW.conta_a_pagar_id;
    END IF;

    SELECT valor_total INTO v_valor_total
    FROM public.contas_a_pagar
    WHERE id = v_cap_id;

    SELECT COALESCE(SUM(valor), 0) INTO v_total_pago
    FROM public.pagamentos_conta_a_pagar
    WHERE conta_a_pagar_id = v_cap_id;

    UPDATE public.contas_a_pagar
    SET
        valor_pago = v_total_pago,
        status = CASE
            WHEN ROUND(v_total_pago::numeric, 2) >= ROUND(v_valor_total::numeric, 2) THEN 'pago'
            WHEN v_total_pago > 0 THEN 'parcial'
            ELSE 'pendente'
        END
    WHERE id = v_cap_id;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_conta_a_pagar_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conta_saldo_lancamento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Debita ou credita conta_id conforme tipo
        UPDATE contas
        SET saldo_atual = COALESCE(saldo_atual, 0) +
            CASE WHEN NEW.tipo = 'entrada' THEN NEW.valor ELSE -NEW.valor END
        WHERE id = NEW.conta_id;

        -- Transferência: credita também a conta de destino
        IF NEW.tipo = 'transferencia' AND NEW.conta_destino_id IS NOT NULL THEN
            UPDATE contas
            SET saldo_atual = COALESCE(saldo_atual, 0) + NEW.valor
            WHERE id = NEW.conta_destino_id;
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        -- Reverte o efeito em conta_id
        UPDATE contas
        SET saldo_atual = COALESCE(saldo_atual, 0) -
            CASE WHEN OLD.tipo = 'entrada' THEN OLD.valor ELSE -OLD.valor END
        WHERE id = OLD.conta_id;

        -- Transferência: reverte o crédito do destino
        IF OLD.tipo = 'transferencia' AND OLD.conta_destino_id IS NOT NULL THEN
            UPDATE contas
            SET saldo_atual = COALESCE(saldo_atual, 0) - OLD.valor
            WHERE id = OLD.conta_destino_id;
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Reverte completamente o estado antigo
        UPDATE contas
        SET saldo_atual = COALESCE(saldo_atual, 0) -
            CASE WHEN OLD.tipo = 'entrada' THEN OLD.valor ELSE -OLD.valor END
        WHERE id = OLD.conta_id;

        IF OLD.tipo = 'transferencia' AND OLD.conta_destino_id IS NOT NULL THEN
            UPDATE contas
            SET saldo_atual = COALESCE(saldo_atual, 0) - OLD.valor
            WHERE id = OLD.conta_destino_id;
        END IF;

        -- Aplica o novo estado
        UPDATE contas
        SET saldo_atual = COALESCE(saldo_atual, 0) +
            CASE WHEN NEW.tipo = 'entrada' THEN NEW.valor ELSE -NEW.valor END
        WHERE id = NEW.conta_id;

        IF NEW.tipo = 'transferencia' AND NEW.conta_destino_id IS NOT NULL THEN
            UPDATE contas
            SET saldo_atual = COALESCE(saldo_atual, 0) + NEW.valor
            WHERE id = NEW.conta_destino_id;
        END IF;

    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_conta_saldo_lancamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conta_saldo_po_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.conta_id IS NOT NULL) THEN
            UPDATE contas SET saldo_atual = COALESCE(saldo_atual, 0) - NEW.amount
            WHERE id = NEW.conta_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.conta_id IS NOT NULL) THEN
            UPDATE contas SET saldo_atual = COALESCE(saldo_atual, 0) + OLD.amount
            WHERE id = OLD.conta_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.conta_id IS NOT NULL) THEN
            UPDATE contas SET saldo_atual = COALESCE(saldo_atual, 0) + OLD.amount
            WHERE id = OLD.conta_id;
        END IF;
        IF (NEW.conta_id IS NOT NULL) THEN
            UPDATE contas SET saldo_atual = COALESCE(saldo_atual, 0) - NEW.amount
            WHERE id = NEW.conta_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_conta_saldo_po_payment"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_conta_saldo_po_payment"() IS 'Dívida Técnica: Este trigger debita/credita saldo da conta diretamente ao inserir/deletar
purchase_order_payments, SEM gerar lançamento na tabela lancamentos. Diferente do módulo
Contas a Pagar, que gera lançamentos via RPC registrar_pagamento_conta_a_pagar.
A view_extrato_mensal usa UNION para consolidar ambos os fluxos.
Ref: Auditoria Financeira 2026-03-21';



CREATE OR REPLACE FUNCTION "public"."update_purchase_order_payment_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_total_amount NUMERIC;
    v_total_paid   NUMERIC;
    v_purchase_order_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_purchase_order_id := OLD.purchase_order_id;
    ELSE
        v_purchase_order_id := NEW.purchase_order_id;
    END IF;

    SELECT total_amount INTO v_total_amount
    FROM public.purchase_orders
    WHERE id = v_purchase_order_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.purchase_order_payments
    WHERE purchase_order_id = v_purchase_order_id;

    UPDATE public.purchase_orders
    SET
        amount_paid    = v_total_paid,
        payment_status = CASE
            -- CORREÇÃO: ROUND evita erro de floating point (ex: 4229.9999... vs 4230.00)
            WHEN ROUND(v_total_paid::numeric, 2) >= ROUND(v_total_amount::numeric, 2) THEN 'paid'::purchase_order_payment_status
            WHEN v_total_paid > 0                                                      THEN 'partial'::purchase_order_payment_status
            ELSE                                                                            'unpaid'::purchase_order_payment_status
        END
    WHERE id = v_purchase_order_id;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_purchase_order_payment_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_purchase_order_with_items"("p_order_id" "uuid", "p_fornecedor_id" "uuid", "p_order_date" "date", "p_total_amount" numeric, "p_notes" "text", "p_status" "text", "p_payment_status" "text", "p_items" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
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
$$;


ALTER FUNCTION "public"."update_purchase_order_with_items"("p_order_id" "uuid", "p_fornecedor_id" "uuid", "p_order_date" "date", "p_total_amount" numeric, "p_notes" "text", "p_status" "text", "p_payment_status" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_venda_pagamento_summary"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_venda_id uuid;
BEGIN
    -- Para UPDATE onde venda_id muda (raro mas possível): recalcula as duas vendas
    IF TG_OP = 'UPDATE' AND OLD.venda_id IS DISTINCT FROM NEW.venda_id THEN
        UPDATE public.vendas v
        SET
            valor_pago = COALESCE((SELECT SUM(p.valor) FROM public.pagamentos_venda p WHERE p.venda_id = OLD.venda_id), 0),
            pago       = COALESCE((SELECT SUM(p.valor) FROM public.pagamentos_venda p WHERE p.venda_id = OLD.venda_id), 0) >= v.total
        WHERE v.id = OLD.venda_id;

        UPDATE public.vendas v
        SET
            valor_pago = COALESCE((SELECT SUM(p.valor) FROM public.pagamentos_venda p WHERE p.venda_id = NEW.venda_id), 0),
            pago       = COALESCE((SELECT SUM(p.valor) FROM public.pagamentos_venda p WHERE p.venda_id = NEW.venda_id), 0) >= v.total
        WHERE v.id = NEW.venda_id;

        RETURN NULL;
    END IF;

    -- Determina a venda afetada
    IF TG_OP = 'DELETE' THEN
        v_venda_id := OLD.venda_id;
    ELSE
        v_venda_id := NEW.venda_id;
    END IF;

    -- Recalcula a partir da fonte da verdade (SUM real, não incremental)
    UPDATE public.vendas v
    SET
        valor_pago = COALESCE((SELECT SUM(p.valor) FROM public.pagamentos_venda p WHERE p.venda_id = v_venda_id), 0),
        pago       = COALESCE((SELECT SUM(p.valor) FROM public.pagamentos_venda p WHERE p.venda_id = v_venda_id), 0) >= v.total
    WHERE v.id = v_venda_id;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_venda_pagamento_summary"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()),
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cat_imagens_produto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "tipo" character varying(20) DEFAULT 'cover'::character varying NOT NULL,
    "alt_text" "text",
    "ordem" integer DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_tipo_imagem" CHECK ((("tipo")::"text" = ANY ((ARRAY['cover'::character varying, 'front'::character varying, 'back'::character varying, 'side'::character varying, 'label'::character varying, 'detail'::character varying, 'ambient'::character varying, 'pack'::character varying])::"text"[])))
);


ALTER TABLE "public"."cat_imagens_produto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cat_itens_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid",
    "produto_id" "uuid",
    "nome_produto" "text" NOT NULL,
    "quantidade" integer NOT NULL,
    "preco_unitario" numeric,
    "total" numeric
);


ALTER TABLE "public"."cat_itens_pedido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cat_pedidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_pedido" integer NOT NULL,
    "nome_cliente" "text" NOT NULL,
    "telefone_cliente" "text" NOT NULL,
    "endereco_entrega" "text",
    "metodo_entrega" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "metodo_pagamento" "text",
    "status_pagamento" "text" DEFAULT 'pendente'::"text",
    "observacoes" "text",
    "indicado_por" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "contato_id" "uuid",
    "subtotal" numeric,
    "frete" numeric,
    "total" numeric,
    CONSTRAINT "cat_pedidos_metodo_entrega_check" CHECK (("metodo_entrega" = ANY (ARRAY['entrega'::"text", 'retirada'::"text"]))),
    CONSTRAINT "cat_pedidos_metodo_pagamento_check" CHECK (("metodo_pagamento" = ANY (ARRAY['pix'::"text", 'dinheiro'::"text", 'cartao'::"text", 'fiado'::"text"]))),
    CONSTRAINT "cat_pedidos_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'confirmado'::"text", 'preparando'::"text", 'enviado'::"text", 'entregue'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "cat_pedidos_status_pagamento_check" CHECK (("status_pagamento" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'parcial'::"text"])))
);


ALTER TABLE "public"."cat_pedidos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_pedidos_numero_pedido_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_pedidos_numero_pedido_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_pedidos_numero_pedido_seq" OWNED BY "public"."cat_pedidos"."numero_pedido";



CREATE TABLE IF NOT EXISTS "public"."cat_pedidos_pendentes_vinculacao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cat_pedido_id" "uuid" NOT NULL,
    "motivo_falha" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cat_pedidos_pendentes_vinculacao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chave" "text" NOT NULL,
    "valor" "jsonb" NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."configuracoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "saldo_inicial" numeric DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "created_by" "uuid",
    "updated_by" "uuid",
    "saldo_atual" numeric DEFAULT 0,
    "banco" "text",
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "codigo" "text",
    CONSTRAINT "contas_tipo_check" CHECK (("tipo" = ANY (ARRAY['dinheiro'::"text", 'pix'::"text", 'banco'::"text"])))
);


ALTER TABLE "public"."contas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contas_a_pagar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "descricao" "text" NOT NULL,
    "credor" "text" NOT NULL,
    "valor_total" numeric(12,2) NOT NULL,
    "valor_pago" numeric(12,2) DEFAULT 0 NOT NULL,
    "saldo_devedor" numeric(12,2) GENERATED ALWAYS AS (("valor_total" - "valor_pago")) STORED,
    "data_emissao" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_vencimento" "date" NOT NULL,
    "parcela_atual" integer DEFAULT 1,
    "total_parcelas" integer DEFAULT 1,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "plano_conta_id" "uuid" NOT NULL,
    "referencia" "text",
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contas_a_pagar_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'parcial'::"text", 'pago'::"text", 'vencido'::"text"]))),
    CONSTRAINT "contas_a_pagar_valor_total_check" CHECK (("valor_total" > (0)::numeric))
);


ALTER TABLE "public"."contas_a_pagar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contatos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "telefone" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "subtipo" "text",
    "status" "text" DEFAULT 'lead'::"text" NOT NULL,
    "origem" "text" DEFAULT 'direto'::"text" NOT NULL,
    "indicado_por_id" "uuid",
    "endereco" "text",
    "bairro" "text",
    "observacoes" "text",
    "ultimo_contato" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cep" "text",
    "latitude" double precision,
    "longitude" double precision,
    "apelido" "text",
    "logradouro" "text",
    "numero" "text",
    "complemento" "text",
    "cidade" "text",
    "uf" "text",
    "fts" "tsvector" GENERATED ALWAYS AS ((((("setweight"("to_tsvector"('"portuguese"'::"regconfig", COALESCE("nome", ''::"text")), 'A'::"char") || "setweight"("to_tsvector"('"portuguese"'::"regconfig", COALESCE("apelido", ''::"text")), 'B'::"char")) || "setweight"("to_tsvector"('"simple"'::"regconfig", COALESCE("telefone", ''::"text")), 'A'::"char")) || "setweight"("to_tsvector"('"portuguese"'::"regconfig", COALESCE("bairro", ''::"text")), 'C'::"char")) || "setweight"("to_tsvector"('"portuguese"'::"regconfig", COALESCE("logradouro", ''::"text")), 'C'::"char"))) STORED,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "contatos_origem_check" CHECK (("origem" = ANY (ARRAY['direto'::"text", 'indicacao'::"text", 'catalogo'::"text"]))),
    CONSTRAINT "contatos_status_check" CHECK (("status" = ANY (ARRAY['lead'::"text", 'cliente'::"text", 'inativo'::"text", 'fornecedor'::"text"]))),
    CONSTRAINT "contatos_tipo_check" CHECK (("tipo" = ANY (ARRAY['B2C'::"text", 'B2B'::"text", 'FORNECEDOR'::"text", 'catalogo'::"text"])))
);


ALTER TABLE "public"."contatos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contato_id" "uuid" NOT NULL,
    "data" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_entrega" "date",
    "total" numeric(10,2) NOT NULL,
    "forma_pagamento" "text" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pago" boolean DEFAULT false NOT NULL,
    "taxa_entrega" numeric DEFAULT 0,
    "parcelas" smallint DEFAULT 1,
    "data_prevista_pagamento" "date",
    "custo_total" numeric DEFAULT 0,
    "valor_pago" numeric DEFAULT 0,
    "origem" "text" DEFAULT 'direto'::"text",
    "cat_pedido_id" "uuid",
    "fts" "tsvector" GENERATED ALWAYS AS (("setweight"("to_tsvector"('"simple"'::"regconfig", SUBSTRING(("id")::"text" FROM 1 FOR 8)), 'A'::"char") || "setweight"("to_tsvector"('"portuguese"'::"regconfig", COALESCE("observacoes", ''::"text")), 'B'::"char"))) STORED,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "vendas_forma_pagamento_check" CHECK (("forma_pagamento" = ANY (ARRAY['pix'::"text", 'dinheiro'::"text", 'cartao'::"text", 'fiado'::"text", 'brinde'::"text", 'pre_venda'::"text"]))),
    CONSTRAINT "vendas_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'entregue'::"text", 'cancelada'::"text"])))
);


ALTER TABLE "public"."vendas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."crm_view_monthly_sales" WITH ("security_invoker"='true') AS
 SELECT EXTRACT(year FROM "data") AS "ano",
    EXTRACT(month FROM "data") AS "mes",
    COALESCE("sum"("total"), (0)::numeric) AS "faturamento",
    COALESCE("sum"("custo_total"), (0)::numeric) AS "custo_total",
    COALESCE(("sum"("total") - "sum"("custo_total")), (0)::numeric) AS "lucro",
    "count"(*) AS "total_vendas",
    COALESCE("avg"("total"), (0)::numeric) AS "ticket_medio"
   FROM "public"."vendas"
  WHERE (("status" <> 'cancelada'::"text") AND ("forma_pagamento" <> 'brinde'::"text"))
  GROUP BY (EXTRACT(year FROM "data")), (EXTRACT(month FROM "data"));


ALTER VIEW "public"."crm_view_monthly_sales" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."crm_view_operational_snapshot" AS
 WITH "agg" AS (
         SELECT COALESCE("sum"(("vendas"."total" - "vendas"."valor_pago")) FILTER (WHERE (("vendas"."pago" = false) AND ("vendas"."status" <> 'cancelada'::"text") AND ("vendas"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) AS "total_a_receber",
            "count"(*) FILTER (WHERE ("vendas"."status" = 'pendente'::"text")) AS "entregas_pendentes_total",
            "count"(*) FILTER (WHERE (("vendas"."status" = 'pendente'::"text") AND ("vendas"."data_entrega" = CURRENT_DATE))) AS "entregas_hoje_pendentes",
            "count"(*) FILTER (WHERE (("vendas"."status" = 'entregue'::"text") AND ("vendas"."data_entrega" = CURRENT_DATE))) AS "entregas_hoje_realizadas"
           FROM "public"."vendas"
        ), "clientes" AS (
         SELECT "count"(*) AS "clientes_ativos"
           FROM "public"."contatos"
          WHERE ("contatos"."status" = 'cliente'::"text")
        )
 SELECT "a"."total_a_receber",
    "a"."entregas_pendentes_total",
    "a"."entregas_hoje_pendentes",
    "a"."entregas_hoje_realizadas",
    "c"."clientes_ativos"
   FROM ("agg" "a"
     CROSS JOIN "clientes" "c");


ALTER VIEW "public"."crm_view_operational_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itens_venda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venda_id" "uuid" NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "quantidade" numeric(10,3) NOT NULL,
    "preco_unitario" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "custo_unitario" numeric DEFAULT 0
);


ALTER TABLE "public"."itens_venda" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "valor" numeric NOT NULL,
    "data" "date" DEFAULT CURRENT_DATE NOT NULL,
    "descricao" "text",
    "conta_id" "uuid" NOT NULL,
    "conta_destino_id" "uuid",
    "plano_conta_id" "uuid",
    "origem" "text" NOT NULL,
    "venda_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "created_by" "uuid",
    "updated_by" "uuid",
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_lancamentos_origem" CHECK (("origem" = ANY (ARRAY['manual'::"text", 'venda'::"text", 'brinde'::"text", 'migracao_historica'::"text", 'transferencia'::"text", 'contas_a_pagar'::"text"]))),
    CONSTRAINT "lancamentos_tipo_check" CHECK (("tipo" = ANY (ARRAY['entrada'::"text", 'saida'::"text", 'transferencia'::"text"])))
);


ALTER TABLE "public"."lancamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos_conta_a_pagar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conta_a_pagar_id" "uuid" NOT NULL,
    "valor" numeric(12,2) NOT NULL,
    "data_pagamento" "date" DEFAULT CURRENT_DATE NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "metodo_pagamento" "text" DEFAULT 'pix'::"text" NOT NULL,
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    CONSTRAINT "pagamentos_conta_a_pagar_metodo_pagamento_check" CHECK (("metodo_pagamento" = ANY (ARRAY['dinheiro'::"text", 'pix'::"text", 'transferencia'::"text"]))),
    CONSTRAINT "pagamentos_conta_a_pagar_valor_check" CHECK (("valor" > (0)::numeric))
);


ALTER TABLE "public"."pagamentos_conta_a_pagar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos_venda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venda_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "data" timestamp with time zone DEFAULT "now"() NOT NULL,
    "observacao" "text",
    "metodo" "text" DEFAULT 'pix'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pagamentos_venda_valor_check" CHECK (("valor" > (0)::numeric))
);


ALTER TABLE "public"."pagamentos_venda" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plano_de_contas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "automatica" boolean DEFAULT false,
    "codigo" "text",
    CONSTRAINT "plano_de_contas_categoria_check" CHECK (("categoria" = ANY (ARRAY['fixa'::"text", 'variavel'::"text"]))),
    CONSTRAINT "plano_de_contas_tipo_check" CHECK (("tipo" = ANY (ARRAY['receita'::"text", 'despesa'::"text"])))
);


ALTER TABLE "public"."plano_de_contas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "codigo" "text" NOT NULL,
    "preco" numeric(10,2) NOT NULL,
    "custo" numeric(10,2) NOT NULL,
    "unidade" "text" DEFAULT 'kg'::"text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estoque_atual" integer DEFAULT 0,
    "apelido" "text",
    "estoque_minimo" integer DEFAULT 10,
    "slug" "text",
    "descricao" "text",
    "categoria" "text",
    "peso_kg" numeric(10,3),
    "destaque" boolean DEFAULT false,
    "visivel_catalogo" boolean DEFAULT true NOT NULL,
    "preco_ancoragem" numeric,
    "subtitulo" "text",
    "instrucoes_preparo" "text"
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_cost" numeric(10,2) NOT NULL,
    "total_cost" numeric(10,2) GENERATED ALWAYS AS ((("quantity")::numeric * "unit_cost")) STORED,
    CONSTRAINT "purchase_order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "purchase_order_items_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "payment_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_method" "text" DEFAULT 'pix'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_order_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "public"."purchase_order_status" DEFAULT 'pending'::"public"."purchase_order_status" NOT NULL,
    "payment_status" "public"."purchase_order_payment_status" DEFAULT 'unpaid'::"public"."purchase_order_payment_status" NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "data_recebimento" timestamp with time zone,
    "amount_paid" numeric(10,2) DEFAULT 0,
    "fornecedor_id" "uuid" NOT NULL
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ranking_compras" AS
 SELECT "c"."id" AS "contato_id",
    "c"."nome",
    COALESCE("sum"("v"."total"), (0)::numeric) AS "total_pontos",
    "count"("v"."id") AS "total_compras",
    "max"("v"."data") AS "ultima_compra"
   FROM ("public"."contatos" "c"
     JOIN "public"."vendas" "v" ON (("v"."contato_id" = "c"."id")))
  WHERE (("v"."status" = 'entregue'::"text") AND ("v"."pago" = true) AND ("v"."forma_pagamento" <> 'brinde'::"text"))
  GROUP BY "c"."id", "c"."nome"
 HAVING ("sum"("v"."total") > (0)::numeric);


ALTER VIEW "public"."ranking_compras" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ranking_indicacoes" AS
 SELECT "i"."id" AS "indicador_id",
    "i"."nome",
    "count"(DISTINCT "c"."id") AS "total_indicados",
    COALESCE("sum"("v"."total"), (0)::numeric) AS "total_vendas_indicados"
   FROM (("public"."contatos" "i"
     JOIN "public"."contatos" "c" ON (("c"."indicado_por_id" = "i"."id")))
     LEFT JOIN "public"."vendas" "v" ON ((("v"."contato_id" = "c"."id") AND ("v"."status" = 'entregue'::"text") AND ("v"."pago" = true) AND ("v"."forma_pagamento" <> 'brinde'::"text"))))
  GROUP BY "i"."id", "i"."nome"
 HAVING ("count"("c"."id") > 0);


ALTER VIEW "public"."ranking_indicacoes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_lucro_liquido_mensal" WITH ("security_invoker"='true') AS
 WITH "meses" AS (
         SELECT ("date_trunc"('month'::"text", ("vendas"."data")::timestamp with time zone))::"date" AS "mes"
           FROM "public"."vendas"
          GROUP BY (("date_trunc"('month'::"text", ("vendas"."data")::timestamp with time zone))::"date")
        ), "desp_op" AS (
         SELECT ("date_trunc"('month'::"text", ("lancamentos"."data")::timestamp with time zone))::"date" AS "mes",
            "sum"("lancamentos"."valor") AS "despesas_operacionais"
           FROM "public"."lancamentos"
          WHERE (("lancamentos"."tipo" = 'saida'::"text") AND ("lancamentos"."origem" <> ALL (ARRAY['migracao_historica'::"text", 'compra_fabrica'::"text"])))
          GROUP BY (("date_trunc"('month'::"text", ("lancamentos"."data")::timestamp with time zone))::"date")
        ), "custo_fab" AS (
         SELECT ("date_trunc"('month'::"text", "purchase_order_payments"."payment_date"))::"date" AS "mes",
            "sum"("purchase_order_payments"."amount") AS "custo_fabrica"
           FROM "public"."purchase_order_payments"
          GROUP BY (("date_trunc"('month'::"text", "purchase_order_payments"."payment_date"))::"date")
        )
 SELECT "m"."mes",
    COALESCE("sum"("v"."total") FILTER (WHERE (("v"."status" = 'entregue'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) AS "receita_bruta",
    COALESCE("sum"("v"."custo_total") FILTER (WHERE (("v"."status" = 'entregue'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) AS "custo_produtos",
    COALESCE("sum"(("v"."total" - "v"."custo_total")) FILTER (WHERE (("v"."status" = 'entregue'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) AS "lucro_bruto",
    COALESCE("d"."despesas_operacionais", (0)::numeric) AS "despesas_operacionais",
    COALESCE("f"."custo_fabrica", (0)::numeric) AS "custo_fabrica",
    (COALESCE("sum"(("v"."total" - "v"."custo_total")) FILTER (WHERE (("v"."status" = 'entregue'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) - COALESCE("d"."despesas_operacionais", (0)::numeric)) AS "lucro_liquido",
        CASE
            WHEN ("sum"("v"."total") FILTER (WHERE (("v"."status" = 'entregue'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))) > (0)::numeric) THEN "round"((((COALESCE("sum"(("v"."total" - "v"."custo_total")) FILTER (WHERE (("v"."status" = 'entregue'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) - COALESCE("d"."despesas_operacionais", (0)::numeric)) / NULLIF("sum"("v"."total") FILTER (WHERE (("v"."status" = 'entregue'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric)) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "margem_liquida_pct"
   FROM ((("meses" "m"
     LEFT JOIN "public"."vendas" "v" ON ((("date_trunc"('month'::"text", ("v"."data")::timestamp with time zone))::"date" = "m"."mes")))
     LEFT JOIN "desp_op" "d" ON (("d"."mes" = "m"."mes")))
     LEFT JOIN "custo_fab" "f" ON (("f"."mes" = "m"."mes")))
  GROUP BY "m"."mes", "d"."despesas_operacionais", "f"."custo_fabrica"
  ORDER BY "m"."mes" DESC;


ALTER VIEW "public"."view_lucro_liquido_mensal" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_break_even_mensal" WITH ("security_invoker"='true') AS
 SELECT "mes",
    "receita_bruta",
    "custo_produtos",
    "lucro_bruto",
    "despesas_operacionais",
    "custo_fabrica",
    "lucro_liquido",
    "margem_liquida_pct",
        CASE
            WHEN ("receita_bruta" > (0)::numeric) THEN "round"(((("receita_bruta" - "custo_produtos") / "receita_bruta") * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "margem_contribuicao_pct",
        CASE
            WHEN (("receita_bruta" - "custo_produtos") > (0)::numeric) THEN "round"(("despesas_operacionais" / (("receita_bruta" - "custo_produtos") / "receita_bruta")), 2)
            ELSE NULL::numeric
        END AS "break_even_receita",
        CASE
            WHEN ("despesas_operacionais" > (0)::numeric) THEN "round"(("receita_bruta" / "despesas_operacionais"), 2)
            ELSE NULL::numeric
        END AS "cobertura_despesas"
   FROM "public"."view_lucro_liquido_mensal" "lm";


ALTER VIEW "public"."rpt_break_even_mensal" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_distribuicao_forma_pagamento" WITH ("security_invoker"='true') AS
 SELECT "forma_pagamento",
    "count"(*) AS "total_vendas",
    "sum"("total") AS "faturamento",
    "round"(((("count"(*))::numeric / "sum"("count"(*)) OVER ()) * (100)::numeric), 2) AS "pct_contagem",
    "round"((("sum"("total") / "sum"("sum"("total")) OVER ()) * (100)::numeric), 2) AS "pct_faturamento",
    "count"(*) FILTER (WHERE ("pago" = true)) AS "vendas_liquidadas",
    "count"(*) FILTER (WHERE ("pago" = false)) AS "vendas_pendentes"
   FROM "public"."vendas"
  WHERE (("status" <> 'cancelada'::"text") AND ("forma_pagamento" <> 'brinde'::"text"))
  GROUP BY "forma_pagamento"
  ORDER BY ("sum"("total")) DESC;


ALTER VIEW "public"."rpt_distribuicao_forma_pagamento" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_home_financeiro" WITH ("security_invoker"='true') AS
 WITH "mensais" AS (
         SELECT (EXTRACT(year FROM "vendas"."data"))::integer AS "ano",
            (EXTRACT(month FROM "vendas"."data"))::integer AS "mes",
            COALESCE("sum"("vendas"."total") FILTER (WHERE (("vendas"."status" = 'entregue'::"text") AND ("vendas"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) AS "faturamento",
            COALESCE("avg"("vendas"."total") FILTER (WHERE (("vendas"."status" = 'entregue'::"text") AND ("vendas"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) AS "ticket_medio",
            COALESCE("sum"(("vendas"."total" - "vendas"."custo_total")) FILTER (WHERE (("vendas"."status" = 'entregue'::"text") AND ("vendas"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) AS "lucro_estimado",
            COALESCE("sum"(("vendas"."total" - "vendas"."valor_pago")) FILTER (WHERE (("vendas"."status" = 'entregue'::"text") AND ("vendas"."pago" = false) AND ("vendas"."forma_pagamento" <> 'brinde'::"text"))), (0)::numeric) AS "total_a_receber",
            COALESCE("sum"("vendas"."total") FILTER (WHERE (("vendas"."pago" = true) AND ("vendas"."status" = 'entregue'::"text") AND ("vendas"."forma_pagamento" <> 'brinde'::"text") AND (("vendas"."origem" IS NULL) OR ("vendas"."origem" <> 'catalogo'::"text")))), (0)::numeric) AS "caixa_mes",
            (COALESCE("count"(*) FILTER (WHERE (("vendas"."pago" = true) AND ("vendas"."status" = 'entregue'::"text") AND ("vendas"."forma_pagamento" <> 'brinde'::"text") AND (("vendas"."origem" IS NULL) OR ("vendas"."origem" <> 'catalogo'::"text")))), (0)::bigint))::integer AS "caixa_mes_count"
           FROM "public"."vendas"
          GROUP BY (EXTRACT(year FROM "vendas"."data")), (EXTRACT(month FROM "vendas"."data"))
        ), "com_lag" AS (
         SELECT "mensais"."ano",
            "mensais"."mes",
            "mensais"."faturamento",
            "mensais"."ticket_medio",
            "mensais"."lucro_estimado",
            "mensais"."total_a_receber",
            "mensais"."caixa_mes",
            "mensais"."caixa_mes_count",
            "lag"("mensais"."faturamento") OVER (ORDER BY "mensais"."ano", "mensais"."mes") AS "faturamento_anterior_val"
           FROM "mensais"
        ), "alertas" AS (
         SELECT "json_agg"("json_build_object"('venda_id', "v"."id", 'valor', "v"."total", 'vencimento', "v"."data_prevista_pagamento", 'contato_nome', "c"."nome", 'contato_telefone', "c"."telefone")) AS "financeiros"
           FROM ("public"."vendas" "v"
             JOIN "public"."contatos" "c" ON (("c"."id" = "v"."contato_id")))
          WHERE (("v"."pago" = false) AND ("v"."status" = 'entregue'::"text") AND ("v"."data_prevista_pagamento" < CURRENT_DATE) AND ("v"."forma_pagamento" <> 'brinde'::"text"))
        )
 SELECT "ano",
    "mes",
    "faturamento",
    "ticket_medio",
    "lucro_estimado",
    "total_a_receber",
    "caixa_mes" AS "liquidado_mes",
    "caixa_mes_count" AS "liquidado_mes_count",
    COALESCE("faturamento_anterior_val", (0)::numeric) AS "faturamento_anterior",
        CASE
            WHEN (COALESCE("faturamento_anterior_val", (0)::numeric) > (0)::numeric) THEN ((("faturamento" - "faturamento_anterior_val") / "faturamento_anterior_val") * (100)::numeric)
            ELSE (0)::numeric
        END AS "variacao_faturamento_percentual",
    COALESCE(( SELECT "alertas"."financeiros"
           FROM "alertas"), '[]'::json) AS "alertas_financeiros"
   FROM "com_lag" "cl";


ALTER VIEW "public"."view_home_financeiro" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_faturamento_comparativo" WITH ("security_invoker"='true') AS
 SELECT "ano",
    "mes",
    "faturamento",
    "faturamento_anterior",
    "variacao_faturamento_percentual",
    "lucro_estimado",
    "liquidado_mes",
    "total_a_receber",
        CASE
            WHEN ("faturamento" > (0)::numeric) THEN "round"((("lucro_estimado" / "faturamento") * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "margem_bruta_pct"
   FROM "public"."view_home_financeiro" "hf"
  ORDER BY "ano", "mes";


ALTER VIEW "public"."rpt_faturamento_comparativo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_giro_estoque" WITH ("security_invoker"='true') AS
 WITH "vendas_por_produto" AS (
         SELECT "iv"."produto_id",
            "sum"("iv"."quantidade") AS "total_vendido"
           FROM ("public"."itens_venda" "iv"
             JOIN "public"."vendas" "v" ON (("v"."id" = "iv"."venda_id")))
          WHERE (("v"."status" <> 'cancelada'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))
          GROUP BY "iv"."produto_id"
        ), "compras_por_produto" AS (
         SELECT "poi"."product_id" AS "produto_id",
            "sum"("poi"."quantity") AS "total_comprado"
           FROM ("public"."purchase_order_items" "poi"
             JOIN "public"."purchase_orders" "po" ON (("po"."id" = "poi"."purchase_order_id")))
          WHERE ("po"."status" <> 'cancelled'::"public"."purchase_order_status")
          GROUP BY "poi"."product_id"
        )
 SELECT "p"."id" AS "produto_id",
    "p"."nome",
    "p"."codigo",
    "p"."estoque_atual",
    "p"."estoque_minimo",
    COALESCE("vp"."total_vendido", (0)::numeric) AS "total_vendido_historico",
    COALESCE("cp"."total_comprado", (0)::bigint) AS "total_comprado_historico",
        CASE
            WHEN (COALESCE("p"."estoque_atual", 0) > 0) THEN "round"((COALESCE("vp"."total_vendido", (0)::numeric) / ("p"."estoque_atual")::numeric), 2)
            ELSE NULL::numeric
        END AS "giro_estoque",
        CASE
            WHEN (COALESCE("p"."estoque_atual", 0) = 0) THEN 'zerado'::"text"
            WHEN (("p"."estoque_minimo" IS NOT NULL) AND ("p"."estoque_atual" <= "p"."estoque_minimo")) THEN 'abaixo_minimo'::"text"
            ELSE 'ok'::"text"
        END AS "status_estoque"
   FROM (("public"."produtos" "p"
     LEFT JOIN "vendas_por_produto" "vp" ON (("vp"."produto_id" = "p"."id")))
     LEFT JOIN "compras_por_produto" "cp" ON (("cp"."produto_id" = "p"."id")))
  WHERE ("p"."ativo" = true)
  ORDER BY
        CASE
            WHEN (COALESCE("p"."estoque_atual", 0) > 0) THEN "round"((COALESCE("vp"."total_vendido", (0)::numeric) / ("p"."estoque_atual")::numeric), 2)
            ELSE NULL::numeric
        END DESC NULLS LAST;


ALTER VIEW "public"."rpt_giro_estoque" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_ltv_por_cliente" WITH ("security_invoker"='true') AS
 SELECT "c"."id" AS "contato_id",
    "c"."nome",
    "c"."telefone",
    "c"."tipo",
    "c"."status",
    "count"("v"."id") AS "total_pedidos",
    "sum"("v"."total") AS "ltv_total",
    "round"("avg"("v"."total"), 2) AS "ticket_medio",
    "min"("v"."data") AS "primeira_compra",
    "max"("v"."data") AS "ultima_compra",
    ("max"("v"."data") - "min"("v"."data")) AS "dias_relacionamento"
   FROM ("public"."contatos" "c"
     JOIN "public"."vendas" "v" ON (("v"."contato_id" = "c"."id")))
  WHERE (("v"."status" <> 'cancelada'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))
  GROUP BY "c"."id", "c"."nome", "c"."telefone", "c"."tipo", "c"."status"
  ORDER BY ("sum"("v"."total")) DESC;


ALTER VIEW "public"."rpt_ltv_por_cliente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_margem_por_sku" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "produto_id",
    "p"."nome",
    "p"."codigo",
    "p"."unidade",
    "sum"("iv"."quantidade") AS "total_vendido",
    "sum"("iv"."subtotal") AS "receita_total",
    "sum"(("iv"."quantidade" * "iv"."custo_unitario")) AS "custo_total",
    ("sum"("iv"."subtotal") - "sum"(("iv"."quantidade" * "iv"."custo_unitario"))) AS "lucro_bruto",
        CASE
            WHEN ("sum"("iv"."subtotal") > (0)::numeric) THEN "round"(((("sum"("iv"."subtotal") - "sum"(("iv"."quantidade" * "iv"."custo_unitario"))) / "sum"("iv"."subtotal")) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "margem_pct"
   FROM (("public"."itens_venda" "iv"
     JOIN "public"."vendas" "v" ON (("v"."id" = "iv"."venda_id")))
     JOIN "public"."produtos" "p" ON (("p"."id" = "iv"."produto_id")))
  WHERE (("v"."status" <> 'cancelada'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))
  GROUP BY "p"."id", "p"."nome", "p"."codigo", "p"."unidade"
  ORDER BY ("sum"("iv"."subtotal") - "sum"(("iv"."quantidade" * "iv"."custo_unitario"))) DESC;


ALTER VIEW "public"."rpt_margem_por_sku" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_prazo_medio_recebimento" WITH ("security_invoker"='true') AS
 WITH "prazo_por_venda" AS (
         SELECT "v"."id",
            "v"."data" AS "data_venda",
            (("min"("pv"."data"))::"date" - "v"."data") AS "dias_prazo"
           FROM ("public"."vendas" "v"
             JOIN "public"."pagamentos_venda" "pv" ON (("pv"."venda_id" = "v"."id")))
          WHERE (("v"."pago" = true) AND ("v"."forma_pagamento" <> 'brinde'::"text") AND ("v"."status" <> 'cancelada'::"text"))
          GROUP BY "v"."id", "v"."data"
        )
 SELECT ("date_trunc"('month'::"text", ("data_venda")::timestamp with time zone))::"date" AS "mes",
    "count"(*) AS "vendas_liquidadas",
    "round"("avg"("dias_prazo")) AS "prazo_medio_dias",
    "count"(*) FILTER (WHERE ("dias_prazo" = 0)) AS "pagamento_imediato",
    "count"(*) FILTER (WHERE (("dias_prazo" >= 1) AND ("dias_prazo" <= 7))) AS "pago_1_7_dias",
    "count"(*) FILTER (WHERE (("dias_prazo" >= 8) AND ("dias_prazo" <= 30))) AS "pago_8_30_dias",
    "count"(*) FILTER (WHERE ("dias_prazo" > 30)) AS "pago_mais_30_dias"
   FROM "prazo_por_venda"
  GROUP BY ("date_trunc"('month'::"text", ("data_venda")::timestamp with time zone))
  ORDER BY (("date_trunc"('month'::"text", ("data_venda")::timestamp with time zone))::"date") DESC;


ALTER VIEW "public"."rpt_prazo_medio_recebimento" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_projecao_pagamentos" AS
 SELECT "cap"."id" AS "conta_a_pagar_id",
    "cap"."descricao",
    "cap"."credor",
    "cap"."valor_total",
    "cap"."valor_pago",
    "cap"."saldo_devedor",
    "cap"."data_vencimento",
    "cap"."parcela_atual",
    "cap"."total_parcelas",
    "cap"."plano_conta_id",
    "pdc"."nome" AS "categoria_nome",
    "cap"."referencia",
        CASE
            WHEN ("cap"."data_vencimento" < CURRENT_DATE) THEN 'vencido'::"text"
            WHEN ("cap"."data_vencimento" = CURRENT_DATE) THEN 'vence_hoje'::"text"
            WHEN ("cap"."data_vencimento" <= (CURRENT_DATE + '7 days'::interval)) THEN 'proximos_7_dias'::"text"
            WHEN ("cap"."data_vencimento" <= (CURRENT_DATE + '30 days'::interval)) THEN 'proximos_30_dias'::"text"
            ELSE 'futuro'::"text"
        END AS "situacao",
        CASE
            WHEN ("cap"."data_vencimento" < CURRENT_DATE) THEN (CURRENT_DATE - "cap"."data_vencimento")
            ELSE 0
        END AS "dias_atraso"
   FROM ("public"."contas_a_pagar" "cap"
     LEFT JOIN "public"."plano_de_contas" "pdc" ON (("pdc"."id" = "cap"."plano_conta_id")))
  WHERE ("cap"."status" <> 'pago'::"text")
  ORDER BY "cap"."data_vencimento";


ALTER VIEW "public"."rpt_projecao_pagamentos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rpt_projecao_recebimentos" WITH ("security_invoker"='true') AS
 SELECT "v"."id" AS "venda_id",
    "c"."nome" AS "contato_nome",
    "c"."telefone" AS "contato_telefone",
    "v"."data" AS "data_venda",
    "v"."data_prevista_pagamento",
    "v"."total",
    "v"."valor_pago",
    ("v"."total" - "v"."valor_pago") AS "saldo_aberto",
        CASE
            WHEN ("v"."data_prevista_pagamento" IS NULL) THEN 'sem_data'::"text"
            WHEN ("v"."data_prevista_pagamento" < CURRENT_DATE) THEN 'vencido'::"text"
            WHEN ("v"."data_prevista_pagamento" = CURRENT_DATE) THEN 'vence_hoje'::"text"
            WHEN ("v"."data_prevista_pagamento" <= (CURRENT_DATE + '7 days'::interval)) THEN 'proximos_7_dias'::"text"
            WHEN ("v"."data_prevista_pagamento" <= (CURRENT_DATE + '30 days'::interval)) THEN 'proximos_30_dias'::"text"
            ELSE 'futuro'::"text"
        END AS "situacao"
   FROM ("public"."vendas" "v"
     JOIN "public"."contatos" "c" ON (("c"."id" = "v"."contato_id")))
  WHERE (("v"."pago" = false) AND ("v"."status" <> 'cancelada'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text"))
  ORDER BY "v"."data_prevista_pagamento";


ALTER VIEW "public"."rpt_projecao_recebimentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sis_imagens_produto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "produto_id" "uuid",
    "url" "text" NOT NULL,
    "tipo" "text" DEFAULT 'internal'::"text",
    "ordem" integer DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."sis_imagens_produto" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_contas_a_pagar_dashboard" AS
 SELECT COALESCE("sum"("saldo_devedor"), (0)::numeric) AS "total_a_pagar",
    COALESCE("sum"(
        CASE
            WHEN ("data_vencimento" < CURRENT_DATE) THEN "saldo_devedor"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_vencido",
    "count"(*) FILTER (WHERE ("status" = ANY (ARRAY['pendente'::"text", 'parcial'::"text"]))) AS "qtd_pendentes",
    "count"(*) FILTER (WHERE (("data_vencimento" < CURRENT_DATE) AND ("status" <> 'pago'::"text"))) AS "qtd_vencidas"
   FROM "public"."contas_a_pagar"
  WHERE ("status" <> 'pago'::"text");


ALTER VIEW "public"."view_contas_a_pagar_dashboard" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_extrato_mensal" AS
 SELECT "combined"."data",
    "combined"."descricao",
    "combined"."tipo",
    "combined"."valor",
    COALESCE("pc"."categoria",
        CASE
            WHEN ("combined"."origem" = 'compra_fabrica'::"text") THEN 'variavel'::"text"
            WHEN ("combined"."origem" = 'venda'::"text") THEN 'Vendas'::"text"
            ELSE 'Sem categoria'::"text"
        END) AS "categoria_tipo",
    COALESCE("pc"."nome",
        CASE
            WHEN ("combined"."origem" = 'compra_fabrica'::"text") THEN 'Compra Fábrica'::"text"
            WHEN ("combined"."origem" = 'venda'::"text") THEN 'Venda'::"text"
            ELSE 'Sem categoria'::"text"
        END) AS "categoria_nome",
    "combined"."origem",
    "combined"."id",
    "combined"."conta_id"
   FROM (( SELECT "l"."data",
            "l"."descricao",
            "l"."tipo",
                CASE
                    WHEN ("l"."tipo" = 'saida'::"text") THEN (- "l"."valor")
                    ELSE "l"."valor"
                END AS "valor",
            "l"."plano_conta_id",
            "l"."origem",
            ("l"."id")::"text" AS "id",
            "l"."conta_id"
           FROM "public"."lancamentos" "l"
        UNION ALL
         SELECT ("pop"."payment_date")::"date" AS "payment_date",
            ('Pgto Fábrica: '::"text" || COALESCE("c"."nome", 'PO'::"text")),
            'saida'::"text",
            (- "pop"."amount"),
            "pcf"."id",
            'compra_fabrica'::"text",
            ("pop"."id")::"text" AS "id",
            "pop"."conta_id"
           FROM ((("public"."purchase_order_payments" "pop"
             JOIN "public"."purchase_orders" "po" ON (("po"."id" = "pop"."purchase_order_id")))
             LEFT JOIN "public"."contatos" "c" ON (("c"."id" = "po"."fornecedor_id")))
             LEFT JOIN "public"."plano_de_contas" "pcf" ON (("pcf"."codigo" = 'COMPRA_FABRICA'::"text")))) "combined"
     LEFT JOIN "public"."plano_de_contas" "pc" ON (("pc"."id" = "combined"."plano_conta_id")));


ALTER VIEW "public"."view_extrato_mensal" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_extrato_saldo" WITH ("security_invoker"='true') AS
 SELECT "to_char"("date_trunc"('month'::"text", ("data")::timestamp with time zone), 'MM/YYYY'::"text") AS "mes",
    ("date_trunc"('month'::"text", ("data")::timestamp with time zone))::"date" AS "mes_ordem",
    COALESCE("sum"("valor") FILTER (WHERE ("tipo" = 'entrada'::"text")), (0)::numeric) AS "entradas",
    "abs"(COALESCE("sum"("valor") FILTER (WHERE ("tipo" = 'saida'::"text")), (0)::numeric)) AS "saidas",
    "sum"("valor") AS "saldo_mes",
    "sum"("sum"("valor")) OVER (ORDER BY ("date_trunc"('month'::"text", ("data")::timestamp with time zone))) AS "saldo_acumulado"
   FROM "public"."view_extrato_mensal"
  GROUP BY ("date_trunc"('month'::"text", ("data")::timestamp with time zone));


ALTER VIEW "public"."view_extrato_saldo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_fluxo_resumo" AS
 WITH "extrato_metrics" AS (
         SELECT (EXTRACT(month FROM "view_extrato_mensal"."data"))::integer AS "mes",
            (EXTRACT(year FROM "view_extrato_mensal"."data"))::integer AS "ano",
            "sum"(
                CASE
                    WHEN ("view_extrato_mensal"."tipo" = 'entrada'::"text") THEN "view_extrato_mensal"."valor"
                    ELSE (0)::numeric
                END) AS "entradas",
            "sum"(
                CASE
                    WHEN ("view_extrato_mensal"."tipo" = 'saida'::"text") THEN "abs"("view_extrato_mensal"."valor")
                    ELSE (0)::numeric
                END) AS "saidas"
           FROM "public"."view_extrato_mensal"
          GROUP BY ((EXTRACT(month FROM "view_extrato_mensal"."data"))::integer), ((EXTRACT(year FROM "view_extrato_mensal"."data"))::integer)
        ), "vendas_metrics" AS (
         SELECT (EXTRACT(month FROM "vendas"."data"))::integer AS "mes",
            (EXTRACT(year FROM "vendas"."data"))::integer AS "ano",
            COALESCE("sum"("vendas"."total"), (0)::numeric) AS "faturamento",
            COALESCE("sum"("vendas"."custo_total"), (0)::numeric) AS "custo_total",
            COALESCE("sum"(
                CASE
                    WHEN (("vendas"."pago" = false) AND ("vendas"."status" = 'entregue'::"text") AND ("vendas"."forma_pagamento" <> 'brinde'::"text")) THEN "vendas"."total"
                    ELSE (0)::numeric
                END), (0)::numeric) AS "a_receber"
           FROM "public"."vendas"
          WHERE ("vendas"."status" <> 'cancelada'::"text")
          GROUP BY ((EXTRACT(month FROM "vendas"."data"))::integer), ((EXTRACT(year FROM "vendas"."data"))::integer)
        )
 SELECT "em"."mes",
    "em"."ano",
    "em"."entradas" AS "total_entradas",
    "em"."saidas" AS "total_saidas",
    COALESCE("vm"."faturamento", (0)::numeric) AS "total_faturamento",
    (COALESCE("vm"."faturamento", (0)::numeric) - COALESCE("vm"."custo_total", (0)::numeric)) AS "lucro_estimado",
    COALESCE("vm"."a_receber", (0)::numeric) AS "total_a_receber"
   FROM ("extrato_metrics" "em"
     LEFT JOIN "vendas_metrics" "vm" ON ((("em"."mes" = "vm"."mes") AND ("em"."ano" = "vm"."ano"))));


ALTER VIEW "public"."view_fluxo_resumo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_home_alertas" WITH ("security_invoker"='true') AS
 WITH "ultima_compra" AS (
         SELECT "vendas"."contato_id",
            "max"("vendas"."data") AS "ultima_data"
           FROM "public"."vendas"
          WHERE ("vendas"."status" = 'entregue'::"text")
          GROUP BY "vendas"."contato_id"
        )
 SELECT "c"."id" AS "contato_id",
    "c"."nome",
    "c"."telefone",
    "uc"."ultima_data" AS "data_ultima_compra",
    (CURRENT_DATE - "uc"."ultima_data") AS "dias_sem_compra"
   FROM ("public"."contatos" "c"
     JOIN "ultima_compra" "uc" ON (("c"."id" = "uc"."contato_id")))
  WHERE ((CURRENT_DATE - "uc"."ultima_data") > 45)
  ORDER BY (CURRENT_DATE - "uc"."ultima_data") DESC
 LIMIT 10;


ALTER VIEW "public"."view_home_alertas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_home_operacional" WITH ("security_invoker"='true') AS
 WITH "itens_agg" AS (
         SELECT "itens_venda"."venda_id",
            "sum"("itens_venda"."quantidade") AS "total_itens"
           FROM "public"."itens_venda"
          GROUP BY "itens_venda"."venda_id"
        ), "monthly_metrics" AS (
         SELECT (EXTRACT(year FROM "v"."data"))::integer AS "ano",
            (EXTRACT(month FROM "v"."data"))::integer AS "mes",
            "count"(*) FILTER (WHERE ("v"."status" = 'entregue'::"text")) AS "total_vendas",
            "sum"(COALESCE("ia"."total_itens", (0)::numeric)) FILTER (WHERE ("v"."status" = 'entregue'::"text")) AS "total_itens"
           FROM ("public"."vendas" "v"
             LEFT JOIN "itens_agg" "ia" ON (("ia"."venda_id" = "v"."id")))
          GROUP BY (EXTRACT(year FROM "v"."data")), (EXTRACT(month FROM "v"."data"))
        ), "ranking" AS (
         SELECT "json_agg"("r".*) AS "indicacoes"
           FROM ( SELECT "ri"."indicador_id",
                    "ri"."nome",
                    "ri"."total_indicados",
                    "ri"."total_vendas_indicados"
                   FROM "public"."ranking_indicacoes" "ri"
                  ORDER BY "ri"."total_indicados" DESC, "ri"."total_vendas_indicados" DESC
                 LIMIT 3) "r"
        ), "ultimas" AS (
         SELECT "json_agg"("uv".*) AS "vendas"
           FROM ( SELECT "v"."id",
                    "v"."data",
                    "v"."total",
                    "v"."status",
                    "v"."pago",
                    "c"."nome" AS "contato_nome"
                   FROM ("public"."vendas" "v"
                     JOIN "public"."contatos" "c" ON (("c"."id" = "v"."contato_id")))
                  ORDER BY "v"."data" DESC, "v"."criado_em" DESC
                 LIMIT 5) "uv"
        )
 SELECT "ano",
    "mes",
    "total_vendas",
    "total_itens",
    ( SELECT "count"(*) AS "count"
           FROM "public"."vendas"
          WHERE ("vendas"."status" = 'pendente'::"text")) AS "pedidos_pendentes",
    ( SELECT "count"(*) AS "count"
           FROM "public"."vendas"
          WHERE (("vendas"."status" = 'entregue'::"text") AND ("vendas"."data" = CURRENT_DATE))) AS "pedidos_entregues_hoje",
    ( SELECT "count"(DISTINCT "vendas"."contato_id") AS "count"
           FROM "public"."vendas"
          WHERE ("vendas"."status" = 'entregue'::"text")) AS "clientes_ativos",
    COALESCE(( SELECT "ranking"."indicacoes"
           FROM "ranking"), '[]'::json) AS "ranking_indicacoes",
    COALESCE(( SELECT "ultimas"."vendas"
           FROM "ultimas"), '[]'::json) AS "ultimas_vendas"
   FROM "monthly_metrics" "m";


ALTER VIEW "public"."view_home_operacional" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_liquidado_mensal" WITH ("security_invoker"='true') AS
 WITH "primeiro_pg" AS (
         SELECT "pagamentos_venda"."venda_id",
            "min"("pagamentos_venda"."data") AS "data_primeiro_pagamento"
           FROM "public"."pagamentos_venda"
          GROUP BY "pagamentos_venda"."venda_id"
        )
 SELECT ("date_trunc"('month'::"text", COALESCE("pp"."data_primeiro_pagamento", ("v"."data")::timestamp with time zone)))::"date" AS "mes",
    "count"(*) AS "vendas_liquidadas",
    "sum"("v"."total") AS "total_liquidado"
   FROM ("public"."vendas" "v"
     LEFT JOIN "primeiro_pg" "pp" ON (("pp"."venda_id" = "v"."id")))
  WHERE (("v"."pago" = true) AND ("v"."status" = 'entregue'::"text") AND ("v"."forma_pagamento" <> 'brinde'::"text") AND (("v"."origem" IS NULL) OR ("v"."origem" <> 'catalogo'::"text")))
  GROUP BY ("date_trunc"('month'::"text", COALESCE("pp"."data_primeiro_pagamento", ("v"."data")::timestamp with time zone)))
  ORDER BY (("date_trunc"('month'::"text", COALESCE("pp"."data_primeiro_pagamento", ("v"."data")::timestamp with time zone)))::"date") DESC;


ALTER VIEW "public"."view_liquidado_mensal" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_marketing_pedidos" AS
 WITH "todas_vendas" AS (
         SELECT (("cat_pedidos"."criado_em" AT TIME ZONE 'America/Sao_Paulo'::"text"))::"date" AS "data_venda",
            'online'::"text" AS "origem_tipo",
            "cat_pedidos"."total" AS "total_reais",
            "cat_pedidos"."metodo_entrega",
            "cat_pedidos"."indicado_por" AS "referred_by"
           FROM "public"."cat_pedidos"
          WHERE (("cat_pedidos"."status" <> 'cancelado'::"text") AND ("cat_pedidos"."status_pagamento" = 'pago'::"text"))
        UNION ALL
         SELECT "vendas"."data" AS "data_venda",
            'direta'::"text" AS "origem_tipo",
            "vendas"."total" AS "total_reais",
            NULL::"text" AS "metodo_entrega",
            NULL::"text" AS "referred_by"
           FROM "public"."vendas"
          WHERE (("vendas"."status" <> 'cancelada'::"text") AND ("vendas"."pago" = true) AND (("vendas"."origem" IS NULL) OR ("vendas"."origem" <> 'catalogo'::"text")) AND ("vendas"."forma_pagamento" <> 'brinde'::"text"))
        )
 SELECT "data_venda",
    "to_char"(("data_venda")::timestamp with time zone, 'IYYY-IW'::"text") AS "semana_iso",
    "to_char"(("data_venda")::timestamp with time zone, 'YYYY-MM'::"text") AS "mes_iso",
    "count"(*) AS "total_pedidos",
    "sum"("total_reais") AS "faturamento",
    "round"("avg"("total_reais"), 2) AS "ticket_medio",
    "count"(*) FILTER (WHERE ("origem_tipo" = 'online'::"text")) AS "pedidos_online",
    "count"(*) FILTER (WHERE ("origem_tipo" = 'direta'::"text")) AS "pedidos_diretos",
    "sum"("total_reais") FILTER (WHERE ("origem_tipo" = 'online'::"text")) AS "faturamento_online",
    "sum"("total_reais") FILTER (WHERE ("origem_tipo" = 'direta'::"text")) AS "faturamento_direto",
    "count"(*) FILTER (WHERE ("metodo_entrega" = 'entrega'::"text")) AS "entregas_count",
    "count"(*) FILTER (WHERE ("metodo_entrega" = 'retirada'::"text")) AS "retiradas_count"
   FROM "todas_vendas"
  GROUP BY "data_venda"
  ORDER BY "data_venda" DESC;


ALTER VIEW "public"."vw_marketing_pedidos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_admin_dashboard" AS
 WITH "kpis_produtos" AS (
         SELECT "count"(*) FILTER (WHERE ("produtos"."ativo" = true)) AS "produtos_ativos",
            "count"(*) FILTER (WHERE ("produtos"."ativo" = false)) AS "produtos_inativos",
            "count"(*) FILTER (WHERE (("produtos"."estoque_atual" <= "produtos"."estoque_minimo") AND ("produtos"."ativo" = true))) AS "produtos_estoque_baixo"
           FROM "public"."produtos"
        ), "kpis_pedidos_online" AS (
         SELECT "count"(*) FILTER (WHERE ("cat_pedidos"."status" = 'pendente'::"text")) AS "pedidos_pendentes",
            ( SELECT "json_agg"("json_build_object"('id', "t"."id", 'order_number', "t"."numero_pedido", 'customer_name', "t"."nome_cliente", 'total_formatted', "t"."total", 'status', "t"."status", 'created_at', "t"."criado_em") ORDER BY "t"."criado_em" DESC) AS "json_agg"
                   FROM ( SELECT "cat_pedidos_1"."id",
                            "cat_pedidos_1"."numero_pedido",
                            "cat_pedidos_1"."nome_cliente",
                            "cat_pedidos_1"."status",
                            "cat_pedidos_1"."total",
                            "cat_pedidos_1"."criado_em"
                           FROM "public"."cat_pedidos" "cat_pedidos_1"
                          WHERE ("cat_pedidos_1"."status" <> 'cancelado'::"text")
                          ORDER BY "cat_pedidos_1"."criado_em" DESC
                         LIMIT 5) "t") AS "ultimos_pedidos"
           FROM "public"."cat_pedidos"
        ), "kpis_financeiro" AS (
         SELECT COALESCE("sum"(
                CASE
                    WHEN ("vw_marketing_pedidos"."data_venda" = (("now"() AT TIME ZONE 'America/Sao_Paulo'::"text"))::"date") THEN "vw_marketing_pedidos"."faturamento_online"
                    ELSE (0)::numeric
                END), (0)::numeric) AS "faturamento_hoje",
            COALESCE("sum"(
                CASE
                    WHEN ("date_trunc"('month'::"text", ("vw_marketing_pedidos"."data_venda")::timestamp without time zone) = "date_trunc"('month'::"text", ((("now"() AT TIME ZONE 'America/Sao_Paulo'::"text"))::"date")::timestamp without time zone)) THEN "vw_marketing_pedidos"."faturamento_online"
                    ELSE (0)::numeric
                END), (0)::numeric) AS "faturamento_mes"
           FROM "public"."vw_marketing_pedidos"
        )
 SELECT "p"."produtos_ativos",
    "p"."produtos_inativos",
    "p"."produtos_estoque_baixo",
    "o"."pedidos_pendentes",
    "o"."ultimos_pedidos",
    "f"."faturamento_hoje",
    "f"."faturamento_mes"
   FROM (("kpis_produtos" "p"
     CROSS JOIN "kpis_pedidos_online" "o")
     CROSS JOIN "kpis_financeiro" "f");


ALTER VIEW "public"."vw_admin_dashboard" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_catalogo_produtos" AS
 SELECT "id",
    "nome",
    "codigo",
    "slug",
    "descricao",
    "categoria",
    "subtitulo",
    "estoque_atual",
    "estoque_minimo",
    "visivel_catalogo",
    "destaque",
    "preco",
    "to_char"("preco", 'FM999G990D00'::"text") AS "preco_formatado",
    ( SELECT "img"."url"
           FROM "public"."cat_imagens_produto" "img"
          WHERE (("img"."produto_id" = "p"."id") AND (("img"."tipo")::"text" = 'cover'::"text") AND ("img"."ativo" = true))
          ORDER BY "img"."ordem"
         LIMIT 1) AS "url_imagem_principal",
    ( SELECT COALESCE("json_agg"("json_build_object"('id', "img"."id", 'url', "img"."url", 'alt_text', "img"."alt_text", 'is_primary', (("img"."tipo")::"text" = 'cover'::"text"), 'sort_order', "img"."ordem") ORDER BY "img"."ordem"), '[]'::json) AS "coalesce"
           FROM "public"."cat_imagens_produto" "img"
          WHERE (("img"."produto_id" = "p"."id") AND ("img"."ativo" = true))) AS "imagens",
        CASE
            WHEN ("estoque_atual" <= 0) THEN 'Sem Estoque'::"text"
            WHEN ("estoque_atual" <= "estoque_minimo") THEN 'Estoque Baixo'::"text"
            ELSE 'Em Estoque'::"text"
        END AS "status_estoque",
    "preco_ancoragem",
    "instrucoes_preparo"
   FROM "public"."produtos" "p"
  WHERE ("visivel_catalogo" = true);


ALTER VIEW "public"."vw_catalogo_produtos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cat_pedidos" ALTER COLUMN "numero_pedido" SET DEFAULT "nextval"('"public"."cat_pedidos_numero_pedido_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."cat_imagens_produto"
    ADD CONSTRAINT "cat_imagens_produto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_itens_pedido"
    ADD CONSTRAINT "cat_itens_pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_pedidos_pendentes_vinculacao"
    ADD CONSTRAINT "cat_pedidos_pendentes_vinculacao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_pedidos"
    ADD CONSTRAINT "cat_pedidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes"
    ADD CONSTRAINT "configuracoes_chave_key" UNIQUE ("chave");



ALTER TABLE ONLY "public"."configuracoes"
    ADD CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contas_a_pagar"
    ADD CONSTRAINT "contas_a_pagar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contatos"
    ADD CONSTRAINT "contatos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contatos"
    ADD CONSTRAINT "contatos_telefone_key" UNIQUE ("telefone");



ALTER TABLE ONLY "public"."itens_venda"
    ADD CONSTRAINT "itens_venda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos_conta_a_pagar"
    ADD CONSTRAINT "pagamentos_conta_a_pagar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos_venda"
    ADD CONSTRAINT "pagamentos_venda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plano_de_contas"
    ADD CONSTRAINT "plano_de_contas_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."plano_de_contas"
    ADD CONSTRAINT "plano_de_contas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_payments"
    ADD CONSTRAINT "purchase_order_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sis_imagens_produto"
    ADD CONSTRAINT "sis_imagens_produto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sis_imagens_produto"
    ADD CONSTRAINT "sis_imagens_produto_produto_id_key" UNIQUE ("produto_id");



ALTER TABLE ONLY "public"."vendas"
    ADD CONSTRAINT "vendas_cat_pedido_id_key" UNIQUE ("cat_pedido_id");



ALTER TABLE ONLY "public"."vendas"
    ADD CONSTRAINT "vendas_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_cat_imagens_produto_produto_id" ON "public"."cat_imagens_produto" USING "btree" ("produto_id");



CREATE INDEX "idx_cat_imagens_produto_tipo" ON "public"."cat_imagens_produto" USING "btree" ("tipo");



CREATE INDEX "idx_cat_itens_pedido_pedido" ON "public"."cat_itens_pedido" USING "btree" ("pedido_id");



CREATE INDEX "idx_cat_itens_pedido_produto" ON "public"."cat_itens_pedido" USING "btree" ("produto_id");



CREATE INDEX "idx_cat_pedidos_contato_id" ON "public"."cat_pedidos" USING "btree" ("contato_id");



CREATE INDEX "idx_cat_pedidos_criado_em" ON "public"."cat_pedidos" USING "btree" ("criado_em" DESC);



CREATE INDEX "idx_cat_pedidos_pendentes_vinculacao_cat_pedido_id" ON "public"."cat_pedidos_pendentes_vinculacao" USING "btree" ("cat_pedido_id");



CREATE INDEX "idx_cat_pedidos_status" ON "public"."cat_pedidos" USING "btree" ("status");



CREATE INDEX "idx_cat_pedidos_telefone" ON "public"."cat_pedidos" USING "btree" ("telefone_cliente");



CREATE INDEX "idx_contas_created_by" ON "public"."contas" USING "btree" ("created_by");



CREATE INDEX "idx_contas_updated_by" ON "public"."contas" USING "btree" ("updated_by");



CREATE INDEX "idx_contatos_created_by" ON "public"."contatos" USING "btree" ("created_by");



CREATE INDEX "idx_contatos_fts" ON "public"."contatos" USING "gin" ("fts");



CREATE INDEX "idx_contatos_indicado_por" ON "public"."contatos" USING "btree" ("indicado_por_id");



CREATE INDEX "idx_contatos_status" ON "public"."contatos" USING "btree" ("status");



CREATE INDEX "idx_contatos_tipo" ON "public"."contatos" USING "btree" ("tipo");



CREATE INDEX "idx_contatos_updated_by" ON "public"."contatos" USING "btree" ("updated_by");



CREATE INDEX "idx_itens_venda_produto_id" ON "public"."itens_venda" USING "btree" ("produto_id");



CREATE INDEX "idx_itens_venda_venda_id" ON "public"."itens_venda" USING "btree" ("venda_id");



CREATE INDEX "idx_lancamentos_conta_destino_id" ON "public"."lancamentos" USING "btree" ("conta_destino_id");



CREATE INDEX "idx_lancamentos_conta_id" ON "public"."lancamentos" USING "btree" ("conta_id");



CREATE INDEX "idx_lancamentos_created_by" ON "public"."lancamentos" USING "btree" ("created_by");



CREATE INDEX "idx_lancamentos_data" ON "public"."lancamentos" USING "btree" ("data");



CREATE INDEX "idx_lancamentos_plano_conta_id" ON "public"."lancamentos" USING "btree" ("plano_conta_id");



CREATE INDEX "idx_lancamentos_tipo_origem" ON "public"."lancamentos" USING "btree" ("tipo", "origem");



CREATE INDEX "idx_lancamentos_updated_by" ON "public"."lancamentos" USING "btree" ("updated_by");



CREATE INDEX "idx_lancamentos_venda_id" ON "public"."lancamentos" USING "btree" ("venda_id");



CREATE INDEX "idx_pagamentos_venda_venda_id" ON "public"."pagamentos_venda" USING "btree" ("venda_id");



CREATE INDEX "idx_produtos_categoria" ON "public"."produtos" USING "btree" ("categoria");



CREATE INDEX "idx_produtos_destaque" ON "public"."produtos" USING "btree" ("destaque") WHERE ("destaque" = true);



CREATE INDEX "idx_purchase_order_items_product_id" ON "public"."purchase_order_items" USING "btree" ("product_id");



CREATE INDEX "idx_purchase_order_items_purchase_order_id" ON "public"."purchase_order_items" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_purchase_order_payments_conta_id" ON "public"."purchase_order_payments" USING "btree" ("conta_id");



CREATE INDEX "idx_purchase_order_payments_order_id" ON "public"."purchase_order_payments" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_purchase_orders_fornecedor_id" ON "public"."purchase_orders" USING "btree" ("fornecedor_id");



CREATE INDEX "idx_sis_imagens_produto_produto_id" ON "public"."sis_imagens_produto" USING "btree" ("produto_id");



CREATE INDEX "idx_vendas_contato_id" ON "public"."vendas" USING "btree" ("contato_id");



CREATE INDEX "idx_vendas_created_by" ON "public"."vendas" USING "btree" ("created_by");



CREATE INDEX "idx_vendas_data" ON "public"."vendas" USING "btree" ("data");



CREATE INDEX "idx_vendas_data_prevista_pagamento" ON "public"."vendas" USING "btree" ("data_prevista_pagamento") WHERE ("pago" = false);



CREATE INDEX "idx_vendas_fts" ON "public"."vendas" USING "gin" ("fts");



CREATE INDEX "idx_vendas_pago_false" ON "public"."vendas" USING "btree" ("pago") WHERE ("pago" = false);



CREATE INDEX "idx_vendas_pendentes_entregues" ON "public"."vendas" USING "btree" ("status", "pago") WHERE (("pago" = false) AND ("status" = 'entregue'::"text"));



CREATE INDEX "idx_vendas_status" ON "public"."vendas" USING "btree" ("status");



CREATE INDEX "idx_vendas_updated_by" ON "public"."vendas" USING "btree" ("updated_by");



CREATE OR REPLACE TRIGGER "tr_cat_pedidos_link_contato" BEFORE INSERT ON "public"."cat_pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cat_pedidos_link_contato"();



CREATE OR REPLACE TRIGGER "tr_contas_a_pagar_audit" BEFORE INSERT OR UPDATE ON "public"."contas_a_pagar" FOR EACH ROW EXECUTE FUNCTION "public"."handle_audit_fields"();



CREATE OR REPLACE TRIGGER "tr_contas_audit" BEFORE INSERT OR UPDATE ON "public"."contas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_audit_fields"();



CREATE OR REPLACE TRIGGER "tr_contatos_audit" BEFORE INSERT OR UPDATE ON "public"."contatos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_audit_fields"();



CREATE OR REPLACE TRIGGER "tr_lancamentos_audit" BEFORE INSERT OR UPDATE ON "public"."lancamentos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_audit_fields"();



CREATE OR REPLACE TRIGGER "tr_lancamentos_saldo" AFTER INSERT OR DELETE OR UPDATE ON "public"."lancamentos" FOR EACH ROW EXECUTE FUNCTION "public"."update_conta_saldo_lancamento"();



CREATE OR REPLACE TRIGGER "tr_pagamentos_cap_audit" BEFORE INSERT OR UPDATE ON "public"."pagamentos_conta_a_pagar" FOR EACH ROW EXECUTE FUNCTION "public"."handle_audit_fields"();



CREATE OR REPLACE TRIGGER "tr_po_payments_saldo" AFTER INSERT OR DELETE OR UPDATE ON "public"."purchase_order_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_conta_saldo_po_payment"();



CREATE OR REPLACE TRIGGER "tr_prevent_delete_automatic_plan" BEFORE DELETE ON "public"."plano_de_contas" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_delete_automatic_plan"();



CREATE OR REPLACE TRIGGER "tr_sync_cat_pedido_to_venda" AFTER UPDATE ON "public"."cat_pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sync_cat_pedido_to_venda"();



CREATE OR REPLACE TRIGGER "tr_sync_venda_to_cat_pedido" AFTER UPDATE ON "public"."vendas" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") OR ("old"."pago" IS DISTINCT FROM "new"."pago"))) EXECUTE FUNCTION "public"."sync_venda_to_cat_pedido"();



CREATE OR REPLACE TRIGGER "tr_update_conta_a_pagar_status" AFTER INSERT OR DELETE ON "public"."pagamentos_conta_a_pagar" FOR EACH ROW EXECUTE FUNCTION "public"."update_conta_a_pagar_status"();



CREATE OR REPLACE TRIGGER "tr_update_purchase_order_payment_status" AFTER INSERT OR DELETE OR UPDATE ON "public"."purchase_order_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_purchase_order_payment_status"();



CREATE OR REPLACE TRIGGER "tr_vendas_audit" BEFORE INSERT OR UPDATE ON "public"."vendas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_audit_fields"();



CREATE OR REPLACE TRIGGER "trigger_brinde_before_insert" BEFORE INSERT ON "public"."vendas" FOR EACH ROW WHEN (("new"."forma_pagamento" = 'brinde'::"text")) EXECUTE FUNCTION "public"."handle_brinde_before_insert"();



CREATE OR REPLACE TRIGGER "trigger_configuracoes_atualizado_em" BEFORE UPDATE ON "public"."configuracoes" FOR EACH ROW EXECUTE FUNCTION "public"."update_atualizado_em"();



CREATE OR REPLACE TRIGGER "trigger_produtos_atualizado_em" BEFORE UPDATE ON "public"."produtos" FOR EACH ROW EXECUTE FUNCTION "public"."update_atualizado_em"();



CREATE OR REPLACE TRIGGER "trigger_stock_on_status_change" AFTER UPDATE OF "status" ON "public"."vendas" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."handle_stock_on_status_change"();



CREATE OR REPLACE TRIGGER "trigger_update_venda_pagamento" AFTER INSERT OR DELETE OR UPDATE ON "public"."pagamentos_venda" FOR EACH ROW EXECUTE FUNCTION "public"."update_venda_pagamento_summary"();



CREATE OR REPLACE TRIGGER "update_cat_pedidos_atualizado_em" BEFORE UPDATE ON "public"."cat_pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."update_atualizado_em"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cat_imagens_produto"
    ADD CONSTRAINT "cat_imagens_produto_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cat_itens_pedido"
    ADD CONSTRAINT "cat_itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."cat_pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cat_itens_pedido"
    ADD CONSTRAINT "cat_itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id");



ALTER TABLE ONLY "public"."cat_pedidos"
    ADD CONSTRAINT "cat_pedidos_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "public"."contatos"("id");



ALTER TABLE ONLY "public"."cat_pedidos_pendentes_vinculacao"
    ADD CONSTRAINT "cat_pedidos_pendentes_vinculacao_cat_pedido_id_fkey" FOREIGN KEY ("cat_pedido_id") REFERENCES "public"."cat_pedidos"("id");



ALTER TABLE ONLY "public"."contas_a_pagar"
    ADD CONSTRAINT "contas_a_pagar_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contas_a_pagar"
    ADD CONSTRAINT "contas_a_pagar_plano_conta_id_fkey" FOREIGN KEY ("plano_conta_id") REFERENCES "public"."plano_de_contas"("id");



ALTER TABLE ONLY "public"."contas_a_pagar"
    ADD CONSTRAINT "contas_a_pagar_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contatos"
    ADD CONSTRAINT "contatos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contatos"
    ADD CONSTRAINT "contatos_indicado_por_id_fkey" FOREIGN KEY ("indicado_por_id") REFERENCES "public"."contatos"("id");



ALTER TABLE ONLY "public"."contatos"
    ADD CONSTRAINT "contatos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."itens_venda"
    ADD CONSTRAINT "itens_venda_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id");



ALTER TABLE ONLY "public"."itens_venda"
    ADD CONSTRAINT "itens_venda_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_conta_destino_id_fkey" FOREIGN KEY ("conta_destino_id") REFERENCES "public"."contas"("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_plano_conta_id_fkey" FOREIGN KEY ("plano_conta_id") REFERENCES "public"."plano_de_contas"("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id");



ALTER TABLE ONLY "public"."pagamentos_conta_a_pagar"
    ADD CONSTRAINT "pagamentos_conta_a_pagar_conta_a_pagar_id_fkey" FOREIGN KEY ("conta_a_pagar_id") REFERENCES "public"."contas_a_pagar"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos_conta_a_pagar"
    ADD CONSTRAINT "pagamentos_conta_a_pagar_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id");



ALTER TABLE ONLY "public"."pagamentos_conta_a_pagar"
    ADD CONSTRAINT "pagamentos_conta_a_pagar_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pagamentos_conta_a_pagar"
    ADD CONSTRAINT "pagamentos_conta_a_pagar_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pagamentos_venda"
    ADD CONSTRAINT "pagamentos_venda_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."produtos"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_payments"
    ADD CONSTRAINT "purchase_order_payments_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id");



ALTER TABLE ONLY "public"."purchase_order_payments"
    ADD CONSTRAINT "purchase_order_payments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."contatos"("id");



ALTER TABLE ONLY "public"."sis_imagens_produto"
    ADD CONSTRAINT "sis_imagens_produto_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas"
    ADD CONSTRAINT "vendas_cat_pedido_id_fkey" FOREIGN KEY ("cat_pedido_id") REFERENCES "public"."cat_pedidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendas"
    ADD CONSTRAINT "vendas_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "public"."contatos"("id");



ALTER TABLE ONLY "public"."vendas"
    ADD CONSTRAINT "vendas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vendas"
    ADD CONSTRAINT "vendas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admin full access" ON "public"."configuracoes" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin full access" ON "public"."contas" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin full access" ON "public"."contatos" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin full access" ON "public"."lancamentos" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin full access" ON "public"."produtos" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin full access" ON "public"."vendas" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin full access on admin_users" ON "public"."admin_users" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE (("a"."user_id" = "auth"."uid"()) AND ("a"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admin manage PO items" ON "public"."purchase_order_items" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage PO payments" ON "public"."purchase_order_payments" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage POs" ON "public"."purchase_orders" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage chart of accounts" ON "public"."plano_de_contas" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage contas_a_pagar" ON "public"."contas_a_pagar" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage images" ON "public"."cat_imagens_produto" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage items" ON "public"."cat_itens_pedido" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage orders" ON "public"."cat_pedidos" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage pagamentos_conta_a_pagar" ON "public"."pagamentos_conta_a_pagar" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage payments" ON "public"."pagamentos_venda" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage pending links" ON "public"."cat_pedidos_pendentes_vinculacao" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage product images" ON "public"."sis_imagens_produto" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin manage sale items" ON "public"."itens_venda" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Authenticated read access" ON "public"."contatos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read access" ON "public"."lancamentos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read access" ON "public"."vendas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read access on settings" ON "public"."configuracoes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read chart of accounts" ON "public"."plano_de_contas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read payments" ON "public"."pagamentos_venda" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read sale items" ON "public"."itens_venda" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated update access" ON "public"."contatos" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Bootstrap first admin" ON "public"."admin_users" FOR INSERT TO "authenticated" WITH CHECK ((NOT (EXISTS ( SELECT 1
   FROM "public"."admin_users" "admin_users_1"))));



CREATE POLICY "Enable public read access for images" ON "public"."sis_imagens_produto" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."sis_imagens_produto" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public insert access" ON "public"."contatos" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert items" ON "public"."cat_itens_pedido" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert orders" ON "public"."cat_pedidos" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read access" ON "public"."produtos" FOR SELECT USING (true);



CREATE POLICY "Public read images" ON "public"."cat_imagens_produto" FOR SELECT USING (true);



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_imagens_produto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_itens_pedido" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_pedidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_pedidos_pendentes_vinculacao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contas_a_pagar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contatos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itens_venda" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagamentos_conta_a_pagar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagamentos_venda" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plano_de_contas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produtos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sis_imagens_produto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendas" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_image_reference"("p_produto_id" "uuid", "p_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_image_reference"("p_produto_id" "uuid", "p_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_image_reference"("p_produto_id" "uuid", "p_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_obrigacao_parcelada"("p_descricao" "text", "p_credor" "text", "p_valor_total" numeric, "p_data_vencimento" "date", "p_plano_conta_id" "uuid", "p_total_parcelas" integer, "p_referencia" "text", "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_obrigacao_parcelada"("p_descricao" "text", "p_credor" "text", "p_valor_total" numeric, "p_data_vencimento" "date", "p_plano_conta_id" "uuid", "p_total_parcelas" integer, "p_referencia" "text", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_obrigacao_parcelada"("p_descricao" "text", "p_credor" "text", "p_valor_total" numeric, "p_data_vencimento" "date", "p_plano_conta_id" "uuid", "p_total_parcelas" integer, "p_referencia" "text", "p_observacao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_pedido"("p_nome_cliente" "text", "p_telefone_cliente" "text", "p_endereco_entrega" "text", "p_metodo_entrega" "text", "p_metodo_pagamento" "text", "p_subtotal" numeric, "p_frete" numeric, "p_total" numeric, "p_observacoes" "text", "p_indicado_por" "text", "p_itens" "jsonb", "p_cep" "text", "p_logradouro" "text", "p_numero" "text", "p_complemento" "text", "p_bairro" "text", "p_cidade" "text", "p_uf" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_pedido"("p_nome_cliente" "text", "p_telefone_cliente" "text", "p_endereco_entrega" "text", "p_metodo_entrega" "text", "p_metodo_pagamento" "text", "p_subtotal" numeric, "p_frete" numeric, "p_total" numeric, "p_observacoes" "text", "p_indicado_por" "text", "p_itens" "jsonb", "p_cep" "text", "p_logradouro" "text", "p_numero" "text", "p_complemento" "text", "p_bairro" "text", "p_cidade" "text", "p_uf" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_pedido"("p_nome_cliente" "text", "p_telefone_cliente" "text", "p_endereco_entrega" "text", "p_metodo_entrega" "text", "p_metodo_pagamento" "text", "p_subtotal" numeric, "p_frete" numeric, "p_total" numeric, "p_observacoes" "text", "p_indicado_por" "text", "p_itens" "jsonb", "p_cep" "text", "p_logradouro" "text", "p_numero" "text", "p_complemento" "text", "p_bairro" "text", "p_cidade" "text", "p_uf" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_image_reference"("p_produto_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_image_reference"("p_produto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_image_reference"("p_produto_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_cat_pedidos_link_contato"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_cat_pedidos_link_contato"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cat_pedidos_link_contato"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_sync_cat_pedido_to_venda"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_sync_cat_pedido_to_venda"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sync_cat_pedido_to_venda"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_areceber_breakdown"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_areceber_breakdown"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_areceber_breakdown"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_audit_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_audit_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_audit_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_brinde_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_brinde_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_brinde_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_stock_on_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_stock_on_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_stock_on_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_delete_automatic_plan"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_delete_automatic_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_delete_automatic_plan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."receive_purchase_order"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."receive_purchase_order"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."receive_purchase_order"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_despesa_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_despesa_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_despesa_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_entrada_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_entrada_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_entrada_manual"("p_valor" numeric, "p_descricao" "text", "p_data" "date", "p_conta_id" "uuid", "p_plano_conta_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_pagamento_conta_a_pagar"("p_conta_a_pagar_id" "uuid", "p_valor" numeric, "p_data_pagamento" "date", "p_conta_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text", "p_conta_credor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_conta_a_pagar"("p_conta_a_pagar_id" "uuid", "p_valor" numeric, "p_data_pagamento" "date", "p_conta_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text", "p_conta_credor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_conta_a_pagar"("p_conta_a_pagar_id" "uuid", "p_valor" numeric, "p_data_pagamento" "date", "p_conta_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text", "p_conta_credor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_pagamento_venda"("p_venda_id" "uuid", "p_valor" numeric, "p_metodo" "text", "p_data" "date", "p_conta_id" "uuid", "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_venda"("p_venda_id" "uuid", "p_valor" numeric, "p_metodo" "text", "p_data" "date", "p_conta_id" "uuid", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_venda"("p_venda_id" "uuid", "p_valor" numeric, "p_metodo" "text", "p_data" "date", "p_conta_id" "uuid", "p_observacao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_total_a_receber_dashboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_total_a_receber_dashboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_total_a_receber_dashboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_total_a_receber_simples"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_total_a_receber_simples"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_total_a_receber_simples"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rpt_churn"("p_dias_threshold" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpt_churn"("p_dias_threshold" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpt_churn"("p_dias_threshold" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpt_vendas_por_periodo"("p_inicio" "date", "p_fim" "date", "p_agrupamento" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpt_vendas_por_periodo"("p_inicio" "date", "p_fim" "date", "p_agrupamento" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpt_vendas_por_periodo"("p_inicio" "date", "p_fim" "date", "p_agrupamento" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_venda_to_cat_pedido"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_venda_to_cat_pedido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_venda_to_cat_pedido"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_atualizado_em"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_atualizado_em"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conta_a_pagar_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conta_a_pagar_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conta_a_pagar_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conta_saldo_lancamento"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conta_saldo_lancamento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conta_saldo_lancamento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conta_saldo_po_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conta_saldo_po_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conta_saldo_po_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_purchase_order_payment_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_purchase_order_payment_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_purchase_order_payment_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_purchase_order_with_items"("p_order_id" "uuid", "p_fornecedor_id" "uuid", "p_order_date" "date", "p_total_amount" numeric, "p_notes" "text", "p_status" "text", "p_payment_status" "text", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_purchase_order_with_items"("p_order_id" "uuid", "p_fornecedor_id" "uuid", "p_order_date" "date", "p_total_amount" numeric, "p_notes" "text", "p_status" "text", "p_payment_status" "text", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_purchase_order_with_items"("p_order_id" "uuid", "p_fornecedor_id" "uuid", "p_order_date" "date", "p_total_amount" numeric, "p_notes" "text", "p_status" "text", "p_payment_status" "text", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_venda_pagamento_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_venda_pagamento_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_venda_pagamento_summary"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."cat_imagens_produto" TO "anon";
GRANT ALL ON TABLE "public"."cat_imagens_produto" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_imagens_produto" TO "service_role";



GRANT ALL ON TABLE "public"."cat_itens_pedido" TO "anon";
GRANT ALL ON TABLE "public"."cat_itens_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_itens_pedido" TO "service_role";



GRANT ALL ON TABLE "public"."cat_pedidos" TO "anon";
GRANT ALL ON TABLE "public"."cat_pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_pedidos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_pedidos_numero_pedido_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_pedidos_numero_pedido_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_pedidos_numero_pedido_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_pedidos_pendentes_vinculacao" TO "anon";
GRANT ALL ON TABLE "public"."cat_pedidos_pendentes_vinculacao" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_pedidos_pendentes_vinculacao" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes" TO "service_role";



GRANT ALL ON TABLE "public"."contas" TO "anon";
GRANT ALL ON TABLE "public"."contas" TO "authenticated";
GRANT ALL ON TABLE "public"."contas" TO "service_role";



GRANT ALL ON TABLE "public"."contas_a_pagar" TO "anon";
GRANT ALL ON TABLE "public"."contas_a_pagar" TO "authenticated";
GRANT ALL ON TABLE "public"."contas_a_pagar" TO "service_role";



GRANT ALL ON TABLE "public"."contatos" TO "anon";
GRANT ALL ON TABLE "public"."contatos" TO "authenticated";
GRANT ALL ON TABLE "public"."contatos" TO "service_role";



GRANT ALL ON TABLE "public"."vendas" TO "anon";
GRANT ALL ON TABLE "public"."vendas" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas" TO "service_role";



GRANT ALL ON TABLE "public"."crm_view_monthly_sales" TO "anon";
GRANT ALL ON TABLE "public"."crm_view_monthly_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_view_monthly_sales" TO "service_role";



GRANT ALL ON TABLE "public"."crm_view_operational_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."crm_view_operational_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_view_operational_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."itens_venda" TO "anon";
GRANT ALL ON TABLE "public"."itens_venda" TO "authenticated";
GRANT ALL ON TABLE "public"."itens_venda" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_conta_a_pagar" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_conta_a_pagar" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_conta_a_pagar" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_venda" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_venda" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_venda" TO "service_role";



GRANT ALL ON TABLE "public"."plano_de_contas" TO "anon";
GRANT ALL ON TABLE "public"."plano_de_contas" TO "authenticated";
GRANT ALL ON TABLE "public"."plano_de_contas" TO "service_role";



GRANT ALL ON TABLE "public"."produtos" TO "anon";
GRANT ALL ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_payments" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_payments" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."ranking_compras" TO "anon";
GRANT ALL ON TABLE "public"."ranking_compras" TO "authenticated";
GRANT ALL ON TABLE "public"."ranking_compras" TO "service_role";



GRANT ALL ON TABLE "public"."ranking_indicacoes" TO "anon";
GRANT ALL ON TABLE "public"."ranking_indicacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."ranking_indicacoes" TO "service_role";



GRANT ALL ON TABLE "public"."view_lucro_liquido_mensal" TO "anon";
GRANT ALL ON TABLE "public"."view_lucro_liquido_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."view_lucro_liquido_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_break_even_mensal" TO "anon";
GRANT ALL ON TABLE "public"."rpt_break_even_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_break_even_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_distribuicao_forma_pagamento" TO "anon";
GRANT ALL ON TABLE "public"."rpt_distribuicao_forma_pagamento" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_distribuicao_forma_pagamento" TO "service_role";



GRANT ALL ON TABLE "public"."view_home_financeiro" TO "anon";
GRANT ALL ON TABLE "public"."view_home_financeiro" TO "authenticated";
GRANT ALL ON TABLE "public"."view_home_financeiro" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_faturamento_comparativo" TO "anon";
GRANT ALL ON TABLE "public"."rpt_faturamento_comparativo" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_faturamento_comparativo" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_giro_estoque" TO "anon";
GRANT ALL ON TABLE "public"."rpt_giro_estoque" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_giro_estoque" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_ltv_por_cliente" TO "anon";
GRANT ALL ON TABLE "public"."rpt_ltv_por_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_ltv_por_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_margem_por_sku" TO "anon";
GRANT ALL ON TABLE "public"."rpt_margem_por_sku" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_margem_por_sku" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_prazo_medio_recebimento" TO "anon";
GRANT ALL ON TABLE "public"."rpt_prazo_medio_recebimento" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_prazo_medio_recebimento" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_projecao_pagamentos" TO "anon";
GRANT ALL ON TABLE "public"."rpt_projecao_pagamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_projecao_pagamentos" TO "service_role";



GRANT ALL ON TABLE "public"."rpt_projecao_recebimentos" TO "anon";
GRANT ALL ON TABLE "public"."rpt_projecao_recebimentos" TO "authenticated";
GRANT ALL ON TABLE "public"."rpt_projecao_recebimentos" TO "service_role";



GRANT ALL ON TABLE "public"."sis_imagens_produto" TO "anon";
GRANT ALL ON TABLE "public"."sis_imagens_produto" TO "authenticated";
GRANT ALL ON TABLE "public"."sis_imagens_produto" TO "service_role";



GRANT ALL ON TABLE "public"."view_contas_a_pagar_dashboard" TO "anon";
GRANT ALL ON TABLE "public"."view_contas_a_pagar_dashboard" TO "authenticated";
GRANT ALL ON TABLE "public"."view_contas_a_pagar_dashboard" TO "service_role";



GRANT ALL ON TABLE "public"."view_extrato_mensal" TO "anon";
GRANT ALL ON TABLE "public"."view_extrato_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."view_extrato_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."view_extrato_saldo" TO "anon";
GRANT ALL ON TABLE "public"."view_extrato_saldo" TO "authenticated";
GRANT ALL ON TABLE "public"."view_extrato_saldo" TO "service_role";



GRANT ALL ON TABLE "public"."view_fluxo_resumo" TO "anon";
GRANT ALL ON TABLE "public"."view_fluxo_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."view_fluxo_resumo" TO "service_role";



GRANT ALL ON TABLE "public"."view_home_alertas" TO "anon";
GRANT ALL ON TABLE "public"."view_home_alertas" TO "authenticated";
GRANT ALL ON TABLE "public"."view_home_alertas" TO "service_role";



GRANT ALL ON TABLE "public"."view_home_operacional" TO "anon";
GRANT ALL ON TABLE "public"."view_home_operacional" TO "authenticated";
GRANT ALL ON TABLE "public"."view_home_operacional" TO "service_role";



GRANT ALL ON TABLE "public"."view_liquidado_mensal" TO "anon";
GRANT ALL ON TABLE "public"."view_liquidado_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."view_liquidado_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."vw_marketing_pedidos" TO "anon";
GRANT ALL ON TABLE "public"."vw_marketing_pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_marketing_pedidos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_admin_dashboard" TO "anon";
GRANT ALL ON TABLE "public"."vw_admin_dashboard" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_admin_dashboard" TO "service_role";



GRANT ALL ON TABLE "public"."vw_catalogo_produtos" TO "anon";
GRANT ALL ON TABLE "public"."vw_catalogo_produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_catalogo_produtos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

alter table "public"."cat_imagens_produto" drop constraint "chk_tipo_imagem";

alter table "public"."cat_imagens_produto" add constraint "chk_tipo_imagem" CHECK (((tipo)::text = ANY ((ARRAY['cover'::character varying, 'front'::character varying, 'back'::character varying, 'side'::character varying, 'label'::character varying, 'detail'::character varying, 'ambient'::character varying, 'pack'::character varying])::text[]))) not valid;

alter table "public"."cat_imagens_produto" validate constraint "chk_tipo_imagem";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_conta_a_pagar(p_conta_a_pagar_id uuid, p_valor numeric, p_data_pagamento date, p_conta_id uuid, p_metodo_pagamento text DEFAULT 'pix'::text, p_observacao text DEFAULT NULL::text, p_conta_credor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- ==========================================================================
-- NOTA DE ARQUITETURA (Dívida Técnica):
-- Este RPC cria lançamentos no fluxo de caixa (tabela lancamentos) para cada
-- pagamento. O trigger tr_lancamentos_saldo atualiza o saldo da conta de
-- origem automaticamente.
--
-- Já os pagamentos de purchase_orders (purchase_order_payments) NÃO geram
-- lançamentos. Eles debitam o saldo da conta diretamente via trigger
-- tr_po_payments_saldo em purchase_order_payments.
--
-- Essa assimetria é intencional por enquanto. A view_extrato_mensal usa UNION
-- para consolidar ambos os fluxos na mesma visualização.
-- Ref: Auditoria Financeira 2026-03-21
-- ==========================================================================
DECLARE
    v_cap              RECORD;
    v_lancamento_id    UUID;
BEGIN
    -- 1. Validar que a obrigação existe e não está paga
    SELECT id, descricao, credor, valor_total, valor_pago, saldo_devedor, status, plano_conta_id
    INTO v_cap
    FROM public.contas_a_pagar
    WHERE id = p_conta_a_pagar_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta a pagar % não encontrada', p_conta_a_pagar_id;
    END IF;

    IF v_cap.status = 'pago' THEN
        RAISE EXCEPTION 'Esta obrigação já está totalmente paga';
    END IF;

    -- 2. Validar que não há overpayment
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

    -- 4. Criar lançamento de saída no fluxo de caixa (debita conta de origem)
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

    -- 5. Se conta do credor informada, criar lançamento de entrada (credita conta do credor)
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
$function$
;

create or replace view "public"."view_extrato_mensal" as  SELECT combined.data,
    combined.descricao,
    combined.tipo,
    combined.valor,
    COALESCE(pc.categoria,
        CASE
            WHEN (combined.origem = 'compra_fabrica'::text) THEN 'variavel'::text
            WHEN (combined.origem = 'venda'::text) THEN 'Vendas'::text
            ELSE 'Sem categoria'::text
        END) AS categoria_tipo,
    COALESCE(pc.nome,
        CASE
            WHEN (combined.origem = 'compra_fabrica'::text) THEN 'Compra Fábrica'::text
            WHEN (combined.origem = 'venda'::text) THEN 'Venda'::text
            ELSE 'Sem categoria'::text
        END) AS categoria_nome,
    combined.origem,
    combined.id,
    combined.conta_id
   FROM (( SELECT l.data,
            l.descricao,
            l.tipo,
                CASE
                    WHEN (l.tipo = 'saida'::text) THEN (- l.valor)
                    ELSE l.valor
                END AS valor,
            l.plano_conta_id,
            l.origem,
            (l.id)::text AS id,
            l.conta_id
           FROM public.lancamentos l
        UNION ALL
         SELECT (pop.payment_date)::date AS payment_date,
            ('Pgto Fábrica: '::text || COALESCE(c.nome, 'PO'::text)),
            'saida'::text,
            (- pop.amount),
            pcf.id,
            'compra_fabrica'::text,
            (pop.id)::text AS id,
            pop.conta_id
           FROM (((public.purchase_order_payments pop
             JOIN public.purchase_orders po ON ((po.id = pop.purchase_order_id)))
             LEFT JOIN public.contatos c ON ((c.id = po.fornecedor_id)))
             LEFT JOIN public.plano_de_contas pcf ON ((pcf.codigo = 'COMPRA_FABRICA'::text)))) combined
     LEFT JOIN public.plano_de_contas pc ON ((pc.id = combined.plano_conta_id)));



  create policy "Allow all deletes on products bucket"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'products'::text));



  create policy "Allow all inserts on products bucket"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'products'::text));



  create policy "Allow all updates on products bucket"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'products'::text))
with check ((bucket_id = 'products'::text));



  create policy "Allow public read access on products bucket"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'products'::text));



