-- Venda que NASCE entregue: estoque e despesa de brinde passam a acompanhar.
--
-- Problema: `trigger_stock_on_status_change` é AFTER UPDATE OF status. Toda venda
-- inserida já com status='entregue' escapava dele — não baixava estoque e, sendo
-- brinde, não lançava a despesa. Dois caminhos caem nisso hoje:
--
--   * `fn_brinde_invariante` força `status := 'entregue'` no INSERT de todo brinde.
--     Corte causal na produção: brindes até 26/03/2026 têm despesa; de 27/03 em
--     diante, nenhum (6 vendas, R$160) — e nenhum deles baixou estoque.
--   * `fn_sync_cat_pedido_to_venda` insere a venda do catálogo já 'entregue'
--     (17 vendas na produção que nunca baixaram estoque).
--
-- E é pré-requisito do Balcão nascer entregue: sem isto, cada venda de balcão
-- deixaria de baixar estoque — multiplicaria o defeito em vez de corrigi-lo.
--
-- A invariante passa a ser: **venda entregue => estoque baixado e, se brinde,
-- despesa lançada** — não importa se chegou por INSERT ou por UPDATE.
--
-- ONDE a baixa de INSERT mora: nos dois caminhos o header da venda é inserido
-- ANTES dos itens, então um gatilho AFTER INSERT em `vendas` veria zero itens.
-- Por isso ele fica em `itens_venda`, onde o item já existe.
--
-- SIMETRIA do DELETE: o gatilho de item também devolve ao estoque, mas só quando
-- a venda-pai ainda existe. Isso cobre o catálogo, que apaga `itens_venda` ANTES
-- de apagar a venda (`apps/catalogo/.../pedidos/[id]/route.ts`) — sem o guard, o
-- `trigger_stock_on_venda_delete` (BEFORE DELETE em vendas) não acharia item algum.
-- E na exclusão da venda o pai já sumiu quando o cascade apaga os filhos, então
-- não há devolução em dobro.
--
-- ESTE ARQUIVO NÃO CORRIGE O HISTÓRICO. Backfill das 6 despesas de brinde e do
-- estoque das 23 vendas é decisão do diretor: mexe em conciliação financeira
-- fechada e na contagem física de estoque que ainda está pendente.

