# Backup Pré-Correção Monetária

> Gerado em: 2026-04-03 20:55 (America/Sao_Paulo)
> Banco: `herlvujykltxnwqmwmyx` (Supabase)
> Finalidade: Documentar estado atual de todos os objetos que serão alterados

---

## 1. Tabela `cat_pedidos`

### Schema

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| numero_pedido | integer | NO | nextval('cat_pedidos_numero_pedido_seq') |
| nome_cliente | text | NO | — |
| telefone_cliente | text | NO | — |
| endereco_entrega | text | YES | — |
| metodo_entrega | text | YES | — |
| status | text | YES | 'pendente' |
| **subtotal_centavos** | **integer** | **NO** | — |
| **frete_centavos** | **integer** | **YES** | **0** |
| **total_centavos** | **integer** | **NO** | — |
| metodo_pagamento | text | YES | — |
| status_pagamento | text | YES | 'pendente' |
| observacoes | text | YES | — |
| indicado_por | text | YES | — |
| criado_em | timestamptz | YES | now() |
| atualizado_em | timestamptz | YES | now() |
| contato_id | uuid | YES | — |

### Constraints

```sql
cat_pedidos_pkey: PRIMARY KEY (id)
cat_pedidos_contato_id_fkey: FOREIGN KEY (contato_id) REFERENCES contatos(id)
cat_pedidos_metodo_entrega_check: CHECK ((metodo_entrega = ANY (ARRAY['entrega','retirada'])))
cat_pedidos_metodo_pagamento_check: CHECK ((metodo_pagamento = ANY (ARRAY['pix','dinheiro','cartao','fiado'])))
cat_pedidos_status_check: CHECK ((status = ANY (ARRAY['pendente','confirmado','preparando','enviado','entregue','cancelado'])))
cat_pedidos_status_pagamento_check: CHECK ((status_pagamento = ANY (ARRAY['pendente','pago','parcial'])))
```

### Indexes

```sql
CREATE UNIQUE INDEX cat_pedidos_pkey ON public.cat_pedidos USING btree (id)
CREATE INDEX idx_cat_pedidos_status ON public.cat_pedidos USING btree (status)
CREATE INDEX idx_cat_pedidos_criado_em ON public.cat_pedidos USING btree (criado_em DESC)
CREATE INDEX idx_cat_pedidos_telefone ON public.cat_pedidos USING btree (telefone_cliente)
CREATE INDEX idx_cat_pedidos_contato_id ON public.cat_pedidos USING btree (contato_id)
```

### Triggers em cat_pedidos

```sql
CREATE TRIGGER tr_cat_pedidos_link_contato BEFORE INSERT ON public.cat_pedidos FOR EACH ROW EXECUTE FUNCTION fn_cat_pedidos_link_contato()
CREATE TRIGGER tr_sync_cat_pedido_to_venda AFTER UPDATE ON public.cat_pedidos FOR EACH ROW EXECUTE FUNCTION fn_sync_cat_pedido_to_venda()
CREATE TRIGGER update_cat_pedidos_atualizado_em BEFORE UPDATE ON public.cat_pedidos FOR EACH ROW EXECUTE FUNCTION update_atualizado_em()
```

---

## 2. Tabela `cat_itens_pedido`

### Schema

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| pedido_id | uuid | YES | — |
| produto_id | uuid | YES | — |
| nome_produto | text | NO | — |
| quantidade | integer | NO | — |
| **preco_unitario_centavos** | **integer** | **NO** | — |
| **total_centavos** | **integer** | **NO** | — |

### Constraints

```sql
cat_itens_pedido_pkey: PRIMARY KEY (id)
cat_itens_pedido_pedido_id_fkey: FOREIGN KEY (pedido_id) REFERENCES cat_pedidos(id) ON DELETE CASCADE
cat_itens_pedido_produto_id_fkey: FOREIGN KEY (produto_id) REFERENCES produtos(id)
```

### Indexes

```sql
CREATE UNIQUE INDEX cat_itens_pedido_pkey ON public.cat_itens_pedido USING btree (id)
CREATE INDEX idx_cat_itens_pedido_pedido ON public.cat_itens_pedido USING btree (pedido_id)
CREATE INDEX idx_cat_itens_pedido_produto ON public.cat_itens_pedido USING btree (produto_id)
```

---

## 3. Views

### 3.1 `vw_catalogo_produtos`

