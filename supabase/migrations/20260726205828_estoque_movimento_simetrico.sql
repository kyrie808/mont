-- Estoque: movimentação simétrica (entrega ⇔ estoque)
--
-- PROBLEMA (bug de lógica): o estoque só era movimentado em 2 transições de `vendas.status`:
--   pendente→entregue (debita) e entregue→cancelada (credita). Ficavam de fora, deixando o
--   estoque errado para sempre:
--     • entregue→pendente  (reverter p/ editar)  → não creditava
--     • entregue→cancelada já ok; mas cancelada→entregue (re-entregar) → não debitava
--     • DELETE de venda entregue                 → não creditava  (nenhum trigger de DELETE)
--
-- INVARIANTE CORRETA: estoque debitado ⟺ status='entregue'.
--   Toda entrada/saída do estado 'entregue' espelha no estoque, em qualquer sentido.
--
-- ESCOPO: só comportamento FUTURO. Não recomputa histórico nem toca saldos reais
--   (contagem física é feita à parte via "Ajustar"). Reusa fn_ajusta_estoque_item (explode combos).
--
-- INSERT-direto-como-entregue: intencionalmente NÃO tratado. Nenhum caminho hoje insere venda já
--   'entregue' (criar_venda insere 'pendente' e depois faz UPDATE), e um AFTER INSERT em `vendas`
--   não vê `itens_venda` de forma confiável (inseridos depois) — um trigger aqui silenciaria (loop
--   vazio). Se um dia existir esse caminho, ele deve debitar após inserir os itens, não no INSERT da venda.

-- Estoque: movimentação simétrica (entrega ⇔ estoque). Invariante: estoque debitado ⟺ status='entregue'.

CREATE OR REPLACE FUNCTION public.fn_estoque_aplica_venda(p_venda_id uuid, p_sinal integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    item RECORD;
BEGIN
    FOR item IN
        SELECT produto_id, quantidade
        FROM public.itens_venda
        WHERE venda_id = p_venda_id
    LOOP
        PERFORM public.fn_ajusta_estoque_item(item.produto_id, item.quantidade, p_sinal);
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_stock_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_old_entregue boolean := (OLD.status = 'entregue');
    v_new_entregue boolean := (NEW.status = 'entregue');
    v_conta_id       uuid;
    v_plano_conta_id uuid;
    v_contato_nome   text;
BEGIN
    IF v_new_entregue AND NOT v_old_entregue THEN
        PERFORM public.fn_estoque_aplica_venda(NEW.id, -1);

        IF NEW.forma_pagamento = 'brinde' THEN
            SELECT id   INTO v_conta_id       FROM public.contas          WHERE codigo = 'CAIXA';
            SELECT id   INTO v_plano_conta_id FROM public.plano_de_contas  WHERE codigo = 'DESPESA_BRINDE';
            SELECT nome INTO v_contato_nome   FROM public.contatos         WHERE id = NEW.contato_id;

            INSERT INTO public.lancamentos (
                tipo, valor, data, descricao, conta_id, plano_conta_id, origem, venda_id
            ) VALUES (
                'saida', NEW.total, NEW.data,
                'Brinde: ' || COALESCE(v_contato_nome, 'Cliente não identificado'),
                v_conta_id, v_plano_conta_id, 'brinde', NEW.id
            );
        END IF;

    ELSIF v_old_entregue AND NOT v_new_entregue THEN
        PERFORM public.fn_estoque_aplica_venda(NEW.id, 1);

        IF NEW.forma_pagamento = 'brinde' THEN
            DELETE FROM public.lancamentos
            WHERE venda_id = NEW.id AND tipo = 'saida' AND origem = 'brinde';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_estoque_on_venda_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF OLD.status = 'entregue' THEN
        PERFORM public.fn_estoque_aplica_venda(OLD.id, 1);
    END IF;
    RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_stock_on_venda_delete ON public.vendas;
CREATE TRIGGER trigger_stock_on_venda_delete
    BEFORE DELETE ON public.vendas
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_estoque_on_venda_delete();
