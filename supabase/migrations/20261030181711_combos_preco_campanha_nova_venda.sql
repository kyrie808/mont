-- Bloco B (30/10/2026): função comum de combo + preço de campanha na Nova Venda.
--
-- O problema: na Black (03 a 30/11) o preço depende de como o cliente paga — Pix/dinheiro
-- leva o preço Black, cartão leva a tabela de cartão, fiado fica no preço normal — e os
-- combos da Black têm sabores à escolha. A Nova Venda só conhecia `produtos.preco` e uma
-- linha por produto; o Gilmar corrigiria preço à mão em toda venda.
--
-- O que entra:
--   1. `campanha_vigente`, `preco_tabela`, `precos_vigentes`: UMA regra de preço, usada pelo
--      servidor ao gravar e pela tela ao mostrar.
--   2. `combo_itens`: a função comum de combo. Valida os sabores e devolve as linhas da
--      venda (fixos + sabores, cada um como item próprio) com o preço do combo rateado pelo
--      peso do preço avulso de cada item. Centavo a centavo: a soma fecha no preço do combo.
--   3. `criar_venda` ganha `p_tabela`. Com ela, o servidor recalcula o preço de tudo, abre os
--      combos e recusa tabela incoerente com a forma de pagamento. Sem ela, comportamento
--      antigo (nenhum chamador existente muda).
--   4. `vendas.tabela_preco` (com que tabela a venda foi lançada) e
--      `itens_venda.combo_id` + `combo_instancia` (de qual combo, e de qual unidade, a linha veio).
--   5. REVOKE da `replace_combo_componentes` para anon/PUBLIC: ela já checa admin, mas não
--      precisa ficar exposta a quem não está logado.

-- ── 0. Segurança ──────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.replace_combo_componentes(uuid, jsonb) FROM PUBLIC, anon;

-- ── 1. Colunas ────────────────────────────────────────────────────────────────
ALTER TABLE public.vendas
  ADD COLUMN tabela_preco text CHECK (tabela_preco IN ('pix', 'cartao', 'normal'));
COMMENT ON COLUMN public.vendas.tabela_preco IS
  'Tabela de preço com que a venda foi lançada (pix = preço da campanha no Pix/dinheiro; cartao = tabela de cartão; normal = produtos.preco). NULL = venda anterior a 30/10/2026 ou lançada sem tabela. O valor da venda não muda sozinho se a forma de pagamento mudar depois.';

ALTER TABLE public.itens_venda
  ADD COLUMN combo_id uuid REFERENCES public.produtos(id) ON DELETE RESTRICT,
  ADD COLUMN combo_instancia uuid;
ALTER TABLE public.itens_venda
  ADD CONSTRAINT itens_venda_combo_par_check CHECK ((combo_id IS NULL) = (combo_instancia IS NULL));
CREATE INDEX idx_itens_venda_combo_id ON public.itens_venda (combo_id) WHERE combo_id IS NOT NULL;
COMMENT ON COLUMN public.itens_venda.combo_id IS
  'Combo de onde a linha veio (os sabores e fixos viram itens próprios, com o preço do combo rateado). NULL = item avulso.';
COMMENT ON COLUMN public.itens_venda.combo_instancia IS
  'Agrupa as linhas de UMA unidade do combo (dois Combo Família na mesma venda = duas instâncias).';

-- ── 2. Regra de preço ─────────────────────────────────────────────────────────

-- A campanha que vale num instante: ativa e com o instante dentro do período. Se duas se
-- sobrepuserem, vale a que começou por último.
CREATE FUNCTION public.campanha_vigente(p_em timestamptz DEFAULT now())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT c.id
    FROM public.loja_campanhas c
   WHERE c.ativa AND p_em >= c.inicio AND p_em <= c.fim
   ORDER BY c.inicio DESC
   LIMIT 1
$$;

-- Preço de um produto numa tabela. Pix/cartão usam o preço da campanha vigente quando o
-- produto está nela; fora da campanha (ou fora da tabela dela) vale `produtos.preco`.
CREATE FUNCTION public.preco_tabela(p_produto_id uuid, p_tabela text, p_em timestamptz DEFAULT now())
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_preco numeric;
BEGIN
  IF p_tabela IS NULL OR p_tabela NOT IN ('pix', 'cartao', 'normal') THEN
    RAISE EXCEPTION 'Tabela de preço inválida: %', p_tabela USING ERRCODE = '22023';
  END IF;

  IF p_tabela IN ('pix', 'cartao') THEN
    SELECT CASE p_tabela WHEN 'pix' THEN lp.preco_pix ELSE lp.preco_credito_1x END
      INTO v_preco
      FROM public.loja_precos lp
     WHERE lp.produto_id = p_produto_id
       AND lp.campanha_id = public.campanha_vigente(p_em);
  END IF;

  IF v_preco IS NULL THEN
    SELECT p.preco INTO v_preco FROM public.produtos p WHERE p.id = p_produto_id;
  END IF;

  IF v_preco IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id USING ERRCODE = '22023';
  END IF;

  RETURN v_preco;