```sql
SELECT id,
    nome,
    codigo,
    slug,
    descricao,
    categoria AS category,
    subtitulo AS subtitle,
    estoque_atual AS stock_quantity,
    estoque_minimo AS stock_min_alert,
    visivel_catalogo AS is_active,
    destaque AS is_featured,
    ((preco * (100)::numeric))::integer AS price_cents,
    to_char(preco, 'FM999G990D00'::text) AS price_formatted,
    ( SELECT cat_imagens_produto.url
           FROM cat_imagens_produto
          WHERE ((cat_imagens_produto.produto_id = p.id) AND ((cat_imagens_produto.tipo)::text = 'cover'::text) AND (cat_imagens_produto.ativo = true))
          ORDER BY cat_imagens_produto.ordem
         LIMIT 1) AS primary_image_url,
    ( SELECT COALESCE(json_agg(json_build_object('id', img.id, 'url', img.url, 'alt_text', img.alt_text, 'is_primary', ((img.tipo)::text = 'cover'::text), 'sort_order', img.ordem) ORDER BY img.ordem), '[]'::json) AS "coalesce"
           FROM cat_imagens_produto img
          WHERE ((img.produto_id = p.id) AND (img.ativo = true))) AS images,
        CASE
            WHEN (estoque_atual <= 0) THEN 'Sem Estoque'::text
            WHEN (estoque_atual <= estoque_minimo) THEN 'Estoque Baixo'::text
            ELSE 'Em Estoque'::text
        END AS stock_status,
    round((preco_ancoragem * (100)::numeric)) AS anchor_price_cents,
    instrucoes_preparo
   FROM produtos p
  WHERE (visivel_catalogo = true);
```

### 3.2 `vw_marketing_pedidos`

```sql
WITH todas_vendas AS (
    SELECT ((cat_pedidos.criado_em AT TIME ZONE 'America/Sao_Paulo'))::date AS data_venda,
        'online'::text AS origem_tipo,
        cat_pedidos.total_centavos AS total_cents,
        cat_pedidos.metodo_entrega,
        cat_pedidos.indicado_por AS referred_by
    FROM cat_pedidos
    WHERE ((cat_pedidos.status <> 'cancelado') AND (cat_pedidos.status_pagamento = 'pago'))
    UNION ALL
    SELECT vendas.data AS data_venda,
        'direta'::text AS origem_tipo,
        ((vendas.total * (100)::numeric))::integer AS total_cents,
        NULL::text AS metodo_entrega,
        NULL::text AS referred_by
    FROM vendas
    WHERE ((vendas.status <> 'cancelada') AND (vendas.pago = true)
        AND ((vendas.origem IS NULL) OR (vendas.origem <> 'catalogo'))
        AND (vendas.forma_pagamento <> 'brinde'))
)
SELECT data_venda,
    to_char(data_venda::timestamp with time zone, 'IYYY-IW') AS semana_iso,
    to_char(data_venda::timestamp with time zone, 'YYYY-MM') AS mes_iso,
    count(*) AS total_pedidos,
    sum(total_cents) AS faturamento_cents,
    round(avg(total_cents), 0) AS ticket_medio_cents,
    count(*) FILTER (WHERE (origem_tipo = 'online')) AS pedidos_online,
    count(*) FILTER (WHERE (origem_tipo = 'direta')) AS pedidos_diretos,
    sum(total_cents) FILTER (WHERE (origem_tipo = 'online')) AS faturamento_online_cents,
    sum(total_cents) FILTER (WHERE (origem_tipo = 'direta')) AS faturamento_direto_cents,
    count(*) FILTER (WHERE (metodo_entrega = 'entrega')) AS entregas_count,
    count(*) FILTER (WHERE (metodo_entrega = 'retirada')) AS retiradas_count
FROM todas_vendas
GROUP BY data_venda
ORDER BY data_venda DESC;
```

### 3.3 `vw_admin_dashboard`

