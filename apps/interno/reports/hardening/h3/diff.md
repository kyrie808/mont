# H-3 Diff — Baseline → Pós-Apply

**Data:** 2026-05-20  
**Referência baseline:** `apps/interno/reports/hardening/h2/baseline.md`

## Transições por RPC (coluna non-admin)

| # | RPC | Baseline (non-admin) | Pós H-3 (non-admin) | Transição |
|---|-----|---------------------|---------------------|-----------|
| 1 | registrar_pagamento_venda | 200 (executou) | 403 + 42501 guard | ✅ 200 → 403 |
| 2 | registrar_pagamento_conta_a_pagar | 200 (executou) | 403 + 42501 guard | ✅ 200 → 403 |
| 3 | criar_obrigacao_parcelada | 200 (executou) | 403 + 42501 guard | ✅ 200 → 403 |
| 4 | update_purchase_order_with_items | 204 (executou) | 403 + 42501 guard | ✅ 204 → 403 |
| 5 | registrar_despesa_manual | 200 (executou) | 403 + 42501 guard | ✅ 200 → 403 |
| 6 | registrar_entrada_manual | 200 (executou) | 403 + 42501 guard | ✅ 200 → 403 |
| 7 | add_image_reference | 204 (executou) | 403 + 42501 guard | ✅ 204 → 403 |
| 8 | delete_image_reference | 204 (executou) | 403 + 42501 guard | ✅ 204 → 403 |
| 9 | rpc_total_a_receber_dashboard | 200 + dados reais | 200 + {zeros} | ✅ dados → zeros |

**Total:** 8 transições "execução → bloqueio" + 1 transição "dados → zeros" = 9/9 ✅

## Coluna anon — inalterada (design intencional, zero REVOKE)

| RPC | Baseline (anon) | Pós H-3 (anon) | Status |
|-----|----------------|----------------|--------|
| todos os 9 | 401 permission denied | 401 permission denied | ✅ inalterado |

## Coluna admin — inalterada

| RPC | Baseline (admin) | Pós H-3 (admin) | Status |
|-----|-----------------|-----------------|--------|
| 1-6 financeiras | 200 | 200 (guard passa, is_admin()=true) | ✅ |
| add/delete image | 204 | 204 / 409 FK (guard passa) | ✅ |
| rpc_total | 200 dados reais | 200 dados reais | ✅ |

*Nota: admin com UUID nulo pode receber 409 ou 400 de validação interna — isso é esperado. A ausência de 403+42501 confirma que o guard não bloqueou o admin.*

## Novo contexto: service_role (delete_image_reference)

| RPC | Baseline | Pós H-3 (service_role) | Status |
|-----|----------|----------------------|--------|
| delete_image_reference | N/A (não testado) | 204 — guard bypassed | ✅ |

## Advisor authenticated_security_definer_function_executable

Pré H-3: 9 RPCs retornavam `authenticated` com EXECUTE → advisor listava como advisory.  
Pós H-3: As 9 funções ainda têm EXECUTE para `authenticated` (zero REVOKE — design intencional).  
O advisor continuará listando. Critério de sucesso é o role test, não o advisor.  
**Funções que deixam de ser risco efetivo:** todas as 9 (guard bloqueia non-admin antes de qualquer operação).  
**Funções que o advisor NÃO listará mais (EXECUTE grant inalterado):** nenhuma (advisor vê proacl, não o guard).

## Bug pré-existente identificado (não relacionado ao H-3)

**P-CAT01:** `apps/catalogo/src/app/api/admin/produtos/[id]/imagem/route.ts` passa `p_image_url` como parâmetro extra para `delete_image_reference(p_produto_id uuid)`. A função não aceita esse parâmetro — PostgREST retorna PGRST202 ou 42883. Feature provavelmente quebrada em produção antes do H-3. Registrar como task separada.
