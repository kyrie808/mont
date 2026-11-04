-- Parte F da paridade (04/11/2026): checkout da loja com retirada, frete estimado pelo CEP,
-- forma de pagamento preferida e "indicado por" (que conta no Ranking ao confirmar).
-- Backup antes: supabase/backups/dumps/dump-*-20261104-090820.sql
--
-- * cat_pedidos.frete_estimado: frete calculado pelo CEP no servidor da loja (faixas da
--   configuracoes.frete_config). NULL = "a combinar". O frete que vale continua sendo o da
--   confirmação (cat_pedidos.frete), escolhido pelo Gilmar.
-- * loja_criar_pedido ganha 4 argumentos opcionais no fim (a loja no ar segue chamando sem eles):
--     p_entrega 'entrega' | 'retirada' (retirada: sem endereço e sem frete);
--     p_pagamento 'pix' | 'dinheiro' | 'cartao' (preferência; a forma final é a da confirmação);
--     p_indicado_por (texto livre do cliente, até 80 letras);
--     p_frete_estimado (só vale um valor das faixas configuradas; fora disso vira "a combinar").
--   Nada disso recusa o pedido, exceto entrega/pagamento com valor desconhecido.
-- * loja_confirmar_pedido ganha p_indicado_por_id (opcional): liga o cliente a quem indicou
--   (contatos.indicado_por_id, que alimenta o Ranking de Indicações), só se ele ainda não tiver.
--   Na retirada: frete 0, sem endereço no cadastro, sem "dinheiro na entrega" e o dia vai na
--   observação da venda (sem data de entrega, para não sair aviso no #ENTREGAS).

ALTER TABLE public.cat_pedidos
  ADD COLUMN frete_estimado numeric,
  ADD CONSTRAINT cat_pedidos_frete_estimado_faixa CHECK (frete_estimado IS NULL OR (frete_estimado > 0 AND frete_estimado <= 500));
COMMENT ON COLUMN public.cat_pedidos.frete_estimado IS
  'Frete estimado pelo CEP na loja (faixas de frete_config). NULL = a combinar. O frete final é cat_pedidos.frete.';

-- ── loja_criar_pedido com entrega/retirada, pagamento, indicado por e frete estimado ──
-- DROP + CREATE: com argumentos a mais, o REPLACE criaria uma segunda versão e o PostgREST
-- não saberia qual chamar.
DROP FUNCTION public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, jsonb);

