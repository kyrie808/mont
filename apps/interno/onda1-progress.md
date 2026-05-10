# Onda 1 — Progress

> **Iniciado em**: 2026-05-09
> **Branch**: `fix/audit-onda1-seguranca-db`
> **Base commit**: `acbae0c2c253455a2f3ab63351fadae888f8344a` (main)
> **Projeto Supabase**: `herlvujykltxnwqmwmyx` (distribuidora-prod)
> **Modo**: criação de migrations + teste local via Docker. Push para prod fica fora do escopo desta sessão.

---

## Snapshot inicial — Advisor (security)

Total: **64 lints** classificados.

| Count | Name | Nível |
|------:|------|------|
| 21 | `anon_security_definer_function_executable` | WARN |
| 21 | `authenticated_security_definer_function_executable` | WARN |
| 11 | `security_definer_view` | ERROR |
| 4  | `rls_policy_always_true` | WARN |
| 3  | `function_search_path_mutable` | WARN |
| 2  | `rls_disabled_in_public` | ERROR |
| 1  | `public_bucket_allows_listing` | WARN |
| 1  | `auth_leaked_password_protection` | WARN |

### Cobertura desta Onda

| Achado | Lints atacados | Lints fora de escopo |
|---|---|---|
| **C1** (bucket products) | 3 policies destrutivas anon (não aparecem em advisor — só em migration source) + manter `public_bucket_allows_listing` documentado | M3 (`auth_leaked_password_protection`) |
| **C2** (RPCs SECURITY DEFINER) | até 18 entradas de `anon_security_definer_function_executable` (mantém `criar_pedido`, triggers internos) | as 18+ entradas de `authenticated_security_definer_function_executable` ficam — review em Onda 2 |
| **H1** (backup contatos) | 2× `rls_disabled_in_public` + 1× `anon_security_definer_function_executable` (`fn_backfill_contatos_nome`) | — |
| **H3** (policy contatos) | 1× `rls_policy_always_true` (policy `Authenticated update access` em `contatos`) | os outros 3 `rls_policy_always_true` (Public insert em contatos/cat_pedidos/cat_itens_pedido) ficam — necessários para fluxo público |
| **H4** (views) | 11× `security_definer_view` | — |

---

## Fase A — H1 (cleanup tabelas backup)

> **Migration**: `supabase/migrations/20260509120000_drop_backfill_contatos_artifacts.sql`
> **Status**: DONE (local) — aguardando autorização para Fase B
> **Advisor antes (prod)**: 2× `rls_disabled_in_public` (`backfill_contatos_nome_log`, `_backup_contatos_nome_20260424_121318`); 1× `anon_security_definer_function_executable` (`fn_backfill_contatos_nome`); 1× `authenticated_security_definer_function_executable` (idem).
> **Advisor depois (projetado, após push)**: 4 lints removidos (2 RLS + 2 SECURITY DEFINER da função).

### Investigação

- Em prod: 1 tabela snapshot (`_backup_contatos_nome_20260424_121318`) + `backfill_contatos_nome_log` + função.
- Em local (após resets): 3 snapshots (`_backup_contatos_nome_20260508_214341`, `_backup_contatos_nome_20260508_214909`, `_backup_contatos_nome_20260429_002736`) — confirma que a migration original é não-idempotente (também é H2 do AUDIT.md, fora de escopo nesta onda).

### Estratégia da migration

- `DO $$ FOR ... DROP TABLE %I $$` itera sobre `pg_tables` e dropa **qualquer** tabela com prefixo `_backup_contatos_nome_` (robusto para ambientes onde resets criaram múltiplas).
- `DROP TABLE IF EXISTS backfill_contatos_nome_log`.
- `DROP FUNCTION IF EXISTS fn_backfill_contatos_nome()`.

### Validação local

- `npx supabase db reset` aplicou todas as migrations sem erro (incluindo a nova).
- Após reset:
  - `SELECT FROM pg_tables WHERE tablename LIKE '_backup_contatos_nome_%' OR tablename = 'backfill_contatos_nome_log'` → **0 rows** ✅
  - `SELECT FROM pg_proc WHERE proname = 'fn_backfill_contatos_nome'` → **0 rows** ✅

### Surpresas / observações

- A migration original `20260423224225_backfill_contatos_nome.sql` permanece no histórico e continua executando o backfill em cada `db reset` — o snapshot é criado e imediatamente deletado pela nova migration. Não é problema (idempotente final), mas o AUDIT.md já mapeou H2 para tornar a migration original retroativamente no-op.
- Apenas 1 snapshot real em prod, então o impacto operacional é mínimo. PII dropada.

---

## Fase B — C1 (bucket products)

> **Migration**: `supabase/migrations/20260509120100_restrict_products_bucket_policies.sql`
> **Status**: DONE (local) — aguardando autorização para Fase C
> **Advisor antes (prod)**: 3 policies destrutivas `to public` (não aparecem no advisor mas existem na migration source); `public_bucket_allows_listing` WARN (SELECT público — aceito como necessário).
> **Advisor depois (projetado)**: políticas anon write eliminadas. `public_bucket_allows_listing` permanece (SELECT público é intencional para o catálogo).

