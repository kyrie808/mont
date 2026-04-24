CREATE OR REPLACE FUNCTION public.fn_count_words(texto text)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF texto IS NULL OR btrim(texto) = '' THEN
        RETURN 0;
    END IF;

    RETURN array_length(
        string_to_array(
            btrim(regexp_replace(texto, '\s+', ' ', 'g')),
            ' '
        ),
        1
    );
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_capitalize_name(nome text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    palavras text[];
    resultado text[];
    i int;
    preposicoes text[] := ARRAY['de', 'da', 'do', 'das', 'dos', 'e'];
BEGIN
    IF nome IS NULL OR btrim(nome) = '' THEN
        RETURN nome;
    END IF;

    palavras := string_to_array(
        initcap(btrim(regexp_replace(nome, '\s+', ' ', 'g'))),
        ' '
    );

    resultado := palavras;

    IF array_length(palavras, 1) >= 2 THEN
        FOR i IN 2..array_length(palavras, 1) LOOP
            IF lower(palavras[i]) = ANY(preposicoes) THEN
                resultado[i] := lower(palavras[i]);
            END IF;
        END LOOP;
    END IF;

    RETURN array_to_string(resultado, ' ');
END;
$$;


CREATE OR REPLACE FUNCTION public.criar_pedido(
    p_nome_cliente text,
    p_telefone_cliente text,
    p_endereco_entrega text,
    p_metodo_entrega text,
    p_metodo_pagamento text,
    p_subtotal numeric,
    p_frete numeric,
    p_total numeric,
    p_observacoes text DEFAULT NULL::text,
    p_indicado_por text DEFAULT NULL::text,
    p_itens jsonb DEFAULT '[]'::jsonb,
    p_cep text DEFAULT NULL::text,
    p_logradouro text DEFAULT NULL::text,
    p_numero text DEFAULT NULL::text,
    p_complemento text DEFAULT NULL::text,
    p_bairro text DEFAULT NULL::text,
    p_cidade text DEFAULT NULL::text,
    p_uf text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pedido_id uuid;
  v_numero_pedido integer;
  v_pedido jsonb;
  v_item jsonb;
  v_contato_id uuid;
  v_venda_id uuid;
  v_telefone_norm text;
  v_custo_unitario numeric;
  v_custo_total numeric := 0;
  v_nome_atual text;
  v_nome_novo_capitalizado text;
BEGIN
  v_nome_novo_capitalizado := fn_capitalize_name(p_nome_cliente);

  -- ============================================================
  -- PARTE 1: Pedido do catálogo (CRÍTICA — não pode falhar)
  -- ============================================================

  INSERT INTO cat_pedidos (
    nome_cliente, telefone_cliente, endereco_entrega, metodo_entrega,
    metodo_pagamento, subtotal, frete, total,
    observacoes, indicado_por, status, status_pagamento
  ) VALUES (
    v_nome_novo_capitalizado, p_telefone_cliente, p_endereco_entrega, p_metodo_entrega,
    p_metodo_pagamento, p_subtotal, p_frete, p_total,
    p_observacoes, p_indicado_por, 'pendente', 'pendente'
  ) RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

  -- Insere os itens do pedido (agora recebe unit_price e total em REAIS)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO cat_itens_pedido (
      pedido_id, produto_id, nome_produto, quantidade,
      preco_unitario, total
    ) VALUES (
      v_pedido_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total')::numeric
    );
  END LOOP;

  -- ============================================================
  -- PARTE 2: Sync com sistema interno (TOLERANTE a falhas)
  -- ============================================================
  BEGIN
    v_telefone_norm := regexp_replace(p_telefone_cliente, '[^0-9]', '', 'g');

    SELECT id, nome INTO v_contato_id, v_nome_atual
    FROM contatos
    WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone_norm
    LIMIT 1;

    IF v_contato_id IS NULL THEN
      INSERT INTO contatos (
        nome, telefone, tipo, status, origem,
        endereco, cep, logradouro, numero, complemento, bairro, cidade, uf
      ) VALUES (
        v_nome_novo_capitalizado, v_telefone_norm, 'B2C', 'cliente', 'catalogo',
        p_endereco_entrega, p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_uf
      )
      RETURNING id INTO v_contato_id;
    ELSE
      IF fn_count_words(v_nome_novo_capitalizado) > fn_count_words(v_nome_atual) THEN
        UPDATE contatos SET
          nome = v_nome_novo_capitalizado,
          endereco = COALESCE(p_endereco_entrega, endereco),
          cep = COALESCE(p_cep, cep),
          logradouro = COALESCE(p_logradouro, logradouro),
          numero = COALESCE(p_numero, numero),
          complemento = COALESCE(p_complemento, complemento),
          bairro = COALESCE(p_bairro, bairro),
          cidade = COALESCE(p_cidade, cidade),
          uf = COALESCE(p_uf, uf),
          atualizado_em = now()
        WHERE id = v_contato_id;
      ELSE
        UPDATE contatos SET
          endereco = COALESCE(p_endereco_entrega, endereco),
          cep = COALESCE(p_cep, cep),
          logradouro = COALESCE(p_logradouro, logradouro),
          numero = COALESCE(p_numero, numero),
          complemento = COALESCE(p_complemento, complemento),
          bairro = COALESCE(p_bairro, bairro),
          cidade = COALESCE(p_cidade, cidade),
          uf = COALESCE(p_uf, uf),
          atualizado_em = now()
        WHERE id = v_contato_id;
      END IF;
    END IF;

    UPDATE cat_pedidos SET contato_id = v_contato_id WHERE id = v_pedido_id;

    -- Inserir venda — DIRETO em reais, sem conversão
    INSERT INTO vendas (
      contato_id, data, total, forma_pagamento, status, pago, valor_pago,
      taxa_entrega, origem, cat_pedido_id, observacoes
    ) VALUES (
      v_contato_id, current_date, p_total, p_metodo_pagamento,
      'pendente', false, 0, p_frete, 'catalogo', v_pedido_id, p_observacoes
    ) RETURNING id INTO v_venda_id;

    -- Inserir itens da venda — DIRETO em reais, sem conversão
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      SELECT COALESCE(custo, 0) INTO v_custo_unitario FROM produtos WHERE id = (v_item->>'product_id')::uuid;
      IF v_custo_unitario IS NULL THEN v_custo_unitario := 0; END IF;
      v_custo_total := v_custo_total + (v_custo_unitario * (v_item->>'quantity')::integer);

      INSERT INTO itens_venda (
        venda_id, produto_id, quantidade, preco_unitario, subtotal, custo_unitario
      ) VALUES (
        v_venda_id,
        (v_item->>'product_id')::uuid,
        (v_item->>'quantity')::integer,
        (v_item->>'unit_price')::numeric,
        (v_item->>'total')::numeric,
        v_custo_unitario
      );
    END LOOP;

    UPDATE vendas SET custo_total = v_custo_total WHERE id = v_venda_id;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_pedidos_pendentes_vinculacao (cat_pedido_id, motivo_falha)
    VALUES (v_pedido_id, SQLERRM);
  END;

  -- ============================================================
  -- PARTE 3: Retorno (agora retorna 'total' em reais)
  -- ============================================================
  v_pedido := jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'status', 'pendente',
    'total', p_total
  );

  RETURN v_pedido;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