```sql
WITH kpis_produtos AS (
    SELECT count(*) FILTER (WHERE (produtos.ativo = true)) AS produtos_ativos,
        count(*) FILTER (WHERE (produtos.ativo = false)) AS produtos_inativos,
        count(*) FILTER (WHERE ((produtos.estoque_atual <= produtos.estoque_minimo) AND (produtos.ativo = true))) AS produtos_estoque_baixo
    FROM produtos
), kpis_pedidos_online AS (
    SELECT count(*) FILTER (WHERE (cat_pedidos.status = 'pendente')) AS pedidos_pendentes,
        ( SELECT json_agg(json_build_object(
            'id', t.id,
            'order_number', t.numero_pedido,
            'customer_name', t.nome_cliente,
            'total_formatted', ((t.total_centavos)::numeric / 100.0),
            'status', t.status,
            'created_at', t.criado_em
          ) ORDER BY t.criado_em DESC)
          FROM ( SELECT cat_pedidos_1.id, cat_pedidos_1.numero_pedido,
                    cat_pedidos_1.nome_cliente, cat_pedidos_1.telefone_cliente,
                    cat_pedidos_1.endereco_entrega, cat_pedidos_1.metodo_entrega,
                    cat_pedidos_1.status, cat_pedidos_1.subtotal_centavos,
                    cat_pedidos_1.frete_centavos, cat_pedidos_1.total_centavos,
                    cat_pedidos_1.metodo_pagamento, cat_pedidos_1.status_pagamento,
                    cat_pedidos_1.observacoes, cat_pedidos_1.indicado_por,
                    cat_pedidos_1.criado_em, cat_pedidos_1.atualizado_em
                 FROM cat_pedidos cat_pedidos_1
                 WHERE (cat_pedidos_1.status <> 'cancelado')
                 ORDER BY cat_pedidos_1.criado_em DESC LIMIT 5) t
        ) AS ultimos_pedidos
    FROM cat_pedidos
), kpis_financeiro AS (
    SELECT COALESCE(sum(
            CASE WHEN (data_venda = ((now() AT TIME ZONE 'America/Sao_Paulo'))::date)
                 THEN faturamento_online_cents ELSE (0)::bigint END
           ), (0)::numeric) AS faturamento_hoje_cents,
        COALESCE(sum(
            CASE WHEN (date_trunc('month', data_venda::timestamp) = date_trunc('month', (((now() AT TIME ZONE 'America/Sao_Paulo'))::date)::timestamp))
                 THEN faturamento_online_cents ELSE (0)::bigint END
           ), (0)::numeric) AS faturamento_mes_cents
    FROM vw_marketing_pedidos
)
SELECT p.produtos_ativos, p.produtos_inativos, p.produtos_estoque_baixo,
    o.pedidos_pendentes, o.ultimos_pedidos,
    f.faturamento_hoje_cents, f.faturamento_mes_cents
FROM ((kpis_produtos p CROSS JOIN kpis_pedidos_online o) CROSS JOIN kpis_financeiro f);
```

---

## 4. RPCs

### 4.1 `criar_pedido` — Versão SEM endereço (LEGACY)

