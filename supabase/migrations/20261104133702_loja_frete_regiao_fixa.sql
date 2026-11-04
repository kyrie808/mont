-- Frete, regra final (04/11/2026): o frete estimado do pedido da loja também pode ser o valor fixo
-- da região (frete_config.regiaoFixa, o ABC = R$ 5), além dos valores das faixas de distância.
-- Backup antes: supabase/backups/dumps/dump-*-20261104-103301.sql
-- Mesma assinatura; só muda a checagem do frete estimado. Sem regiaoFixa configurada, nada muda.

CREATE OR REPLACE FUNCTION public.loja_criar_pedido(
    p_chave uuid, p_nome text, p_telefone text, p_cep text, p_logradouro text, p_numero text,
    p_complemento text, p_bairro text, p_cidade text, p_uf text, p_itens jsonb, p_ofertas boolean,
    p_ofertas_texto text, p_atribuicao jsonb DEFAULT NULL,
    p_entrega text DEFAULT 'entrega', p_pagamento text DEFAULT NULL,
    p_indicado_por text DEFAULT NULL, p_frete_estimado numeric DEFAULT NULL)
 RETURNS TABLE(pedido_id uuid, numero_pedido integer, total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_pedido     public.cat_pedidos%ROWTYPE;
    v_nome       text := btrim(regexp_replace(COALESCE(p_nome, ''), '\s+', ' ', 'g'));
    v_tel        text := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
    v_cep        text := regexp_replace(COALESCE(p_cep, ''), '\D', '', 'g');
    v_uf         text := upper(btrim(COALESCE(p_uf, '')));
    v_entrega    text := COALESCE(p_entrega, 'entrega');
    v_retirada   boolean;
    v_indicado   text := NULLIF(left(btrim(regexp_replace(COALESCE(p_indicado_por, ''), '\s+', ' ', 'g')), 80), '');
    v_frete      numeric;
    v_item       jsonb;
    v_itens      jsonb := '[]'::jsonb;
    v_linhas     jsonb := '[]'::jsonb;
    v_instancia  uuid;
    v_qtd        integer;
    v_produto    record;
    v_total      numeric;
    v_campanha   uuid := public.campanha_vigente(now());
    v_atr        jsonb := CASE WHEN jsonb_typeof(p_atribuicao) = 'object' THEN p_atribuicao ELSE '{}'::jsonb END;
    v_fbp        text;
    v_fbc        text;
BEGIN
    IF p_chave IS NULL THEN
        RAISE EXCEPTION 'Pedido sem chave' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_pedido FROM public.cat_pedidos cp WHERE cp.chave_idempotencia = p_chave;
    IF FOUND THEN
        RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.total;
        RETURN;
    END IF;

    IF v_entrega NOT IN ('entrega', 'retirada') THEN
        RAISE EXCEPTION 'Forma de entrega inválida' USING ERRCODE = '22023';
    END IF;
    v_retirada := v_entrega = 'retirada';
    IF p_pagamento IS NOT NULL AND p_pagamento NOT IN ('pix', 'dinheiro', 'cartao') THEN
        RAISE EXCEPTION 'Forma de pagamento inválida' USING ERRCODE = '22023';
    END IF;

    IF length(v_nome) < 2 OR length(v_nome) > 80 THEN
        RAISE EXCEPTION 'Informe seu nome' USING ERRCODE = '22023';
    END IF;
    IF length(v_tel) IN (12, 13) AND left(v_tel, 2) = '55' THEN
        v_tel := substr(v_tel, 3);
    END IF;
    IF v_tel !~ '^[1-9]{2}9\d{8}$' THEN
        RAISE EXCEPTION 'WhatsApp inválido' USING ERRCODE = '22023';
    END IF;
    IF NOT v_retirada THEN
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
    END IF;

    -- Frete estimado: só um valor configurado — o fixo da região (ABC) ou o de uma faixa de distância
    -- (o servidor da loja calcula pelo CEP). Qualquer outro valor vira "a combinar", sem recusar o
    -- pedido. Retirada não tem frete.
    IF NOT v_retirada AND p_frete_estimado IS NOT NULL AND p_frete_estimado > 0 AND p_frete_estimado <= 500
       AND EXISTS (
           SELECT 1
             FROM public.configuracoes c
            WHERE c.chave = 'frete_config'
              AND (
                    ((c.valor -> 'regiaoFixa' ->> 'valor') ~ '^\d+(\.\d+)?$'
                     AND (c.valor -> 'regiaoFixa' ->> 'valor')::numeric = p_frete_estimado)
                 OR EXISTS (
                        SELECT 1
                          FROM jsonb_array_elements(COALESCE(c.valor -> 'faixas', '[]'::jsonb)) f
                         WHERE (f ->> 'valorFixo') ~ '^\d+(\.\d+)?$'
                           AND (f ->> 'valorFixo')::numeric = p_frete_estimado)
              )
       ) THEN
        v_frete := p_frete_estimado;
    END IF;

    IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
        RAISE EXCEPTION 'Sacola vazia' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_itens) > 30 THEN
        RAISE EXCEPTION 'Sacola grande demais' USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
        IF v_item ? 'combo_id' THEN
            -- Combo à venda: ativo, não marcado "Esgotado" e (de campanha valendo, ou visível no catálogo).
            SELECT p.id, p.nome INTO v_produto
              FROM public.produtos p
             WHERE p.id = (v_item ->> 'combo_id')::uuid AND p.eh_combo AND p.ativo AND NOT p.esgotado
               AND (
                     EXISTS (SELECT 1 FROM public.loja_precos lp
                              WHERE lp.produto_id = p.id AND lp.campanha_id = v_campanha)
                     OR (p.visivel_catalogo
                         AND NOT EXISTS (SELECT 1 FROM public.loja_precos lp WHERE lp.produto_id = p.id))
                   );
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
            -- Produto à venda: ativo, visível no catálogo e não marcado "Esgotado".
            SELECT p.id, p.nome INTO v_produto
              FROM public.produtos p
             WHERE p.id = (v_item ->> 'produto_id')::uuid AND NOT p.eh_combo AND p.ativo AND p.visivel_catalogo
               AND NOT p.esgotado;
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

    -- Item fixo ou sabor de combo marcado "Esgotado".
    SELECT p.nome INTO v_produto
      FROM jsonb_array_elements(v_linhas) l
      JOIN public.produtos p ON p.id = (l ->> 'produto_id')::uuid
     WHERE p.esgotado
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Esgotado: %', v_produto.nome USING ERRCODE = '22023';
    END IF;

    SELECT sum((l ->> 'subtotal')::numeric) INTO v_total FROM jsonb_array_elements(v_linhas) l;

    -- Atribuição: só o formato dos cookies da Meta (fb.<sub>.<ms>.<id>); o resto vira NULL.
    v_fbp := v_atr ->> 'fbp';
    IF v_fbp IS NULL OR length(v_fbp) > 100 OR v_fbp !~ '^fb\.[0-9]\.[0-9]{10,13}\.[0-9]+$' THEN
        v_fbp := NULL;
    END IF;
    v_fbc := v_atr ->> 'fbc';
    IF v_fbc IS NULL OR length(v_fbc) > 600 OR v_fbc !~ '^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9_.-]+$' THEN
        v_fbc := NULL;
    END IF;

    INSERT INTO public.cat_pedidos (
        nome_cliente, telefone_cliente, endereco_entrega, metodo_entrega, metodo_pagamento, status,
        status_pagamento, subtotal, frete, frete_estimado, total, canal, cep, logradouro, numero,
        complemento, bairro, cidade, uf, itens_loja, ofertas_whatsapp, ofertas_texto,
        chave_idempotencia, indicado_por,
        fbp, fbc, utm_source, utm_medium, utm_campaign, utm_content, utm_term
    ) VALUES (
        v_nome, v_tel,
        CASE WHEN v_retirada THEN NULL
             ELSE public.loja_endereco_texto(p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, v_uf, v_cep) END,
        v_entrega, p_pagamento, 'pendente', 'pendente',
        v_total, NULL, v_frete, v_total, 'loja',
        CASE WHEN v_retirada THEN NULL ELSE v_cep END,
        CASE WHEN v_retirada THEN NULL ELSE btrim(p_logradouro) END,
        CASE WHEN v_retirada THEN NULL ELSE btrim(p_numero) END,
        CASE WHEN v_retirada THEN NULL ELSE NULLIF(btrim(COALESCE(p_complemento, '')), '') END,
        CASE WHEN v_retirada THEN NULL ELSE NULLIF(btrim(COALESCE(p_bairro, '')), '') END,
        CASE WHEN v_retirada THEN NULL ELSE btrim(p_cidade) END,
        CASE WHEN v_retirada THEN NULL ELSE v_uf END,
        v_itens, COALESCE(p_ofertas, false),
        CASE WHEN COALESCE(p_ofertas, false) THEN p_ofertas_texto END, p_chave, v_indicado,
        v_fbp, v_fbc,
        NULLIF(left(btrim(v_atr ->> 'utm_source'), 200), ''),
        NULLIF(left(btrim(v_atr ->> 'utm_medium'), 200), ''),
        NULLIF(left(btrim(v_atr ->> 'utm_campaign'), 200), ''),
        NULLIF(left(btrim(v_atr ->> 'utm_content'), 200), ''),
        NULLIF(left(btrim(v_atr ->> 'utm_term'), 200), '')
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
