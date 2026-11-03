-- Loja: pedido guarda a origem do clique (fbp, fbc e UTMs) e o Purchase da entrega leva o fbc/fbp.
--
-- Por quê: o Purchase sai do sistema na ENTREGA (fn_enfileirar_purchase_meta → meta_eventos →
-- meta-capi-worker), dias depois da visita ao site. Sem o clique guardado no pedido, a Meta só
-- casa a compra pelo telefone hasheado e não sabe de qual anúncio a pessoa veio.
--
-- 1. cat_pedidos: fbp, fbc (cookies do pixel, valor cru: a Meta não aceita hash) e as 5 UTMs.
-- 2. loja_criar_pedido ganha p_atribuicao jsonb (DEFAULT NULL; a loja publicada continua
--    chamando com 13 argumentos e cai na mesma função). Valor fora do formato vira NULL:
--    atribuição nunca recusa pedido.
-- 3. meta_eventos: fbp, fbc (foto do momento da entrega, igual ao ctwa_clid), lidos do pedido
--    ligado à venda (vendas.cat_pedido_id). O canal continua decidido no worker.
-- Suíte: supabase/tests/loja_atribuicao_meta.sql.

ALTER TABLE public.cat_pedidos
    ADD COLUMN fbp text,
    ADD COLUMN fbc text,
    ADD COLUMN utm_source text,
    ADD COLUMN utm_medium text,
    ADD COLUMN utm_campaign text,
    ADD COLUMN utm_content text,
    ADD COLUMN utm_term text;

COMMENT ON COLUMN public.cat_pedidos.fbp IS 'Cookie _fbp do pixel da Meta no envio do pedido da loja (cru).';
COMMENT ON COLUMN public.cat_pedidos.fbc IS 'Cookie _fbc (ou montado do fbclid da URL de entrada) no envio do pedido da loja (cru).';

ALTER TABLE public.meta_eventos
    ADD COLUMN fbp text,
    ADD COLUMN fbc text;

COMMENT ON COLUMN public.meta_eventos.fbc IS 'Clique do anúncio no site, copiado do pedido da loja ao enfileirar (vai cru no user_data).';

-- ── Purchase: leva o clique do pedido da loja ──
CREATE OR REPLACE FUNCTION public.fn_enfileirar_purchase_meta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ctwa_clid text;
  v_fbp text;
  v_fbc text;
BEGIN
  IF NEW.status = 'entregue'
     AND NEW.forma_pagamento <> 'brinde'
     AND (
       coalesce(NEW.origem, '') <> 'catalogo'
       OR NEW.criado_em >= TIMESTAMPTZ '2026-10-13 13:22:05+00'
     )
  THEN
    -- Snapshot do ctwa_clid do contato no momento da conversão.
    SELECT c.ctwa_clid INTO v_ctwa_clid
    FROM public.contatos c
    WHERE c.id = NEW.contato_id;

    -- Clique do site (pedido da loja): fbp/fbc gravados no envio do pedido.
    IF NEW.cat_pedido_id IS NOT NULL THEN
      SELECT cp.fbp, cp.fbc INTO v_fbp, v_fbc
      FROM public.cat_pedidos cp
      WHERE cp.id = NEW.cat_pedido_id;
    END IF;

    INSERT INTO public.meta_eventos (
      evento, event_id, contato_id, venda_id, event_time,
      valor, moeda, ctwa_clid, fbp, fbc, status
    )
    VALUES (
      'Purchase',
      'venda_' || NEW.id,
      NEW.contato_id,
      NEW.id,
      -- Momento da conversão: preferir data_entrega; senão data da venda; senão criação.
      coalesce(NEW.data_entrega::timestamptz, NEW.data::timestamptz, NEW.criado_em, now()),
      NEW.total,
      'BRL',
      v_ctwa_clid,
      v_fbp,
      v_fbc,
      'pendente'
    )
    ON CONFLICT (event_id) DO NOTHING;  -- idempotência
  END IF;

  RETURN NEW;
END;
$function$;

-- ── loja_criar_pedido com p_atribuicao ──
-- DROP + CREATE (e não só CREATE OR REPLACE): com um argumento a mais, o REPLACE criaria uma
-- segunda versão e o PostgREST não saberia qual chamar.
DROP FUNCTION public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text);

CREATE FUNCTION public.loja_criar_pedido(
    p_chave uuid, p_nome text, p_telefone text, p_cep text, p_logradouro text, p_numero text,
    p_complemento text, p_bairro text, p_cidade text, p_uf text, p_itens jsonb, p_ofertas boolean,
    p_ofertas_texto text, p_atribuicao jsonb DEFAULT NULL)
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
             WHERE p.id = (v_item ->> 'combo_id')::uuid AND p.eh_combo AND p.ativo
               AND (
                     EXISTS (SELECT 1 FROM public.loja_precos lp
                              WHERE lp.produto_id = p.id AND lp.campanha_id = v_campanha)
                     OR (p.visivel_catalogo
                         AND NOT EXISTS (SELECT 1 FROM public.loja_precos lp WHERE lp.produto_id = p.id))
                   )
               AND NOT EXISTS (SELECT 1 FROM public.loja_vitrine lv
                                WHERE lv.produto_id = p.id AND lv.visivel AND NOT lv.disponivel);
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
               AND NOT EXISTS (SELECT 1 FROM public.loja_vitrine lv
                                WHERE lv.produto_id = p.id AND lv.visivel AND NOT lv.disponivel);
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

    -- Esgotado ou sem estoque (quando a vitrine manda controlar), somando avulsos e itens de combo.
    SELECT p.nome INTO v_produto
      FROM (SELECT (l ->> 'produto_id')::uuid AS pid, sum((l ->> 'quantidade')::numeric) AS q
              FROM jsonb_array_elements(v_linhas) l GROUP BY 1) x
      JOIN public.produtos p ON p.id = x.pid
      JOIN public.loja_vitrine lv ON lv.produto_id = p.id AND lv.visivel
     WHERE NOT lv.disponivel OR (lv.usa_estoque AND COALESCE(p.estoque_atual, 0) < x.q)
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Sem estoque suficiente: %', v_produto.nome USING ERRCODE = '22023';
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
        nome_cliente, telefone_cliente, endereco_entrega, metodo_entrega, status, status_pagamento,
        subtotal, frete, total, canal, cep, logradouro, numero, complemento, bairro, cidade, uf,
        itens_loja, ofertas_whatsapp, ofertas_texto, chave_idempotencia,
        fbp, fbc, utm_source, utm_medium, utm_campaign, utm_content, utm_term
    ) VALUES (
        v_nome, v_tel,
        public.loja_endereco_texto(p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, v_uf, v_cep),
        'entrega', 'pendente', 'pendente',
        v_total, NULL, v_total, 'loja', v_cep, btrim(p_logradouro), btrim(p_numero),
        NULLIF(btrim(COALESCE(p_complemento, '')), ''), NULLIF(btrim(COALESCE(p_bairro, '')), ''),
        btrim(p_cidade), v_uf, v_itens, COALESCE(p_ofertas, false),
        CASE WHEN COALESCE(p_ofertas, false) THEN p_ofertas_texto END, p_chave,
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
REVOKE ALL ON FUNCTION public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loja_criar_pedido(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, jsonb) TO service_role;