END;
$$;

-- As três tabelas de todos os produtos ativos, para a tela mostrar o mesmo número que o
-- servidor vai gravar. `campanha`/`campanha_fim` vêm preenchidos só durante a campanha.
CREATE FUNCTION public.precos_vigentes(p_em timestamptz DEFAULT now())
RETURNS TABLE (
  produto_id uuid,
  normal numeric,
  pix numeric,
  cartao numeric,
  campanha text,
  campanha_fim timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH camp AS (
    SELECT c.id, c.nome, c.fim FROM public.loja_campanhas c WHERE c.id = public.campanha_vigente(p_em)
  )
  SELECT p.id,
         p.preco,
         COALESCE(lp.preco_pix, p.preco),
         COALESCE(lp.preco_credito_1x, p.preco),
         camp.nome,
         camp.fim
    FROM public.produtos p
    LEFT JOIN camp ON true
    LEFT JOIN public.loja_precos lp ON lp.campanha_id = camp.id AND lp.produto_id = p.id
   WHERE p.ativo
$$;

-- ── 3. Função comum de combo ──────────────────────────────────────────────────

-- UMA unidade de combo → linhas de venda. `p_escolhas` = [{grupo_id, produto_id, quantidade}].
--
-- Valida: combo ativo; cada escolha num grupo do combo e numa opção do grupo; cada grupo com
-- a soma exata; sem repetir sabor onde o grupo não permite. Grupo sem nenhuma opção cadastrada
-- (sabores ainda em definição) recusa: o combo não pode ser vendido até ser preenchido.
--
-- Rateio: o preço do combo na tabela (em centavos) é dividido pelo peso preço-avulso-na-mesma-
-- tabela × quantidade de cada item; as sobras de centavo vão para os maiores restos. Um item
-- cujo total não divide exato pela quantidade sai em até duas linhas (ex.: 3 doces iguais a
-- R$ 79,00 → 1 × 26,34 + 2 × 26,33), para preço unitário × quantidade bater sempre.
CREATE FUNCTION public.combo_itens(
  p_combo_id uuid,
  p_escolhas jsonb,
  p_tabela text,
  p_em timestamptz DEFAULT now()
)
RETURNS TABLE (produto_id uuid, quantidade numeric, preco_unitario numeric, subtotal numeric)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
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

-- ── 4. criar_venda com tabela de preço ────────────────────────────────────────
-- A assinatura muda (parâmetro novo no fim, com default): sai a antiga para não deixar duas
-- versões (overload) que o PostgREST não saberia escolher.
DROP FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date);

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
  p_status text DEFAULT 'pendente'::text,
  p_data_entrega_prevista date DEFAULT NULL::date,
  p_tabela text DEFAULT NULL::text
)
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

        -- O servidor decide o preço de tudo: avulso pela tabela, combo pela função comum.
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
                      FROM public.combo_itens((v_item ->> 'combo_id')::uuid, v_item -> 'escolhas', p_tabela) ci;
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
                v_preco := public.preco_tabela((v_item ->> 'produto_id')::uuid, p_tabela);
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
        data_entrega_prevista, tabela_preco
    ) VALUES (
        p_contato_id, p_data, COALESCE(p_status, 'pendente'), v_total, false, p_forma_pagamento,
        COALESCE(p_taxa_entrega, 0), p_data_prevista_pagamento, v_custo_total, p_idempotency_key,
        p_entregador_id, p_observacao_entregador, COALESCE(p_dinheiro_na_entrega, false), COALESCE(p_desconto, 0),
        p_data_entrega_prevista, p_tabela
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

-- ── 5. Permissões ─────────────────────────────────────────────────────────────
-- Função nova nasce executável por PUBLIC: fecha e abre só para quem usa.
REVOKE EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_venda(uuid, date, text, numeric, jsonb, uuid, date, uuid, text, boolean, numeric, text, date, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.campanha_vigente(timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preco_tabela(uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.precos_vigentes(timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.combo_itens(uuid, jsonb, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campanha_vigente(timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preco_tabela(uuid, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.precos_vigentes(timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.combo_itens(uuid, jsonb, text, timestamptz) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