```sql
CREATE OR REPLACE FUNCTION public.criar_pedido(
    p_nome_cliente text,
    p_telefone_cliente text,
    p_endereco_entrega text,
    p_metodo_entrega text,
    p_metodo_pagamento text,
    p_subtotal_centavos integer,
    p_frete_centavos integer,
    p_total_centavos integer,
    p_observacoes text DEFAULT NULL,
    p_indicado_por text DEFAULT NULL,
    p_itens jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido_id       UUID;
  v_numero_pedido   INTEGER;
  v_pedido          JSONB;
  v_item            JSONB;
  v_contato_id      UUID;
  v_venda_id        UUID;
  v_telefone_norm   TEXT;
  v_custo_unitario  NUMERIC;
  v_custo_total     NUMERIC := 0;
BEGIN
  INSERT INTO cat_pedidos (
    nome_cliente, telefone_cliente, endereco_entrega, metodo_entrega,
    metodo_pagamento, subtotal_centavos, frete_centavos, total_centavos,
    observacoes, indicado_por, status, status_pagamento
  ) VALUES (
    p_nome_cliente, p_telefone_cliente, p_endereco_entrega, p_metodo_entrega,
    p_metodo_pagamento, p_subtotal_centavos, p_frete_centavos, p_total_centavos,
    p_observacoes, p_indicado_por, 'pendente', 'pendente'
  ) RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO cat_itens_pedido (
      pedido_id, produto_id, nome_produto, quantidade,
      preco_unitario_centavos, total_centavos
    ) VALUES (
      v_pedido_id, (v_item->>'product_id')::UUID, v_item->>'product_name',
      (v_item->>'quantity')::INTEGER, (v_item->>'unit_price_cents')::INTEGER,
      (v_item->>'total_centavos')::INTEGER
    );
  END LOOP;

  BEGIN
    v_telefone_norm := regexp_replace(p_telefone_cliente, '[^0-9]', '', 'g');
    SELECT id INTO v_contato_id FROM contatos
    WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone_norm LIMIT 1;

    IF v_contato_id IS NULL THEN
      INSERT INTO contatos (nome, telefone, tipo, status, origem)
      VALUES (p_nome_cliente, v_telefone_norm, 'B2C', 'cliente', 'catalogo')
      RETURNING id INTO v_contato_id;
    END IF;

    UPDATE cat_pedidos SET contato_id = v_contato_id WHERE id = v_pedido_id;

    INSERT INTO vendas (
      contato_id, data, total, forma_pagamento, status, pago, valor_pago,
      taxa_entrega, origem, cat_pedido_id, observacoes
    ) VALUES (
      v_contato_id, CURRENT_DATE, p_total_centavos / 100.0, p_metodo_pagamento,
      'pendente', false, 0, p_frete_centavos / 100.0, 'catalogo', v_pedido_id, p_observacoes
    ) RETURNING id INTO v_venda_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      SELECT COALESCE(custo, 0) INTO v_custo_unitario FROM produtos WHERE id = (v_item->>'product_id')::UUID;
      IF v_custo_unitario IS NULL THEN v_custo_unitario := 0; END IF;
      v_custo_total := v_custo_total + (v_custo_unitario * (v_item->>'quantity')::INTEGER);
      INSERT INTO itens_venda (
        venda_id, produto_id, quantidade, preco_unitario, subtotal, custo_unitario
      ) VALUES (
        v_venda_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER,
        (v_item->>'unit_price_cents')::INTEGER / 100.0,
        (v_item->>'total_centavos')::INTEGER / 100.0, v_custo_unitario
      );
    END LOOP;
    UPDATE vendas SET custo_total = v_custo_total WHERE id = v_venda_id;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_pedidos_pendentes_vinculacao (cat_pedido_id, motivo_falha)
    VALUES (v_pedido_id, SQLERRM);
  END;

  v_pedido := jsonb_build_object('id', v_pedido_id, 'numero_pedido', v_numero_pedido, 'status', 'pendente', 'total_centavos', p_total_centavos);
  RETURN v_pedido;
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$function$
```

### 4.2 `criar_pedido` — Versão COM endereço (ATUAL)

