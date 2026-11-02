-- Pedido da loja pelo WhatsApp + confirmação no sistema interno (02/11/2026).
--
-- Decisão do diretor (02/11): a loja ainda não tem pagamento online. O cliente monta a sacola,
-- informa os dados e o pedido vai para o WhatsApp da Mont. O pedido fica só em cat_pedidos /
-- cat_itens_pedido (canal 'loja'); a VENDA só nasce quando o Gilmar confirma no sistema interno,
-- informando frete, data de entrega e forma de pagamento. Pedido não confirmado nunca toca em
-- vendas (#ENTREGAS, pendentes, a receber, metas).
--
--   * cat_pedidos: canal, endereço estruturado, sacola original (itens_loja), aceite de ofertas
--     no WhatsApp (LGPD: com o texto exibido; a hora é criado_em), chave de idempotência.
--   * cat_itens_pedido: combo_id / combo_instancia (sem FK, como em itens_venda — ver a
--     migração 20261030181909: uma 2ª FK para produtos deixaria os embeds ambíguos).
--   * criar_venda_em: o miolo da criar_venda com "preço vigente em" + origem + pedido de origem.
--     Interna (só service_role e funções do banco). A criar_venda pública vira um invólucro com
--     now() — comportamento idêntico para a Nova Venda.
--   * loja_criar_pedido (só service_role — o servidor da loja): valida e precifica tudo no
--     banco (tabela Pix vigente), sabores dos combos como itens.
--   * loja_confirmar_pedido (admin): idempotente; preço do momento do pedido; liga ou cria o
--     contato (contato existente: só preenche campos vazios, ou troca o endereço se o Gilmar
--     marcar); cria a venda pendente com origem 'loja'.
--   * loja_descartar_pedido (admin).
--   * Gatilhos: fn_sync_cat_pedido_to_venda ignora o canal 'loja'; sync_venda_to_cat_pedido não
--     rebaixa pedido da loja para 'pendente'; excluir a venda de um pedido da loja devolve o
--     pedido para a lista (fluxo "exclua e lance outra").
--   * Origem 'loja' em `origens` e em contatos.origem_cadastro.
--
-- Suíte: supabase/tests/loja_pedido.sql.

-- ── Origem 'loja' ────────────────────────────────────────────────────────────
INSERT INTO public.origens (slug, label, ativo, ordem)
VALUES ('loja', 'Loja', true, (SELECT COALESCE(max(ordem), 0) + 1 FROM public.origens))
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.contatos DROP CONSTRAINT contatos_origem_cadastro_check;
ALTER TABLE public.contatos ADD CONSTRAINT contatos_origem_cadastro_check
  CHECK (origem_cadastro = ANY (ARRAY['manual'::text, 'whatsapp'::text, 'catalogo'::text, 'loja'::text]));

-- ── cat_pedidos / cat_itens_pedido ───────────────────────────────────────────
ALTER TABLE public.cat_pedidos
  ADD COLUMN canal text NOT NULL DEFAULT 'catalogo' CHECK (canal IN ('catalogo', 'loja')),
  ADD COLUMN cep text,
  ADD COLUMN logradouro text,
  ADD COLUMN numero text,
  ADD COLUMN complemento text,
  ADD COLUMN bairro text,
  ADD COLUMN cidade text,
  ADD COLUMN uf text,
  ADD COLUMN itens_loja jsonb,
  ADD COLUMN ofertas_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN ofertas_texto text,
  ADD COLUMN chave_idempotencia uuid UNIQUE;

COMMENT ON COLUMN public.cat_pedidos.canal IS 'catalogo (apps/catalogo) ou loja (apps/loja). Pedido da loja só vira venda ao ser confirmado no sistema interno.';
COMMENT ON COLUMN public.cat_pedidos.itens_loja IS 'Sacola como o cliente montou (avulsos e combos com sabores). A confirmação reprecifica a partir dela, no preço do momento do pedido.';
COMMENT ON COLUMN public.cat_pedidos.ofertas_whatsapp IS 'Cliente marcou "quero receber ofertas no WhatsApp" (LGPD). A hora do aceite é criado_em; o texto exibido fica em ofertas_texto.';

CREATE INDEX cat_pedidos_canal_status_idx ON public.cat_pedidos (canal, status, criado_em DESC);

ALTER TABLE public.cat_itens_pedido
  ADD COLUMN combo_id uuid,
  ADD COLUMN combo_instancia uuid;

COMMENT ON COLUMN public.cat_itens_pedido.combo_id IS 'Combo de onde a linha veio (sem FK de propósito, como itens_venda.combo_id).';

-- ── Gatilho antigo do catálogo: não mexe em pedido da loja ──────────────────
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

-- ── Venda → pedido: pedido da loja nunca volta para 'pendente' ───────────────
CREATE OR REPLACE FUNCTION public.sync_venda_to_cat_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Só sincroniza se a venda veio de um pedido (catálogo ou loja)
    IF NEW.cat_pedido_id IS NOT NULL THEN
        UPDATE cat_pedidos SET
            status = CASE
                WHEN NEW.status = 'cancelada' THEN 'cancelado'
                -- Pedido da loja com venda é 'confirmado' até a entrega: 'pendente' é a fila
                -- de pedidos ainda não confirmados no sistema interno.
                WHEN cat_pedidos.canal = 'loja' AND NEW.status = 'pendente' THEN 'confirmado'
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
$function$;

-- ── Excluir a venda de um pedido da loja devolve o pedido para a fila ───────
CREATE OR REPLACE FUNCTION public.fn_loja_pedido_volta_ao_excluir_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    -- "Para corrigir, exclua esta venda e lance outra": o pedido da loja volta a esperar
    -- confirmação, para o Gilmar confirmar de novo com os dados certos.
    UPDATE public.cat_pedidos
       SET status = 'pendente', status_pagamento = 'pendente', atualizado_em = now()
     WHERE id = OLD.cat_pedido_id AND canal = 'loja' AND status <> 'cancelado';
    RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_loja_pedido_volta_ao_excluir_venda() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_loja_pedido_volta_ao_excluir_venda
  AFTER DELETE ON public.vendas
  FOR EACH ROW WHEN (OLD.cat_pedido_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_loja_pedido_volta_ao_excluir_venda();

-- ── criar_venda_em: o miolo da criar_venda, com "preço vigente em" ───────────
CREATE FUNCTION public.criar_venda_em(
    p_contato_id uuid, p_data date, p_forma_pagamento text, p_taxa_entrega numeric, p_itens jsonb,
    p_idempotency_key uuid, p_data_prevista_pagamento date, p_entregador_id uuid,
    p_observacao_entregador text, p_dinheiro_na_entrega boolean, p_desconto numeric, p_status text,
    p_data_entrega_prevista date, p_tabela text,
    p_preco_em timestamptz, p_origem text, p_cat_pedido_id uuid, p_observacoes text)
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
    v_itens       jsonb := COALESCE(p_itens, '[]'::jsonb);
    v_linhas      jsonb;
    v_item        jsonb;
    v_qtd         numeric;
    v_preco       numeric;
    v_instancia   uuid;
    v_preco_em    timestamptz := COALESCE(p_preco_em, now());
    i             integer;
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

    IF p_tabela IS NULL THEN
        -- Comportamento antigo: o chamador manda preço e subtotal. Combo com sabores exige tabela.
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens) it WHERE it ? 'combo_id') THEN
            RAISE EXCEPTION 'Venda com combo precisa da tabela de preço' USING ERRCODE = '22023';
        END IF;
        -- Combo da campanha mandado como item avulso (tela antiga, ainda em cache no celular):
        -- sairia sem sabores, sem baixar o estoque dos doces e no preço do cadastro.
        IF EXISTS (
            SELECT 1
              FROM jsonb_array_elements(v_itens) it
              JOIN public.produtos pr ON pr.id = (it ->> 'produto_id')::uuid AND pr.eh_combo
             WHERE EXISTS (SELECT 1 FROM public.loja_precos lp WHERE lp.produto_id = pr.id)
        ) THEN
            RAISE EXCEPTION 'Combo da campanha vai como combo, com os sabores (atualize o sistema e tente de novo)'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        IF p_tabela NOT IN ('pix', 'cartao', 'normal') THEN
            RAISE EXCEPTION 'Tabela de preço inválida: %', p_tabela USING ERRCODE = '22023';
        END IF;
        -- A tabela tem que bater com a forma de pagamento quando a forma já diz qual é.
        IF (p_forma_pagamento IN ('fiado', 'brinde') AND p_tabela <> 'normal')
           OR (p_forma_pagamento IN ('pix', 'dinheiro') AND p_tabela <> 'pix')
           OR (p_forma_pagamento = 'cartao' AND p_tabela <> 'cartao') THEN
            RAISE EXCEPTION 'Tabela % não vale para venda %', p_tabela, p_forma_pagamento
                USING ERRCODE = '22023';
        END IF;

        -- O servidor decide o preço de tudo: avulso pela tabela, combo pela função comum,
        -- ambos no preço vigente em v_preco_em.
        v_linhas := '[]'::jsonb;
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_itens) LOOP
            IF v_item ? 'combo_id' THEN
                v_qtd := (v_item ->> 'quantidade')::numeric;
                IF v_qtd IS NULL OR v_qtd < 1 OR v_qtd <> trunc(v_qtd) THEN
                    RAISE EXCEPTION 'Quantidade de combo inválida: %', v_item ->> 'quantidade'
                        USING ERRCODE = '22023';
                END IF;
                FOR i IN 1..v_qtd::integer LOOP
                    v_instancia := gen_random_uuid();
                    SELECT v_linhas || COALESCE(jsonb_agg(jsonb_build_object(
                               'produto_id', ci.produto_id,
                               'quantidade', ci.quantidade,
                               'preco_unitario', ci.preco_unitario,
                               'subtotal', ci.subtotal,
                               'combo_id', v_item ->> 'combo_id',
                               'combo_instancia', v_instancia)), '[]'::jsonb)
                      INTO v_linhas
                      FROM public.combo_itens((v_item ->> 'combo_id')::uuid, v_item -> 'escolhas', p_tabela, v_preco_em) ci;
                END LOOP;
            ELSE
                IF EXISTS (
                    SELECT 1 FROM public.produtos pr
                     WHERE pr.id = (v_item ->> 'produto_id')::uuid AND pr.eh_combo
                ) THEN
                    RAISE EXCEPTION 'Combo deve ir como combo (com os sabores), não como item avulso'
                        USING ERRCODE = '22023';
                END IF;
                v_qtd := (v_item ->> 'quantidade')::numeric;
                IF v_qtd IS NULL OR v_qtd <= 0 THEN
                    RAISE EXCEPTION 'Quantidade inválida: %', v_item ->> 'quantidade' USING ERRCODE = '22023';
                END IF;
                v_preco := public.preco_tabela((v_item ->> 'produto_id')::uuid, p_tabela, v_preco_em);
                v_linhas := v_linhas || jsonb_build_object(
                    'produto_id', v_item ->> 'produto_id',
                    'quantidade', v_qtd,
                    'preco_unitario', v_preco,
                    'subtotal', round(v_preco * v_qtd, 2));
            END IF;
        END LOOP;
        v_itens := v_linhas;
    END IF;

    SELECT COALESCE(sum((it->>'subtotal')::numeric), 0)
      INTO v_subtotais
      FROM jsonb_array_elements(v_itens) AS it;
    v_total := GREATEST(v_subtotais - COALESCE(p_desconto, 0), 0) + COALESCE(p_taxa_entrega, 0);

    SELECT COALESCE(sum((it->>'quantidade')::numeric * COALESCE(pr.custo, 0)), 0)
      INTO v_custo_total
      FROM jsonb_array_elements(v_itens) AS it
      JOIN public.produtos pr ON pr.id = (it->>'produto_id')::uuid;

    INSERT INTO public.vendas (
        contato_id, data, status, total, pago, forma_pagamento,
        taxa_entrega, data_prevista_pagamento, custo_total, idempotency_key,
        entregador_id, observacao_entregador, dinheiro_na_entrega, desconto,
        data_entrega_prevista, tabela_preco, origem, cat_pedido_id, observacoes
    ) VALUES (
        p_contato_id, p_data, COALESCE(p_status, 'pendente'), v_total, false, p_forma_pagamento,
        COALESCE(p_taxa_entrega, 0), p_data_prevista_pagamento, v_custo_total, p_idempotency_key,
        p_entregador_id, p_observacao_entregador, COALESCE(p_dinheiro_na_entrega, false), COALESCE(p_desconto, 0),
        p_data_entrega_prevista, p_tabela, COALESCE(p_origem, 'direto'), p_cat_pedido_id, p_observacoes
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
        venda_id, produto_id, quantidade, preco_unitario, subtotal, custo_unitario,
        combo_id, combo_instancia
    )
    SELECT
        v_venda_id,
        (it->>'produto_id')::uuid,
        (it->>'quantidade')::numeric,
        (it->>'preco_unitario')::numeric,
        (it->>'subtotal')::numeric,
        COALESCE(pr.custo, 0),
        NULLIF(it->>'combo_id', '')::uuid,
        NULLIF(it->>'combo_instancia', '')::uuid
    FROM jsonb_array_elements(v_itens) AS it
    JOIN public.produtos pr ON pr.id = (it->>'produto_id')::uuid;

    RETURN v_venda_id;