-- ---------------------------------------------------------------------------
-- 1. Despesa do brinde extraída para função própria (idempotente).
--    Antes vivia inline no gatilho de UPDATE; agora INSERT e UPDATE chamam a
--    MESMA função e não podem divergir.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_brinde_lanca_despesa(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_venda          RECORD;
    v_conta_id       uuid;
    v_plano_conta_id uuid;
    v_contato_nome   text;
BEGIN
    SELECT id, total, data, contato_id, forma_pagamento
      INTO v_venda
      FROM public.vendas
     WHERE id = p_venda_id;

    IF NOT FOUND OR v_venda.forma_pagamento <> 'brinde' THEN
        RETURN;
    END IF;

    -- Idempotente: reentrada (ou re-entrega) não duplica a despesa.
    IF EXISTS (
        SELECT 1 FROM public.lancamentos
         WHERE venda_id = p_venda_id AND tipo = 'saida' AND origem = 'brinde'
    ) THEN
        RETURN;
    END IF;

    SELECT id   INTO v_conta_id       FROM public.contas         WHERE codigo = 'CAIXA';
    SELECT id   INTO v_plano_conta_id FROM public.plano_de_contas WHERE codigo = 'DESPESA_BRINDE';
    SELECT nome INTO v_contato_nome   FROM public.contatos        WHERE id = v_venda.contato_id;

    INSERT INTO public.lancamentos (
        tipo, valor, data, descricao, conta_id, plano_conta_id, origem, venda_id
    ) VALUES (
        'saida', v_venda.total, v_venda.data,
        'Brinde: ' || COALESCE(v_contato_nome, 'Cliente não identificado'),
        v_conta_id, v_plano_conta_id, 'brinde', p_venda_id
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Gatilho de UPDATE passa a usar a função extraída (comportamento idêntico).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_stock_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_old_entregue boolean := (OLD.status = 'entregue');
    v_new_entregue boolean := (NEW.status = 'entregue');
BEGIN
    IF v_new_entregue AND NOT v_old_entregue THEN
        PERFORM public.fn_estoque_aplica_venda(NEW.id, -1);

        IF NEW.forma_pagamento = 'brinde' THEN
            PERFORM public.fn_brinde_lanca_despesa(NEW.id);
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
$$;

-- ---------------------------------------------------------------------------
-- 3. Item entrando/saindo de uma venda JÁ entregue mexe no estoque.
--    É isto que fecha o buraco do INSERT (o item existe; o header, não bastaria).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_estoque_item_venda_entregue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_status text;
    v_row    record := COALESCE(NEW, OLD);
BEGIN
    -- No cascade de DELETE da venda o pai já sumiu → NOT FOUND → não devolve de
    -- novo (o BEFORE DELETE em `vendas` já devolveu). Guard essencial.
    SELECT status INTO v_status FROM public.vendas WHERE id = v_row.venda_id;
    IF NOT FOUND OR v_status <> 'entregue' THEN
        RETURN v_row;
    END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM public.fn_ajusta_estoque_item(NEW.produto_id, NEW.quantidade, -1);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.fn_ajusta_estoque_item(OLD.produto_id, OLD.quantidade, 1);
    END IF;

    RETURN v_row;
END;
$$;

DROP TRIGGER IF EXISTS trigger_estoque_item_venda_entregue ON public.itens_venda;
CREATE TRIGGER trigger_estoque_item_venda_entregue
AFTER INSERT OR DELETE ON public.itens_venda
FOR EACH ROW EXECUTE FUNCTION public.fn_estoque_item_venda_entregue();

-- ---------------------------------------------------------------------------
-- 4. Brinde que nasce entregue lança a despesa (não depende de itens).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_brinde_despesa_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    PERFORM public.fn_brinde_lanca_despesa(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_brinde_despesa_on_insert ON public.vendas;
CREATE TRIGGER trigger_brinde_despesa_on_insert
AFTER INSERT ON public.vendas
FOR EACH ROW
WHEN (NEW.forma_pagamento = 'brinde' AND NEW.status = 'entregue')
EXECUTE FUNCTION public.fn_brinde_despesa_on_insert();

-- ---------------------------------------------------------------------------
-- 5. `criar_venda` ganha `p_status`. Balcão/Retirada = produto saiu na hora.
--    DROP + CREATE (e não CREATE OR REPLACE) porque acrescentar parâmetro criaria
--    uma SEGUNDA versão da RPC — o projeto mantém versão única.
--    O default 'pendente' preserva o comportamento do código já publicado, que
--    chama a RPC sem este argumento (a migration vai à prod antes do deploy).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.criar_venda(
    uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric
);

CREATE FUNCTION public.criar_venda(
    p_contato_id uuid,
    p_data date,
    p_forma_pagamento text,
    p_taxa_entrega numeric,
    p_itens jsonb,
    p_idempotency_key uuid,
    p_data_prevista_pagamento date DEFAULT NULL::date,
    p_entregador_id uuid DEFAULT NULL::uuid,
    p_observacao_entregador text DEFAULT NULL::text,
    p_dinheiro_na_entrega boolean DEFAULT false,
    p_desconto numeric DEFAULT 0,
    p_status text DEFAULT 'pendente'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    -- Só estes dois: 'cancelada' na criação não faz sentido e abriria caminho
    -- para venda nascer fora de qualquer fluxo.
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
        entregador_id, observacao_entregador, dinheiro_na_entrega, desconto
    ) VALUES (
        p_contato_id, p_data, COALESCE(p_status, 'pendente'), v_total, false, p_forma_pagamento,
        COALESCE(p_taxa_entrega, 0), p_data_prevista_pagamento, v_custo_total, p_idempotency_key,
        p_entregador_id, p_observacao_entregador, COALESCE(p_dinheiro_na_entrega, false), COALESCE(p_desconto, 0)
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_venda_id;

    IF v_venda_id IS NULL THEN
        SELECT id INTO v_venda_id
          FROM public.vendas
         WHERE idempotency_key = p_idempotency_key;
        RETURN v_venda_id;
    END IF;

    -- Nascendo 'entregue', é este INSERT que dispara a baixa de estoque
    -- (trigger_estoque_item_venda_entregue). Por isso os itens vêm depois do
    -- header e a baixa não precisa de chamada explícita aqui.
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
$$;

-- Grants iguais aos da versão anterior (o DROP levou a ACL junto).
REVOKE ALL ON FUNCTION public.criar_venda(
    uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_venda(
    uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text
) TO authenticated, service_role;

-- `fn_brinde_lanca_despesa` e as funções de gatilho são SECURITY DEFINER e não
-- devem ser chamáveis pelo cliente — só pelos gatilhos/RPCs.
REVOKE ALL ON FUNCTION public.fn_brinde_lanca_despesa(uuid) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_estoque_item_venda_entregue() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_brinde_despesa_on_insert() FROM PUBLIC, authenticated, anon;

NOTIFY pgrst, 'reload schema';