CREATE FUNCTION public.loja_criar_pedido(
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

    -- Frete estimado: só um valor das faixas configuradas (o servidor da loja calcula pelo CEP).
    -- Qualquer outro valor vira "a combinar", sem recusar o pedido. Retirada não tem frete.
    IF NOT v_retirada AND p_frete_estimado IS NOT NULL AND p_frete_estimado > 0 AND p_frete_estimado <= 500
       AND EXISTS (
           SELECT 1
             FROM public.configuracoes c,
                  jsonb_array_elements(COALESCE(c.valor -> 'faixas', '[]'::jsonb)) f
            WHERE c.chave = 'frete_config'
              AND (f ->> 'valorFixo') ~ '^\d+(\.\d+)?$'
              AND (f ->> 'valorFixo')::numeric = p_frete_estimado
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

-- Só o servidor da loja grava pedido (igual à versão anterior).
REVOKE ALL ON FUNCTION public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, jsonb, text, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, jsonb, text, text, text, numeric) TO service_role;

-- ── loja_confirmar_pedido com retirada e "indicado por" ──
DROP FUNCTION public.loja_confirmar_pedido(uuid, numeric, date, text, boolean);

CREATE FUNCTION public.loja_confirmar_pedido(
    p_pedido_id uuid, p_taxa_entrega numeric, p_data_entrega date, p_forma_pagamento text,
    p_atualizar_endereco boolean DEFAULT false, p_indicado_por_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_pedido   public.cat_pedidos%ROWTYPE;
    v_venda_id uuid;
    v_contato  uuid;
    v_itens    jsonb;
    v_endereco text;
    v_retirada boolean;
    v_taxa     numeric;
BEGIN
    IF NOT (SELECT public.is_admin()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_pedido FROM public.cat_pedidos WHERE id = p_pedido_id FOR UPDATE;
    IF NOT FOUND OR v_pedido.canal <> 'loja' THEN
        RAISE EXCEPTION 'Pedido da loja não encontrado' USING ERRCODE = '22023';
    END IF;

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

    v_retirada := COALESCE(v_pedido.metodo_entrega, 'entrega') = 'retirada';
    -- Retirada não tem frete, venha o que vier da tela.
    v_taxa := CASE WHEN v_retirada THEN 0 ELSE p_taxa_entrega END;

    v_endereco := public.loja_endereco_texto(v_pedido.logradouro, v_pedido.numero, v_pedido.complemento,
                                             v_pedido.bairro, v_pedido.cidade, v_pedido.uf, v_pedido.cep);

    SELECT c.id INTO v_contato FROM public.contatos c WHERE c.telefone_norm = v_pedido.telefone_cliente;
    IF v_contato IS NULL THEN
        INSERT INTO public.contatos (
            nome, telefone, tipo, status, origem, origem_cadastro,
            cep, logradouro, numero, complemento, bairro, cidade, uf, endereco
        ) VALUES (
            v_pedido.nome_cliente, v_pedido.telefone_cliente, 'B2C', 'cliente', 'loja', 'loja',
            v_pedido.cep, v_pedido.logradouro, v_pedido.numero, v_pedido.complemento,
            v_pedido.bairro, v_pedido.cidade, v_pedido.uf, CASE WHEN v_retirada THEN NULL ELSE v_endereco END
        )
        RETURNING id INTO v_contato;
    ELSIF v_retirada THEN
        NULL; -- retirada não traz endereço: o cadastro fica como está
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

    -- "Indicado por": liga o cliente a quem indicou (Ranking de Indicações), só se ainda não tiver.
    IF p_indicado_por_id IS NOT NULL THEN
        IF p_indicado_por_id = v_contato THEN
            RAISE EXCEPTION 'O cliente não pode ser indicado por ele mesmo' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.contatos c WHERE c.id = p_indicado_por_id) THEN
            RAISE EXCEPTION 'Quem indicou não foi encontrado' USING ERRCODE = '22023';
        END IF;
        UPDATE public.contatos SET indicado_por_id = p_indicado_por_id
         WHERE id = v_contato AND indicado_por_id IS NULL;
    END IF;

    SELECT COALESCE(jsonb_agg(CASE WHEN i ? 'combo_id'
                                   THEN jsonb_build_object('combo_id', i -> 'combo_id', 'quantidade', 1, 'escolhas', i -> 'escolhas')
                                   ELSE jsonb_build_object('produto_id', i -> 'produto_id', 'quantidade', i -> 'quantidade') END),
                    '[]'::jsonb)
      INTO v_itens
      FROM jsonb_array_elements(COALESCE(v_pedido.itens_loja, '[]'::jsonb)) i;

    v_venda_id := public.criar_venda_em(
        v_contato,
        (now() AT TIME ZONE 'America/Sao_Paulo')::date,
        p_forma_pagamento,
        v_taxa,
        v_itens,
        p_pedido_id,
        NULL, NULL, NULL,
        p_forma_pagamento = 'dinheiro' AND NOT v_retirada,
        0,
        'pendente',
        -- Retirada fica sem data de entrega (não vira aviso no #ENTREGAS); o dia vai na observação.
        CASE WHEN v_retirada THEN NULL ELSE p_data_entrega END,
        CASE p_forma_pagamento WHEN 'cartao' THEN 'cartao' ELSE 'pix' END,
        v_pedido.criado_em,
        'loja',
        p_pedido_id,
        'Pedido da loja #' || v_pedido.numero_pedido
            || CASE WHEN v_retirada THEN ' · Retirada na Mont em ' || to_char(p_data_entrega, 'DD/MM') ELSE '' END);

    UPDATE public.cat_pedidos SET
        status = 'confirmado',
        contato_id = v_contato,
        metodo_pagamento = p_forma_pagamento,
        frete = v_taxa,
        total = (SELECT v.total FROM public.vendas v WHERE v.id = v_venda_id),
        atualizado_em = now()
     WHERE id = p_pedido_id;

    RETURN v_venda_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.loja_confirmar_pedido(uuid, numeric, date, text, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loja_confirmar_pedido(uuid, numeric, date, text, boolean, uuid) TO authenticated, service_role;