```sql
CREATE OR REPLACE FUNCTION public.criar_pedido(
    p_nome_cliente text,
    p_telefone_cliente text,
    p_endereco_entrega text,
    p_metodo_entrega text,
    p_metodo_pagamento text,
    p_subtotal_centavos integer,
    p_frete_centavos integer,
    p_total_centavos integer,
    p_observacoes text DEFAULT NULL,
    p_indicado_por text DEFAULT NULL,
    p_itens jsonb DEFAULT '[]'::jsonb,
    p_cep text DEFAULT NULL,
    p_logradouro text DEFAULT NULL,
    p_numero text DEFAULT NULL,
    p_complemento text DEFAULT NULL,
    p_bairro text DEFAULT NULL,
    p_cidade text DEFAULT NULL,
    p_uf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido_id       UUID;
  v_numero_pedido   INTEGER;
  v_pedido          JSONB;
  v_item            JSONB;
  v_contato_id      UUID;
  v_venda_id        UUID;
  v_telefone_norm   TEXT;
  v_custo_unitario  NUMERIC;
  v_custo_total     NUMERIC := 0;
BEGIN
  -- PARTE 1: cat_pedidos + cat_itens_pedido (mesma lógica)
  INSERT INTO cat_pedidos (
    nome_cliente, telefone_cliente, endereco_entrega, metodo_entrega,
    metodo_pagamento, subtotal_centavos, frete_centavos, total_centavos,
    observacoes, indicado_por, status, status_pagamento
  ) VALUES (
    p_nome_cliente, p_telefone_cliente, p_endereco_entrega, p_metodo_entrega,
    p_metodo_pagamento, p_subtotal_centavos, p_frete_centavos, p_total_centavos,
    p_observacoes, p_indicado_por, 'pendente', 'pendente'
  ) RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO cat_itens_pedido (
      pedido_id, produto_id, nome_produto, quantidade,
      preco_unitario_centavos, total_centavos
    ) VALUES (
      v_pedido_id, (v_item->>'product_id')::UUID, v_item->>'product_name',
      (v_item->>'quantity')::INTEGER, (v_item->>'unit_price_cents')::INTEGER,
      (v_item->>'total_centavos')::INTEGER
    );
  END LOOP;

  -- PARTE 2: Sync com interno (tolerante a falhas)
  BEGIN
    v_telefone_norm := regexp_replace(p_telefone_cliente, '[^0-9]', '', 'g');
    SELECT id INTO v_contato_id FROM contatos
    WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone_norm LIMIT 1;

    IF v_contato_id IS NULL THEN
      INSERT INTO contatos (nome, telefone, tipo, status, origem,
                            endereco, cep, logradouro, numero, complemento, bairro, cidade, uf)
      VALUES (p_nome_cliente, v_telefone_norm, 'B2C', 'cliente', 'catalogo',
              p_endereco_entrega, p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_uf)
      RETURNING id INTO v_contato_id;
    ELSE
      UPDATE contatos SET
        endereco = COALESCE(p_endereco_entrega, endereco),
        cep = COALESCE(p_cep, cep), logradouro = COALESCE(p_logradouro, logradouro),
        numero = COALESCE(p_numero, numero), complemento = COALESCE(p_complemento, complemento),
        bairro = COALESCE(p_bairro, bairro), cidade = COALESCE(p_cidade, cidade),
        uf = COALESCE(p_uf, uf), atualizado_em = now()
      WHERE id = v_contato_id;
    END IF;

    UPDATE cat_pedidos SET contato_id = v_contato_id WHERE id = v_pedido_id;

    INSERT INTO vendas (
      contato_id, data, total, forma_pagamento, status, pago, valor_pago,
      taxa_entrega, origem, cat_pedido_id, observacoes
    ) VALUES (
      v_contato_id, CURRENT_DATE, p_total_centavos / 100.0, p_metodo_pagamento,
      'pendente', false, 0, p_frete_centavos / 100.0, 'catalogo', v_pedido_id, p_observacoes
    ) RETURNING id INTO v_venda_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      SELECT COALESCE(custo, 0) INTO v_custo_unitario FROM produtos WHERE id = (v_item->>'product_id')::UUID;
      IF v_custo_unitario IS NULL THEN v_custo_unitario := 0; END IF;
      v_custo_total := v_custo_total + (v_custo_unitario * (v_item->>'quantity')::INTEGER);
      INSERT INTO itens_venda (
        venda_id, produto_id, quantidade, preco_unitario, subtotal, custo_unitario
      ) VALUES (
        v_venda_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER,
        (v_item->>'unit_price_cents')::INTEGER / 100.0,
        (v_item->>'total_centavos')::INTEGER / 100.0, v_custo_unitario
      );
    END LOOP;
    UPDATE vendas SET custo_total = v_custo_total WHERE id = v_venda_id;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_pedidos_pendentes_vinculacao (cat_pedido_id, motivo_falha)
    VALUES (v_pedido_id, SQLERRM);
  END;

  v_pedido := jsonb_build_object('id', v_pedido_id, 'numero_pedido', v_numero_pedido, 'status', 'pendente', 'total_centavos', p_total_centavos);
  RETURN v_pedido;
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$function$
```

---

## 5. Trigger Functions

### 5.1 `fn_sync_cat_pedido_to_venda()`

```sql
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
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status != 'entregue')) THEN
        IF EXISTS (SELECT 1 FROM public.vendas WHERE cat_pedido_id = NEW.id) THEN
            RETURN NEW;
        END IF;

        BEGIN
            v_telefone_normalizado := regexp_replace(NEW.telefone_cliente, '\D', '', 'g');
            IF LENGTH(v_telefone_normalizado) >= 12 AND LEFT(v_telefone_normalizado, 2) = '55' THEN
                v_telefone_normalizado := SUBSTRING(v_telefone_normalizado FROM 3);
            END IF;

            SELECT id INTO v_contato_id FROM public.contatos
            WHERE regexp_replace(telefone, '\D', '', 'g') = v_telefone_normalizado LIMIT 1;

            IF v_contato_id IS NULL THEN
                INSERT INTO public.contatos (nome, telefone, status, tipo, origem, endereco, observacoes)
                VALUES (NEW.nome_cliente, NEW.telefone_cliente, 'cliente', 'B2C', 'Catálogo Online',
                        NEW.endereco_entrega, 'Criado automaticamente via pedido do catálogo #' || NEW.numero_pedido)
                RETURNING id INTO v_contato_id;
            END IF;

            INSERT INTO public.vendas (
                contato_id, data, total, forma_pagamento, status, pago,
                origem, cat_pedido_id, observacoes, taxa_entrega
            ) VALUES (
                v_contato_id, COALESCE(NEW.criado_em::date, CURRENT_DATE),
                (NEW.total_centavos::numeric / 100),  -- CONVERSÃO CENTAVOS -> REAIS
                COALESCE(NEW.metodo_pagamento, 'pix'), 'entregue', true,
                'catalogo', NEW.id,
                'Pedido Catálogo #' || NEW.numero_pedido || COALESCE('\nObs: ' || NEW.observacoes, ''),
                (COALESCE(NEW.frete_centavos, 0)::numeric / 100)
            ) RETURNING id INTO v_venda_id;

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.cat_pedidos_pendentes_vinculacao (cat_pedido_id, motivo_falha)
            VALUES (NEW.id, SQLERRM);
        END;
    END IF;
    RETURN NEW;
END;
$function$
```

