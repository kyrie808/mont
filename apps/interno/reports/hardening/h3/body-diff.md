# H-3 Body Diff — Guard vs Snapshot Pré-Hardening

**Data:** 2026-05-20  
**Fonte snapshot:** `ddl-snapshot-pre.sql` (pg_get_functiondef de produção, 2026-05-19)  
**Regra:** A ÚNICA diferença permitida é o bloco do guard. Qualquer outra divergência = erro de transcrição.

**Guard aplicado (8 funções plpgsql):**
```sql
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;
```
*`auth.role()` = `auth.jwt() ->> 'role'` — ambos confirmados no schema `auth`. Semântica:*  
*— `service_role`: `COALESCE('service_role','') <> 'service_role'` = false → não dispara → passa*  
*— `admin` (authenticated + admin\_users): `NOT is_admin()` = false → não dispara → passa*  
*— `non-admin` (authenticated): ambas true → RAISE 42501*  
*— `anon`: bloqueado por proacl (sem EXECUTE grant) antes de atingir o guard — confirmado: `has_anon_or_public_execute=false` em todas as 9*

**Guard aplicado (rpc\_total\_a\_receber\_dashboard — LANGUAGE sql):**
```sql
      AND (SELECT public.is_admin())
```
*(cláusula adicionada no WHERE — retorna zeros para non-admin em vez de erro; compatível com callers service_role: is_admin() = false → zeros, aceitável pois não há caller service_role desta função em produção)*

---

## Validações de segurança pré-apply ✅

| Check | Resultado |
|-------|-----------|
| `auth.jwt()` existe no schema `auth` | ✅ confirmado (returns `jsonb`) |
| `auth.role()` existe no schema `auth` | ✅ confirmado (returns `text`) |
| Alguma das 9 tem grant `anon` ou `public` EXECUTE? | ✅ NÃO — todas com `has_anon_or_public_execute=false` |
| proacl de todas as 9 | `{postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}` |

---

## 1/9 — registrar_pagamento_venda

```diff
 BEGIN
+    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
+      RAISE EXCEPTION 'Acesso negado: apenas administradores'
+        USING ERRCODE = '42501';
+    END IF;
+
     -- 1. Registra o pagamento — trigger trigger_update_venda_pagamento dispara
```

Linhas adicionadas: 5 (guard + linha em branco separadora). Resto: idêntico.

---

## 2/9 — registrar_pagamento_conta_a_pagar

```diff
 BEGIN
+    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
+      RAISE EXCEPTION 'Acesso negado: apenas administradores'
+        USING ERRCODE = '42501';
+    END IF;
+
     -- 1. Validar que a obrigação existe e não está paga
```

Linhas adicionadas: 5. Corpo original: idêntico.  
*(O bloco de comentário arquitetural acima do DECLARE é preservado integralmente.)*

---

## 3/9 — criar_obrigacao_parcelada

```diff
 BEGIN
+    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
+      RAISE EXCEPTION 'Acesso negado: apenas administradores'
+        USING ERRCODE = '42501';
+    END IF;
+
   IF p_total_parcelas < 1 THEN
```

Linhas adicionadas: 5. Resto: idêntico.

---

## 4/9 — update_purchase_order_with_items

```diff
 BEGIN
+    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
+      RAISE EXCEPTION 'Acesso negado: apenas administradores'
+        USING ERRCODE = '42501';
+    END IF;
+
     UPDATE purchase_orders
```

Linhas adicionadas: 5. Resto: idêntico.

---

## 5/9 — registrar_despesa_manual

```diff
 BEGIN
+    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
+      RAISE EXCEPTION 'Acesso negado: apenas administradores'
+        USING ERRCODE = '42501';
+    END IF;
+
   IF p_valor IS NULL OR p_valor <= 0 THEN
```

Linhas adicionadas: 5. Resto: idêntico.

---

## 6/9 — registrar_entrada_manual

```diff
 BEGIN
+    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
+      RAISE EXCEPTION 'Acesso negado: apenas administradores'
+        USING ERRCODE = '42501';
+    END IF;
+
   IF p_valor IS NULL OR p_valor <= 0 THEN
```

Linhas adicionadas: 5. Resto: idêntico.

---

## 7/9 — add_image_reference

```diff
 BEGIN
+    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
+      RAISE EXCEPTION 'Acesso negado: apenas administradores'
+        USING ERRCODE = '42501';
+    END IF;
+
   -- Remove referências antigas
```

Linhas adicionadas: 5. Resto: idêntico.

---

## 8/9 — delete_image_reference

```diff
 BEGIN
+    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
+      RAISE EXCEPTION 'Acesso negado: apenas administradores'
+        USING ERRCODE = '42501';
+    END IF;
+
   DELETE FROM sis_imagens_produto WHERE produto_id = p_produto_id;
```

Linhas adicionadas: 5. Resto: idêntico.  
*(Caller catalogo usa `supabaseAdmin` = service_role → `COALESCE('service_role','') <> 'service_role'` = false → guard não dispara → funciona.)*

---

## 9/9 — rpc_total_a_receber_dashboard

```diff
     FROM public.vendas
     WHERE pago = false
       AND status = 'entregue'
       AND forma_pagamento <> 'brinde'
       AND (origem IS NULL OR origem <> 'catalogo')
+      AND (SELECT public.is_admin());
```

Linhas adicionadas: 1. LANGUAGE sql preservado. STABLE preservado. Resto: idêntico.

---

## Verificação de integridade

| # | Função | Diff esperado | Outras diferenças? |
|---|--------|--------------|-------------------|
| 1 | registrar_pagamento_venda | +5 linhas após BEGIN | Nenhuma |
| 2 | registrar_pagamento_conta_a_pagar | +5 linhas após BEGIN | Nenhuma |
| 3 | criar_obrigacao_parcelada | +5 linhas após BEGIN | Nenhuma |
| 4 | update_purchase_order_with_items | +5 linhas após BEGIN | Nenhuma |
| 5 | registrar_despesa_manual | +5 linhas após BEGIN | Nenhuma |
| 6 | registrar_entrada_manual | +5 linhas após BEGIN | Nenhuma |
| 7 | add_image_reference | +5 linhas após BEGIN | Nenhuma |
| 8 | delete_image_reference | +5 linhas após BEGIN | Nenhuma |
| 9 | rpc_total_a_receber_dashboard | +1 cláusula AND no WHERE | Nenhuma |