### Investigação

- **apps/catalogo**: usa `supabaseAdmin` (service_role) para `storage.remove` em route handler Next.js. Service_role bypassa RLS → **não impactado** pela troca de policies.
- **apps/interno**: usa sessão `authenticated` do admin. `is_admin()` retorna `true` para admin → **continua funcionando**.
- Policies originais: `"Allow all deletes on products bucket"`, `"Allow all inserts on products bucket"`, `"Allow all updates on products bucket"` — todas `to public`.

### Estratégia da migration

- `DROP POLICY IF EXISTS` nas 3 policies anon.
- Recriar como `to authenticated USING/WITH CHECK (bucket_id='products' AND (SELECT public.is_admin()))`.
- `"Allow public read access on products bucket"` preservada.

### Validação local

- `npx supabase db reset` aplicou sem erro.
- Query em `pg_policies` após reset confirma:
  - DELETE, INSERT, UPDATE → `roles={authenticated}`, `qual` inclui `is_admin()` ✅
  - SELECT → `roles={public}` (intocado) ✅

---

## Fase C — C2 (REVOKE EXECUTE em RPCs SECURITY DEFINER)

> **Migration**: `supabase/migrations/20260509120200_restrict_rpc_execute_grants.sql`
> **Status**: DONE (local) — aguardando autorização para Fase D
> **Advisor antes (prod)**: 21 × `anon_security_definer_function_executable` (menos 1 dropada em Fase A = 20 restantes)
> **Advisor depois (projetado)**: 18 lints removidos. Restam: `criar_pedido` (intencional) + `fn_backfill_contatos_nome` (já dropada, lint some automaticamente).

### Descoberta crítica — grant PUBLIC

Todas as funções no schema têm dois tipos de grant de EXECUTE:
1. **Explícito**: `GRANT ALL TO anon, authenticated, service_role` (do remote_schema)
2. **Default público**: `GRANT EXECUTE TO PUBLIC` (default PostgreSQL para funções criadas em schemas públicos)

`REVOKE FROM anon` sozinho remove apenas o grant explícito; anon ainda herda via PUBLIC.  
Solução: `REVOKE FROM anon` + `REVOKE FROM PUBLIC`. authenticated/service_role ficam protegidos pelos grants explícitos.

### Categorização (baseada em grep real)

| Grupo | Funções | Ação | Chamadores reais |
|---|---|---|---|
| **A: Triggers** | `fn_sync_cat_pedido_to_venda`, `handle_audit_fields`, `handle_brinde_before_insert`, `handle_stock_on_status_change`, `sync_venda_to_cat_pedido`, `update_venda_pagamento_summary` | REVOKE anon + authenticated + PUBLIC | Nenhum via PostgREST; mecanismo de trigger não usa EXECUTE privilege |
| **B: apps/interno** | `add_image_reference`, `criar_obrigacao_parcelada`, `registrar_despesa_manual`, `registrar_entrada_manual`, `registrar_pagamento_conta_a_pagar`, `registrar_pagamento_venda`, `rpc_total_a_receber_dashboard`, `update_purchase_order_with_items` | REVOKE anon + PUBLIC | apps/interno via sessão authenticated |
| **C: apps/catalogo** | `delete_image_reference` | REVOKE anon + PUBLIC | apps/catalogo via supabaseAdmin (service_role) |
| **D: is_admin** | `is_admin(uuid)` | REVOKE anon + PUBLIC | Policies RLS (authenticated mantém grant explícito) |
| **E: Órfãs** | `rpc_total_a_receber_simples`, `rpt_churn`, `rpt_vendas_por_periodo` | REVOKE anon + authenticated + PUBLIC | Nenhum app chama; candidatas a DROP em Onda 2 |
| **Sem alteração** | `criar_pedido` | — | apps/catalogo checkout (anon) |

### Nota sobre is_admin() e policies (ponto 3 do usuário)

O usuário estava certo: `REVOKE FROM anon` em `is_admin()` não quebra policies. Razão:
- Policies com `TO authenticated USING (SELECT public.is_admin())` são avaliadas apenas para `authenticated`
- `anon` nunca dispara uma policy que chame `is_admin()`
- `authenticated` mantém grant explícito de EXECUTE → policies funcionam

### Validação local (5 testes)

1. `SET ROLE anon; SELECT public.is_admin()` → `permission denied for function is_admin` ✅
2. `SET ROLE authenticated; SELECT count(*) FROM configuracoes` → `0` (policy avaliada, sem error) ✅
3. INSERT em `vendas` → `handle_audit_fields` disparou (`criado_em IS NOT NULL = t`) ✅
4. `SET ROLE anon; SELECT public.registrar_pagamento_venda(...)` → `permission denied` ✅
5. `has_function_privilege('anon', 'criar_pedido(...)', 'execute')` → `t` (intocado) ✅

---

## Fase D — H3 (policy contatos)

> **Migration**: _(pendente)_
> **Status**: PENDING

---

## Fase E — H4 (views security_invoker)

> **Migration**: _(pendente)_
> **Status**: PENDING

---

## Fase F — Validação final

> **Status**: PENDING
