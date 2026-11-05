-- Rollback de fix/fiado-preco-normal (04/11/2026): volta combo_itens e criar_venda_em ao que estava
-- antes (extraído do dump-schema-20261104-234048.sql; md5 do corpo conferido com o banco) e tira o
-- trigger de fiado. Renomear com a versão da migração quando ela for aplicada.

DROP TRIGGER IF EXISTS trg_vendas_fiado_preco_normal ON public.vendas;
DROP FUNCTION IF EXISTS public.fn_vendas_fiado_preco_normal();

CREATE OR REPLACE FUNCTION "public"."combo_itens"("p_combo_id" "uuid", "p_escolhas" "jsonb", "p_tabela" "text", "p_em" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("produto_id" "uuid", "quantidade" numeric, "preco_unitario" numeric, "subtotal" numeric)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  v_combo record;
  v_grupo record;
  v_escolhas jsonb := COALESCE(p_escolhas, '[]'::jsonb);
  v_e jsonb;
  v_soma integer;
  v_preco_combo_centavos bigint;
BEGIN
  SELECT p.id, p.nome, p.eh_combo, p.ativo INTO v_combo FROM public.produtos p WHERE p.id = p_combo_id;
  IF v_combo.id IS NULL OR NOT v_combo.eh_combo THEN
    RAISE EXCEPTION 'Produto não é um combo: %', p_combo_id USING ERRCODE = '22023';
  END IF;
  IF NOT v_combo.ativo THEN
    RAISE EXCEPTION 'Combo inativo: %', v_combo.nome USING ERRCODE = '22023';
  END IF;
  -- Combo da campanha (preço em loja_precos) só existe com a campanha dele vigente: fora dela,
  -- o produtos.preco do combo é o preço promocional e não pode valer.
  IF public.combo_fora_da_campanha(p_combo_id, p_em) THEN
    RAISE EXCEPTION 'O combo "%" só é vendido durante a campanha', v_combo.nome USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_escolhas) <> 'array' THEN
    RAISE EXCEPTION 'Escolhas do combo devem ser uma lista' USING ERRCODE = '22023';
  END IF;

  -- Grupo sem nenhuma opção cadastrada (sabores ainda em definição) vem primeiro: é a
  -- explicação útil para quem vende, antes de qualquer "sabor fora das opções".
  SELECT g.titulo INTO v_grupo
    FROM public.combo_grupos g
   WHERE g.combo_id = p_combo_id
     AND NOT EXISTS (SELECT 1 FROM public.combo_grupo_opcoes o WHERE o.grupo_id = g.id)
   ORDER BY g.ordem
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Os sabores de "%" ainda não foram definidos', v_grupo.titulo USING ERRCODE = '22023';
  END IF;

  -- Cada escolha: grupo do combo, opção do grupo, quantidade inteira positiva.
  FOR v_e IN SELECT * FROM jsonb_array_elements(v_escolhas) LOOP
    IF NOT (v_e ? 'grupo_id' AND v_e ? 'produto_id' AND v_e ? 'quantidade')
       OR jsonb_typeof(v_e -> 'quantidade') <> 'number'
       OR (v_e ->> 'quantidade')::numeric <= 0
       OR (v_e ->> 'quantidade')::numeric <> trunc((v_e ->> 'quantidade')::numeric) THEN
      RAISE EXCEPTION 'Escolha inválida no combo %: %', v_combo.nome, v_e USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.combo_grupos g
       WHERE g.id = (v_e ->> 'grupo_id')::uuid AND g.combo_id = p_combo_id
    ) THEN
      RAISE EXCEPTION 'Grupo não pertence ao combo %', v_combo.nome USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.combo_grupo_opcoes o
       WHERE o.grupo_id = (v_e ->> 'grupo_id')::uuid AND o.produto_id = (v_e ->> 'produto_id')::uuid
    ) THEN
      RAISE EXCEPTION 'Sabor fora das opções do combo %', v_combo.nome USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Cada grupo: soma exata, repetição só onde pode.
  FOR v_grupo IN
    SELECT g.id, g.titulo, g.quantidade, g.permite_repetir
      FROM public.combo_grupos g
     WHERE g.combo_id = p_combo_id
  LOOP
    SELECT COALESCE(sum((e ->> 'quantidade')::integer), 0) INTO v_soma
      FROM jsonb_array_elements(v_escolhas) e
     WHERE (e ->> 'grupo_id')::uuid = v_grupo.id;
    IF v_soma <> v_grupo.quantidade THEN
      RAISE EXCEPTION '"%": escolhidos %, esperados %', v_grupo.titulo, v_soma, v_grupo.quantidade
        USING ERRCODE = '22023';
    END IF;

    IF NOT v_grupo.permite_repetir AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_escolhas) e
       WHERE (e ->> 'grupo_id')::uuid = v_grupo.id
       GROUP BY e ->> 'produto_id'
      HAVING sum((e ->> 'quantidade')::integer) > 1
    ) THEN
      RAISE EXCEPTION '"%" não permite repetir sabor', v_grupo.titulo USING ERRCODE = '22023';
    END IF;
  END LOOP;

  v_preco_combo_centavos := round(public.preco_tabela(p_combo_id, p_tabela, p_em) * 100);

  RETURN QUERY
  WITH linhas AS (
    -- Fixos + sabores, somados por produto.
    SELECT x.pid, sum(x.q) AS q
      FROM (
        SELECT pc.componente_id AS pid, pc.quantidade AS q
          FROM public.produto_componentes pc
         WHERE pc.combo_id = p_combo_id
        UNION ALL
        SELECT (e ->> 'produto_id')::uuid, (e ->> 'quantidade')::numeric
          FROM jsonb_array_elements(v_escolhas) e
      ) x
     GROUP BY x.pid
  ),
  pesos AS (
    SELECT l.pid, l.q, public.preco_tabela(l.pid, p_tabela, p_em) * l.q AS w FROM linhas l
  ),
  total AS (
    SELECT sum(w) AS w_total, sum(q) AS q_total, count(*) AS n FROM pesos
  ),
  exato AS (
    SELECT pe.pid, pe.q,
           CASE WHEN t.w_total > 0 THEN v_preco_combo_centavos * pe.w / t.w_total
                ELSE v_preco_combo_centavos * pe.q / t.q_total END AS centavos_exatos
      FROM pesos pe, total t
  ),
  piso AS (
    SELECT ex.pid, ex.q, ex.centavos_exatos, floor(ex.centavos_exatos)::bigint AS c FROM exato ex
  ),
  sobra AS (
    SELECT v_preco_combo_centavos - sum(pi.c) AS s FROM piso pi
  ),
  rateio AS (
    SELECT pi.pid, pi.q,
           pi.c + CASE WHEN row_number() OVER (ORDER BY pi.centavos_exatos - pi.c DESC, pi.pid) <= so.s
                       THEN 1 ELSE 0 END AS centavos
      FROM piso pi, sobra so
  ),
  -- Total do item ÷ quantidade: `base` centavos por unidade e `resto` unidades com 1 centavo a mais.
  dividido AS (
    SELECT r.pid, r.q::bigint AS q, r.centavos / r.q::bigint AS base, r.centavos % r.q::bigint AS resto
      FROM rateio r
  )
  SELECT d.pid, (d.q - d.resto)::numeric, d.base / 100.0, ((d.q - d.resto) * d.base) / 100.0
    FROM dividido d
   WHERE d.q - d.resto > 0
  UNION ALL
  SELECT d.pid, d.resto::numeric, (d.base + 1) / 100.0, (d.resto * (d.base + 1)) / 100.0
    FROM dividido d
   WHERE d.resto > 0;