END;
$function$;

-- Interna: a Nova Venda usa a criar_venda (preço de agora); só funções do banco usam esta.
REVOKE ALL ON FUNCTION public.criar_venda_em(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text, timestamptz, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_venda_em(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text, timestamptz, text, uuid, text) TO service_role;

-- ── criar_venda: mesma assinatura e mesmo comportamento, agora um invólucro ──
CREATE OR REPLACE FUNCTION public.criar_venda(p_contato_id uuid, p_data date, p_forma_pagamento text, p_taxa_entrega numeric, p_itens jsonb, p_idempotency_key uuid, p_data_prevista_pagamento date DEFAULT NULL::date, p_entregador_id uuid DEFAULT NULL::uuid, p_observacao_entregador text DEFAULT NULL::text, p_dinheiro_na_entrega boolean DEFAULT false, p_desconto numeric DEFAULT 0, p_status text DEFAULT 'pendente'::text, p_data_entrega_prevista date DEFAULT NULL::date, p_tabela text DEFAULT NULL::text)
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

    RETURN public.criar_venda_em(
        p_contato_id, p_data, p_forma_pagamento, p_taxa_entrega, p_itens, p_idempotency_key,
        p_data_prevista_pagamento, p_entregador_id, p_observacao_entregador, p_dinheiro_na_entrega,
        p_desconto, p_status, p_data_entrega_prevista, p_tabela,
        now(), NULL, NULL, NULL);
END;
$function$;

-- ── Formato único do endereço em texto ───────────────────────────────────────
CREATE FUNCTION public.loja_endereco_texto(p_logradouro text, p_numero text, p_complemento text, p_bairro text, p_cidade text, p_uf text, p_cep text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT concat_ws(' - ',
           concat_ws(', ', NULLIF(btrim(p_logradouro), ''), NULLIF(btrim(p_numero), '')),
           NULLIF(btrim(p_complemento), ''),
           concat_ws(', ', NULLIF(btrim(p_bairro), ''),
                     concat_ws('/', NULLIF(btrim(p_cidade), ''), NULLIF(btrim(p_uf), ''))),
           CASE WHEN p_cep ~ '^\d{8}$' THEN 'CEP ' || substr(p_cep, 1, 5) || '-' || substr(p_cep, 6) END)
$$;

REVOKE ALL ON FUNCTION public.loja_endereco_texto(text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loja_endereco_texto(text, text, text, text, text, text, text) TO authenticated, service_role;

-- ── loja_criar_pedido: chamado só pelo servidor da loja (service_role) ───────
CREATE FUNCTION public.loja_criar_pedido(
    p_chave uuid, p_nome text, p_telefone text,
    p_cep text, p_logradouro text, p_numero text, p_complemento text, p_bairro text, p_cidade text, p_uf text,
    p_itens jsonb, p_ofertas boolean, p_ofertas_texto text)
RETURNS TABLE(pedido_id uuid, numero_pedido integer, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_pedido     public.cat_pedidos%ROWTYPE;
    v_nome       text := btrim(regexp_replace(COALESCE(p_nome, ''), '\s+', ' ', 'g'));
    v_tel        text := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
    v_cep        text := regexp_replace(COALESCE(p_cep, ''), '\D', '', 'g');
    v_uf         text := upper(btrim(COALESCE(p_uf, '')));
    v_item       jsonb;
    v_itens      jsonb := '[]'::jsonb;   -- sacola normalizada (só as chaves conhecidas)
    v_linhas     jsonb := '[]'::jsonb;   -- linhas precificadas
    v_instancia  uuid;
    v_qtd        integer;
    v_produto    record;
    v_total      numeric;
BEGIN
    IF p_chave IS NULL THEN
        RAISE EXCEPTION 'Pedido sem chave' USING ERRCODE = '22023';
    END IF;

    -- Mesmo envio de novo (toque duplo, rede instável): devolve o pedido já gravado.
    SELECT * INTO v_pedido FROM public.cat_pedidos cp WHERE cp.chave_idempotencia = p_chave;
    IF FOUND THEN
        RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.total;
        RETURN;
    END IF;

    -- ── Dados do cliente ──
    IF length(v_nome) < 2 OR length(v_nome) > 80 THEN
        RAISE EXCEPTION 'Informe seu nome' USING ERRCODE = '22023';
    END IF;
    IF length(v_tel) IN (12, 13) AND left(v_tel, 2) = '55' THEN
        v_tel := substr(v_tel, 3);
    END IF;
    IF v_tel !~ '^[1-9]{2}9\d{8}$' THEN
        RAISE EXCEPTION 'WhatsApp inválido' USING ERRCODE = '22023';
    END IF;
    IF v_cep !~ '^\d{8}$' THEN
        RAISE EXCEPTION 'CEP inválido' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(COALESCE(p_logradouro, ''))) < 2 OR length(btrim(COALESCE(p_numero, ''))) < 1
       OR length(btrim(COALESCE(p_cidade, ''))) < 2 OR v_uf !~ '^[A-Z]{2}$' THEN
        RAISE EXCEPTION 'Endereço incompleto' USING ERRCODE = '22023';
    END IF;
    IF length(COALESCE(p_logradouro, '')) > 120 OR length(COALESCE(p_numero, '')) > 20
       OR length(COALESCE(p_complemento, '')) > 120 OR length(COALESCE(p_bairro, '')) > 80
       OR length(COALESCE(p_cidade, '')) > 80 THEN
        RAISE EXCEPTION 'Endereço longo demais' USING ERRCODE = '22023';
    END IF;

    -- ── Sacola ──
    IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
        RAISE EXCEPTION 'Sacola vazia' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_itens) > 30 THEN
        RAISE EXCEPTION 'Sacola grande demais' USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
        IF v_item ? 'combo_id' THEN
            -- Combo: precisa estar na vitrine; combo_itens valida sabores e a campanha.
            SELECT p.id, p.nome INTO v_produto
              FROM public.produtos p
              JOIN public.loja_vitrine lv ON lv.produto_id = p.id
             WHERE p.id = (v_item ->> 'combo_id')::uuid AND p.eh_combo AND p.ativo
               AND lv.visivel AND lv.disponivel;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Combo indisponível' USING ERRCODE = '22023';
            END IF;
            v_instancia := gen_random_uuid();
            SELECT v_linhas || COALESCE(jsonb_agg(jsonb_build_object(
                       'produto_id', ci.produto_id, 'quantidade', ci.quantidade,
                       'preco_unitario', ci.preco_unitario, 'subtotal', ci.subtotal,
                       'combo_id', v_produto.id, 'combo_instancia', v_instancia)), '[]'::jsonb)
              INTO v_linhas
              FROM public.combo_itens(v_produto.id, COALESCE(v_item -> 'escolhas', '[]'::jsonb), 'pix') ci;
            v_itens := v_itens || jsonb_build_object(
                'combo_id', v_produto.id, 'quantidade', 1,
                'escolhas', COALESCE(v_item -> 'escolhas', '[]'::jsonb));
        ELSE
            IF jsonb_typeof(v_item -> 'quantidade') IS DISTINCT FROM 'number'
               OR (v_item ->> 'quantidade')::numeric <> trunc((v_item ->> 'quantidade')::numeric)
               OR (v_item ->> 'quantidade')::numeric NOT BETWEEN 1 AND 50 THEN
                RAISE EXCEPTION 'Quantidade inválida' USING ERRCODE = '22023';
            END IF;
            v_qtd := (v_item ->> 'quantidade')::integer;
            SELECT p.id, p.nome INTO v_produto
              FROM public.produtos p
              JOIN public.loja_vitrine lv ON lv.produto_id = p.id
             WHERE p.id = (v_item ->> 'produto_id')::uuid AND NOT p.eh_combo AND p.ativo
               AND lv.visivel AND lv.disponivel;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Produto indisponível' USING ERRCODE = '22023';
            END IF;
            v_linhas := v_linhas || jsonb_build_object(
                'produto_id', v_produto.id, 'quantidade', v_qtd,
                'preco_unitario', public.preco_tabela(v_produto.id, 'pix'),
                'subtotal', round(public.preco_tabela(v_produto.id, 'pix') * v_qtd, 2));
            v_itens := v_itens || jsonb_build_object('produto_id', v_produto.id, 'quantidade', v_qtd);
        END IF;
    END LOOP;

    -- Estoque (doces): soma de avulsos e sabores de combo, contra o estoque, e chave manual.
    SELECT p.nome INTO v_produto
      FROM (SELECT (l ->> 'produto_id')::uuid AS pid, sum((l ->> 'quantidade')::numeric) AS q
              FROM jsonb_array_elements(v_linhas) l GROUP BY 1) x
      JOIN public.produtos p ON p.id = x.pid
      JOIN public.loja_vitrine lv ON lv.produto_id = p.id
     WHERE NOT lv.disponivel OR (lv.usa_estoque AND COALESCE(p.estoque_atual, 0) < x.q)
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Sem estoque suficiente: %', v_produto.nome USING ERRCODE = '22023';
    END IF;

    SELECT sum((l ->> 'subtotal')::numeric) INTO v_total FROM jsonb_array_elements(v_linhas) l;

    INSERT INTO public.cat_pedidos (
        nome_cliente, telefone_cliente, endereco_entrega, metodo_entrega, status, status_pagamento,
        subtotal, frete, total, canal, cep, logradouro, numero, complemento, bairro, cidade, uf,
        itens_loja, ofertas_whatsapp, ofertas_texto, chave_idempotencia
    ) VALUES (
        v_nome, v_tel,
        public.loja_endereco_texto(p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, v_uf, v_cep),
        'entrega', 'pendente', 'pendente',
        v_total, NULL, v_total, 'loja', v_cep, btrim(p_logradouro), btrim(p_numero),
        NULLIF(btrim(COALESCE(p_complemento, '')), ''), NULLIF(btrim(COALESCE(p_bairro, '')), ''),
        btrim(p_cidade), v_uf, v_itens, COALESCE(p_ofertas, false),
        CASE WHEN COALESCE(p_ofertas, false) THEN p_ofertas_texto END, p_chave
    )
    RETURNING * INTO v_pedido;

    INSERT INTO public.cat_itens_pedido (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, total, combo_id, combo_instancia)
    SELECT v_pedido.id, (l ->> 'produto_id')::uuid, p.nome, (l ->> 'quantidade')::integer,
           (l ->> 'preco_unitario')::numeric, (l ->> 'subtotal')::numeric,
           NULLIF(l ->> 'combo_id', '')::uuid, NULLIF(l ->> 'combo_instancia', '')::uuid
      FROM jsonb_array_elements(v_linhas) l
      JOIN public.produtos p ON p.id = (l ->> 'produto_id')::uuid;

    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.total;
END;
$function$;

REVOKE ALL ON FUNCTION public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text) TO service_role;

-- ── loja_confirmar_pedido: o pedido vira venda (admin, idempotente) ─────────
CREATE FUNCTION public.loja_confirmar_pedido(
    p_pedido_id uuid, p_taxa_entrega numeric, p_data_entrega date, p_forma_pagamento text,
    p_atualizar_endereco boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_pedido   public.cat_pedidos%ROWTYPE;
    v_venda_id uuid;
    v_contato  uuid;
    v_itens    jsonb;
    v_endereco text;
BEGIN
    IF NOT (SELECT public.is_admin()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
    END IF;

    -- Trava o pedido: dois toques (ou dois aparelhos) esperam um pelo outro.
    SELECT * INTO v_pedido FROM public.cat_pedidos WHERE id = p_pedido_id FOR UPDATE;
    IF NOT FOUND OR v_pedido.canal <> 'loja' THEN
        RAISE EXCEPTION 'Pedido da loja não encontrado' USING ERRCODE = '22023';
    END IF;

    -- Já confirmado: devolve a mesma venda.
    SELECT v.id INTO v_venda_id FROM public.vendas v WHERE v.cat_pedido_id = p_pedido_id;
    IF v_venda_id IS NOT NULL THEN
        RETURN v_venda_id;
    END IF;

    IF v_pedido.status = 'cancelado' THEN
        RAISE EXCEPTION 'Pedido #% foi descartado', v_pedido.numero_pedido USING ERRCODE = '22023';
    END IF;
    IF p_forma_pagamento IS NULL OR p_forma_pagamento NOT IN ('pix', 'dinheiro', 'cartao') THEN
        RAISE EXCEPTION 'Forma de pagamento inválida' USING ERRCODE = '22023';
    END IF;
    IF p_taxa_entrega IS NULL OR p_taxa_entrega < 0 OR p_taxa_entrega > 500 THEN
        RAISE EXCEPTION 'Frete inválido' USING ERRCODE = '22023';
    END IF;
    IF p_data_entrega IS NULL THEN
        RAISE EXCEPTION 'Informe a data de entrega' USING ERRCODE = '22023';
    END IF;

    v_endereco := public.loja_endereco_texto(v_pedido.logradouro, v_pedido.numero, v_pedido.complemento,
                                             v_pedido.bairro, v_pedido.cidade, v_pedido.uf, v_pedido.cep);

    -- Contato pelo telefone. Existente: só preenche o que está vazio (a loja nunca sobrescreve),
    -- a não ser que o Gilmar marque para trocar o endereço pelo do pedido.
    SELECT c.id INTO v_contato FROM public.contatos c WHERE c.telefone_norm = v_pedido.telefone_cliente;
    IF v_contato IS NULL THEN
        INSERT INTO public.contatos (
            nome, telefone, tipo, status, origem, origem_cadastro,
            cep, logradouro, numero, complemento, bairro, cidade, uf, endereco
        ) VALUES (
            v_pedido.nome_cliente, v_pedido.telefone_cliente, 'B2C', 'cliente', 'loja', 'loja',
            v_pedido.cep, v_pedido.logradouro, v_pedido.numero, v_pedido.complemento,
            v_pedido.bairro, v_pedido.cidade, v_pedido.uf, v_endereco
        )
        RETURNING id INTO v_contato;
    ELSIF COALESCE(p_atualizar_endereco, false) THEN
        UPDATE public.contatos SET
            cep = v_pedido.cep, logradouro = v_pedido.logradouro, numero = v_pedido.numero,
            complemento = v_pedido.complemento, bairro = v_pedido.bairro, cidade = v_pedido.cidade,
            uf = v_pedido.uf, endereco = v_endereco
         WHERE id = v_contato;
    ELSE
        UPDATE public.contatos SET
            cep = COALESCE(NULLIF(btrim(cep), ''), v_pedido.cep),
            logradouro = COALESCE(NULLIF(btrim(logradouro), ''), v_pedido.logradouro),
            numero = COALESCE(NULLIF(btrim(numero), ''), v_pedido.numero),
            complemento = COALESCE(NULLIF(btrim(complemento), ''), v_pedido.complemento),
            bairro = COALESCE(NULLIF(btrim(bairro), ''), v_pedido.bairro),
            cidade = COALESCE(NULLIF(btrim(cidade), ''), v_pedido.cidade),
            uf = COALESCE(NULLIF(btrim(uf), ''), v_pedido.uf),
            endereco = COALESCE(NULLIF(btrim(endereco), ''), v_endereco)
         WHERE id = v_contato;
    END IF;

    -- A sacola do cliente, no formato da criar_venda.
    SELECT COALESCE(jsonb_agg(CASE WHEN i ? 'combo_id'
                                   THEN jsonb_build_object('combo_id', i -> 'combo_id', 'quantidade', 1, 'escolhas', i -> 'escolhas')
                                   ELSE jsonb_build_object('produto_id', i -> 'produto_id', 'quantidade', i -> 'quantidade') END),
                    '[]'::jsonb)
      INTO v_itens
      FROM jsonb_array_elements(COALESCE(v_pedido.itens_loja, '[]'::jsonb)) i;

    -- Preço do momento do pedido (o que o cliente viu), na tabela da forma de pagamento.
    v_venda_id := public.criar_venda_em(
        v_contato,
        (now() AT TIME ZONE 'America/Sao_Paulo')::date,
        p_forma_pagamento,
        p_taxa_entrega,
        v_itens,
        p_pedido_id,                                   -- idempotency_key: um pedido, uma venda
        NULL, NULL, NULL,
        p_forma_pagamento = 'dinheiro',                -- dinheiro: o entregador recebe na entrega
        0,
        'pendente',
        p_data_entrega,
        CASE p_forma_pagamento WHEN 'cartao' THEN 'cartao' ELSE 'pix' END,
        v_pedido.criado_em,
        'loja',
        p_pedido_id,
        'Pedido da loja #' || v_pedido.numero_pedido);

    UPDATE public.cat_pedidos SET
        status = 'confirmado',
        contato_id = v_contato,
        metodo_pagamento = p_forma_pagamento,
        frete = p_taxa_entrega,
        total = (SELECT v.total FROM public.vendas v WHERE v.id = v_venda_id),
        atualizado_em = now()
     WHERE id = p_pedido_id;

    RETURN v_venda_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.loja_confirmar_pedido(uuid, numeric, date, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loja_confirmar_pedido(uuid, numeric, date, text, boolean) TO authenticated, service_role;

-- ── loja_descartar_pedido (admin) ────────────────────────────────────────────
CREATE FUNCTION public.loja_descartar_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_pedido public.cat_pedidos%ROWTYPE;
BEGIN
    IF NOT (SELECT public.is_admin()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_pedido FROM public.cat_pedidos WHERE id = p_pedido_id FOR UPDATE;
    IF NOT FOUND OR v_pedido.canal <> 'loja' THEN
        RAISE EXCEPTION 'Pedido da loja não encontrado' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.vendas v WHERE v.cat_pedido_id = p_pedido_id) THEN
        RAISE EXCEPTION 'Pedido #% já virou venda; para desfazer, exclua a venda', v_pedido.numero_pedido
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.cat_pedidos SET status = 'cancelado', atualizado_em = now()
     WHERE id = p_pedido_id AND status <> 'cancelado';
END;
$function$;

REVOKE ALL ON FUNCTION public.loja_descartar_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loja_descartar_pedido(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
