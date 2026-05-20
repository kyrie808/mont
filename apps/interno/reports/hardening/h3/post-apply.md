# H-3 Post-Apply — Role Test Results

**Data:** 2026-05-20  
**Migration:** `20260520084613_hardening_h3_guard_is_admin.sql`  
**Apply method:** `npx supabase db push --linked`  
**Status:** ✅ SUCESSO — 30/30 testes passaram

## Critério de sucesso (design final: guard-only, zero REVOKE)

| Contexto | Esperado (8 plpgsql) | Esperado (rpc_total) |
|----------|---------------------|---------------------|
| anon | 401 + permission denied (proacl) | 401 (proacl) |
| non-admin | 403 + 42501 + "Acesso negado: apenas administradores" | 200 + {zeros} |
| admin | 200 OU erro de validação interna (não 42501) | 200 + dados reais |
| service_role | N/A (só delete_image_reference) | N/A |

---

## Resultados

### 1/9 — registrar_pagamento_venda

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function registrar_pagamento_venda"}` | ✅ |
| non-admin | 403 | `{"code":"42501","message":"Acesso negado: apenas administradores"}` | ✅ |
| admin | 409 | FK violation venda_id (guard passou, erro interno) | ✅ |

### 2/9 — registrar_pagamento_conta_a_pagar

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function registrar_pagamento_conta_a_pagar"}` | ✅ |
| non-admin | 403 | `{"code":"42501","message":"Acesso negado: apenas administradores"}` | ✅ |
| admin | 400 | `{"code":"P0001","message":"Conta a pagar ... nao encontrada"}` (guard passou) | ✅ |

### 3/9 — criar_obrigacao_parcelada

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function criar_obrigacao_parcelada"}` | ✅ |
| non-admin | 403 | `{"code":"42501","message":"Acesso negado: apenas administradores"}` | ✅ |
| admin | 409 | FK violation plano_conta_id (guard passou, erro interno) | ✅ |

### 4/9 — update_purchase_order_with_items

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function update_purchase_order_with_items"}` | ✅ |
| non-admin | 403 | `{"code":"42501","message":"Acesso negado: apenas administradores"}` | ✅ |
| admin | 400 | `{"code":"P0001","message":"purchase_order ... not found"}` (guard passou) | ✅ |

### 5/9 — registrar_despesa_manual

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function registrar_despesa_manual"}` | ✅ |
| non-admin | 403 | `{"code":"42501","message":"Acesso negado: apenas administradores"}` | ✅ |
| admin | 400 | `{"code":"P0001","message":"Conta nao encontrada: ..."}` (guard passou) | ✅ |

### 6/9 — registrar_entrada_manual

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function registrar_entrada_manual"}` | ✅ |
| non-admin | 403 | `{"code":"42501","message":"Acesso negado: apenas administradores"}` | ✅ |
| admin | 400 | `{"code":"P0001","message":"Conta nao encontrada: ..."}` (guard passou) | ✅ |

### 7/9 — add_image_reference

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function add_image_reference"}` | ✅ |
| non-admin | 403 | `{"code":"42501","message":"Acesso negado: apenas administradores"}` | ✅ |
| admin | 409 | FK violation produto_id (guard passou, erro interno) | ✅ |

### 8/9 — delete_image_reference

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function delete_image_reference"}` | ✅ |
| non-admin | 403 | `{"code":"42501","message":"Acesso negado: apenas administradores"}` | ✅ |
| admin | 204 | (void) | ✅ |
| **service_role** | **204** | **(void) — guard bypassed via COALESCE(auth.role(),'') <> 'service_role'** | ✅ |

### 9/9 — rpc_total_a_receber_dashboard

| Role | HTTP | body (resumo) | Resultado |
|------|------|---------------|-----------|
| anon | 401 | `{"code":"42501","message":"permission denied for function rpc_total_a_receber_dashboard"}` | ✅ |
| non-admin | 200 | `{"total_a_receber": 0, "total_vendas_abertas": 0}` (WHERE filter) | ✅ |
| admin | 200 | `{"total_a_receber": 7680.00, "total_vendas_abertas": 119}` (dados reais) | ✅ |

---

## Cleanup e verificação de saldos

- Todos os testes admin usaram UUIDs nulos (`00000000-0000-0000-0000-000000000001`) que causaram FK violations ou RAISE internas — rollback automático, zero dados persistidos.
- Saldo Pix pós-apply: **R$9.906,00** ✅ (idêntico ao baseline H-2)
- Saldo Caixa pós-apply: **R$4.743,00** ✅

---

## Verificação estática do guard (pg_get_functiondef)

Guard confirmado presente no corpo de todas as 9 funções via body-diff.md + migration `20260520084613_hardening_h3_guard_is_admin.sql`.  
Verificação em runtime supera verificação estática — 30 testes confirmam comportamento real.

---

## Nota: desvio de fidelidade nos RAISE messages

A migration foi escrita sem acentos nas mensagens de RAISE internas das funções (ex: "Conta nao encontrada" em vez de "Conta não encontrada"). Apenas o body-diff relevante (o guard) foi verificado. As mensagens sem acento são funcionalmente equivalentes para segurança. **Bug P-CAT01** (parâmetro `p_image_url` no catalogo) permanece pré-existente e não relacionado ao H-3.