END;
$$;


ALTER FUNCTION "public"."combo_itens"("p_combo_id" "uuid", "p_escolhas" "jsonb", "p_tabela" "text", "p_em" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."criar_venda_em"("p_contato_id" "uuid", "p_data" "date", "p_forma_pagamento" "text", "p_taxa_entrega" numeric, "p_itens" "jsonb", "p_idempotency_key" "uuid", "p_data_prevista_pagamento" "date", "p_entregador_id" "uuid", "p_observacao_entregador" "text", "p_dinheiro_na_entrega" boolean, "p_desconto" numeric, "p_status" "text", "p_data_entrega_prevista" "date", "p_tabela" "text", "p_preco_em" timestamp with time zone, "p_origem" "text", "p_cat_pedido_id" "uuid", "p_observacoes" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."criar_venda_em"("p_contato_id" "uuid", "p_data" "date", "p_forma_pagamento" "text", "p_taxa_entrega" numeric, "p_itens" "jsonb", "p_idempotency_key" "uuid", "p_data_prevista_pagamento" "date", "p_entregador_id" "uuid", "p_observacao_entregador" "text", "p_dinheiro_na_entrega" boolean, "p_desconto" numeric, "p_status" "text", "p_data_entrega_prevista" "date", "p_tabela" "text", "p_preco_em" timestamp with time zone, "p_origem" "text", "p_cat_pedido_id" "uuid", "p_observacoes" "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."combo_itens"("p_combo_id" "uuid", "p_escolhas" "jsonb", "p_tabela" "text", "p_em" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."combo_itens"("p_combo_id" "uuid", "p_escolhas" "jsonb", "p_tabela" "text", "p_em" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."combo_itens"("p_combo_id" "uuid", "p_escolhas" "jsonb", "p_tabela" "text", "p_em" timestamp with time zone) TO "service_role";
REVOKE ALL ON FUNCTION "public"."criar_venda_em"("p_contato_id" "uuid", "p_data" "date", "p_forma_pagamento" "text", "p_taxa_entrega" numeric, "p_itens" "jsonb", "p_idempotency_key" "uuid", "p_data_prevista_pagamento" "date", "p_entregador_id" "uuid", "p_observacao_entregador" "text", "p_dinheiro_na_entrega" boolean, "p_desconto" numeric, "p_status" "text", "p_data_entrega_prevista" "date", "p_tabela" "text", "p_preco_em" timestamp with time zone, "p_origem" "text", "p_cat_pedido_id" "uuid", "p_observacoes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_venda_em"("p_contato_id" "uuid", "p_data" "date", "p_forma_pagamento" "text", "p_taxa_entrega" numeric, "p_itens" "jsonb", "p_idempotency_key" "uuid", "p_data_prevista_pagamento" "date", "p_entregador_id" "uuid", "p_observacao_entregador" "text", "p_dinheiro_na_entrega" boolean, "p_desconto" numeric, "p_status" "text", "p_data_entrega_prevista" "date", "p_tabela" "text", "p_preco_em" timestamp with time zone, "p_origem" "text", "p_cat_pedido_id" "uuid", "p_observacoes" "text") TO "service_role";

NOTIFY pgrst, 'reload schema';
