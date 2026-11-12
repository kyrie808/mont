-- SP2: vender um kit (eh_combo) baixa o estoque dos COMPONENTES, não do SKU do kit.
-- Helper fn_ajusta_estoque_item: se o produto é combo, explode em produto_componentes
-- (qtd_venda × qtd_componente); senão ajusta o próprio produto. p_delta_sinal = -1 baixa
-- (entrega), +1 restaura (cancelamento). Para produto simples o comportamento é IDÊNTICO
-- ao anterior (estoque_atual + (-1 * qtd) = estoque_atual - qtd) → retrocompatível.
-- handle_stock_on_status_change passa a chamar o helper nos dois ramos (mantém o brinde).

CREATE OR REPLACE FUNCTION public.fn_ajusta_estoque_item(
    p_produto_id uuid,
    p_quantidade numeric,
    p_delta_sinal int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_eh_combo boolean;
    comp       RECORD;
BEGIN
    SELECT eh_combo INTO v_eh_combo FROM public.produtos WHERE id = p_produto_id;

    IF COALESCE(v_eh_combo, false) THEN
        FOR comp IN
            SELECT componente_id, quantidade
            FROM public.produto_componentes
            WHERE combo_id = p_produto_id
        LOOP
            UPDATE public.produtos
            SET estoque_atual = estoque_atual + (p_delta_sinal * p_quantidade * comp.quantidade)
            WHERE id = comp.componente_id;
        END LOOP;
    ELSE
        UPDATE public.produtos
        SET estoque_atual = estoque_atual + (p_delta_sinal * p_quantidade)
        WHERE id = p_produto_id;
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.handle_stock_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    item             RECORD;
    v_conta_id       uuid;
    v_plano_conta_id uuid;
    v_contato_nome   text;
BEGIN
    -- Case 1: Entrega (pendente -> entregue) — debitar estoque (explode combos)
    IF OLD.status = 'pendente' AND NEW.status = 'entregue' THEN

        FOR item IN
            SELECT produto_id, quantidade
            FROM public.itens_venda
            WHERE venda_id = NEW.id
        LOOP
            PERFORM public.fn_ajusta_estoque_item(item.produto_id, item.quantidade, -1);
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

    -- Case 2: Cancelamento de entregue (entregue -> cancelada) — restaurar estoque
    ELSIF OLD.status = 'entregue' AND NEW.status = 'cancelada' THEN

        FOR item IN
            SELECT produto_id, quantidade
            FROM public.itens_venda
            WHERE venda_id = NEW.id
        LOOP
            PERFORM public.fn_ajusta_estoque_item(item.produto_id, item.quantidade, 1);
        END LOOP;

        -- Brinde: remover lançamento de despesa ao cancelar
        IF NEW.forma_pagamento = 'brinde' THEN
            DELETE FROM public.lancamentos
            WHERE venda_id = NEW.id
              AND tipo    = 'saida'
              AND origem  = 'brinde';
        END IF;

    -- Case 3: Cancelamento de pendente -> sem alteração
    END IF;

    RETURN NEW;
END;
$function$;
