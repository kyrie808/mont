-- Parte A da paridade (02/11/2026): a loja vende pelo CADASTRO do sistema interno.
-- Backup antes: supabase/backups/dumps/dump-*-20261102-233107.sql
--
-- * Produto ativo + "Visível no catálogo" vale na loja sem linha em loja_vitrine.
-- * loja_vitrine vira complemento opcional:
--     - secao_id / ordem_loja: seção (da tela Catálogo) e ordem só para a loja; NULL = a do cadastro;
--     - visivel: a linha vale (a leitura pública da vitrine só enxerga linhas visíveis);
--       linha desligada = vale o cadastro. Padrão passa a ser true;
--     - disponivel = false: "Esgotado" na loja.
--   As colunas antigas `secao` (texto) e `ordem` seguem só para a versão publicada da loja;
--   saem numa migração de limpeza depois do merge.
-- * Combo de campanha (com preço em loja_precos) vende só durante a campanha, mesmo sem
--   "Visível no catálogo" (não vaza no catálogo antigo a preço cheio). Combo permanente obedece
--   ao "Visível no catálogo" e vende pelo preço do cadastro.

ALTER TABLE public.loja_vitrine
  ADD COLUMN secao_id uuid REFERENCES public.cat_secoes(id) ON DELETE SET NULL,
  ADD COLUMN ordem_loja integer;

CREATE INDEX loja_vitrine_secao_id_idx ON public.loja_vitrine (secao_id);

ALTER TABLE public.loja_vitrine ALTER COLUMN secao DROP NOT NULL;
ALTER TABLE public.loja_vitrine ALTER COLUMN visivel SET DEFAULT true;

COMMENT ON COLUMN public.loja_vitrine.secao_id IS 'Seção só para a loja (cat_secoes). NULL = a seção do cadastro (produtos.secao_id).';
COMMENT ON COLUMN public.loja_vitrine.ordem_loja IS 'Ordem só para a loja. NULL = produtos.ordem_vitrine.';
COMMENT ON COLUMN public.loja_vitrine.visivel IS 'A linha vale na loja. Desligada = vale só o cadastro.';
COMMENT ON COLUMN public.loja_vitrine.disponivel IS 'false = "Esgotado" na loja.';
COMMENT ON COLUMN public.loja_vitrine.secao IS 'OBSOLETA (versão antiga da loja). Usar secao_id.';
COMMENT ON COLUMN public.loja_vitrine.ordem IS 'OBSOLETA (versão antiga da loja). Usar ordem_loja.';

-- Combos de campanha não estão em seção nenhuma do cadastro: a ordem deles no bloco da campanha
-- continua a que estava (Mesa Cheia, Par Mineiro, Café da Tarde, Trio Mineiro, Dupla Zero).
UPDATE public.loja_vitrine lv
   SET ordem_loja = lv.ordem
  FROM public.produtos p
 WHERE p.id = lv.produto_id AND p.eh_combo;

CREATE OR REPLACE FUNCTION public.loja_criar_pedido(p_chave uuid, p_nome text, p_telefone text, p_cep text, p_logradouro text, p_numero text, p_complemento text, p_bairro text, p_cidade text, p_uf text, p_itens jsonb, p_ofertas boolean, p_ofertas_texto text)
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

NOTIFY pgrst, 'reload schema';