### 5.2 `sync_venda_to_cat_pedido()`

```sql
CREATE OR REPLACE FUNCTION public.sync_venda_to_cat_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.cat_pedido_id IS NOT NULL THEN
        UPDATE cat_pedidos SET
            status = CASE
                WHEN NEW.status = 'cancelada' THEN 'cancelado'
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
$function$
```

### 5.3 `fn_cat_pedidos_link_contato()`

```sql
CREATE OR REPLACE FUNCTION public.fn_cat_pedidos_link_contato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  SELECT id INTO NEW.contato_id
  FROM contatos
  WHERE telefone = NEW.telefone_cliente
  LIMIT 1;
  RETURN NEW;
END;
$function$
```

### 5.4 Trigger Definitions

```sql
-- Em cat_pedidos:
CREATE TRIGGER tr_cat_pedidos_link_contato BEFORE INSERT ON public.cat_pedidos FOR EACH ROW EXECUTE FUNCTION fn_cat_pedidos_link_contato()
CREATE TRIGGER tr_sync_cat_pedido_to_venda AFTER UPDATE ON public.cat_pedidos FOR EACH ROW EXECUTE FUNCTION fn_sync_cat_pedido_to_venda()
CREATE TRIGGER update_cat_pedidos_atualizado_em BEFORE UPDATE ON public.cat_pedidos FOR EACH ROW EXECUTE FUNCTION update_atualizado_em()

-- Em vendas (relativo a cat_pedidos):
CREATE TRIGGER tr_sync_venda_to_cat_pedido AFTER UPDATE ON public.vendas FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status) OR (old.pago IS DISTINCT FROM new.pago)) EXECUTE FUNCTION sync_venda_to_cat_pedido()
```

---

## 6. Dados Atuais

### 6.1 `cat_pedidos` (amostra)

| id | subtotal_centavos | frete_centavos | total_centavos |
|----|-------------------|----------------|----------------|
| 49e92a78-... | 12500 | 0 | 12500 |
| f074d74a-... | 11500 | 0 | 11500 |
| 68d22f44-... | 6000 | 0 | 6000 |
| 69038b69-... | 3500 | 0 | 3500 |
| 6a903e12-... | 15000 | 0 | 15000 |
| 91baf56e-... | 6500 | 0 | 6500 |
| 91a98f3b-... | 6500 | 0 | 6500 |

**Valores esperados após conversão:** 12500 → 125.00, 11500 → 115.00, 6000 → 60.00, 3500 → 35.00, 15000 → 150.00, 6500 → 65.00

### 6.2 `cat_itens_pedido` (amostra)

| id | preco_unitario_centavos | total_centavos |
|----|------------------------|----------------|
| 36098aa2-... | 6500 | 6500 |
| 5c3d6a02-... | 6500 | 6500 |
| a3193ad9-... | 6500 | 6500 |
| b1d8312c-... | 3500 | 3500 |
| de999000-... | 5000 | 5000 |
| 1aeb2458-... | 3500 | 3500 |
| 5c85e255-... | 2500 | 2500 |
| ed0716a1-... | 3500 | 3500 |
| c47c94bf-... | 2500 | 5000 |
| a6f4ad5d-... | 6500 | 6500 |

**Valores esperados após conversão:** 6500 → 65.00, 3500 → 35.00, 5000 → 50.00, 2500 → 25.00
