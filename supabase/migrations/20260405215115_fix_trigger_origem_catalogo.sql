-- Fix: trigger fn_sync_cat_pedido_to_venda usava 'Catálogo Online' como origem
-- do contato, mas a constraint contatos_origem_check só aceita
-- 'direto', 'indicacao', 'catalogo'. Isso fazia o INSERT falhar e cair
-- no EXCEPTION WHEN OTHERS, registrando em cat_pedidos_pendentes_vinculacao.

CREATE OR REPLACE FUNCTION public.fn_sync_cat_pedido_to_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
$$;
