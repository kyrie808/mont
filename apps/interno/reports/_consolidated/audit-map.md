# Audit Map — Cross-Phase Inventory
**Gerado:** 2026-05-17
**Base:** commit `21280b1` (branch `main`)
**Projeto:** `herlvujykltxnwqmwmyx`
**Fases cobertas:** Phase 1 (Build/Lint) → Phase 2 (DB) → Phase 3 (Tipos) → Phase 4 (Dead Code) → Phase 5 (Testes) → Phase 6 (Performance/Segurança)

---

## 1. Inventário Cross-Phase por Severidade

### 🔴 CRÍTICO

| ID | Fase | Descrição | Status |
|---|---|---|---|
| H3 | P2/P6 | `contatos.Authenticated update access` — USING(true) WITH_CHECK(true): qualquer autenticado pode UPDATE qualquer contato | STILL_OPEN |
| H4 | P2/P6 | 11 views com `SECURITY DEFINER` — bypassam RLS do consumidor | STILL_OPEN |
| C2 | P2/P6 | 6 RPCs financeiras UNGUARDED: `registrar_pagamento_venda`, `registrar_pagamento_conta_a_pagar`, `criar_obrigacao_parcelada`, `update_purchase_order_with_items`, `registrar_despesa_manual`, `registrar_entrada_manual` — authenticated executa sem is_admin() | RESOLVED |
| P3-T05 | P3/P4 | 2 RPCs financeiras UNGUARDED com UI parked no DB: `registrar_pagamento_conta_a_pagar`, `criar_obrigacao_parcelada` — subconjunto de C2 + contexto: front parked ≠ RPC morta | RESOLVED |
| P5-T01 | P5 | `registrar_despesa_manual`: zero testes — RPC financeira crítica (INSERT lancamento + trigger saldo) | OPEN |
| P5-T02 | P5 | `registrar_entrada_manual`: zero testes — RPC financeira crítica (INSERT lancamento + trigger saldo) | OPEN |
| P5-T03 | P5 | `update_purchase_order_with_items`: zero testes — RPC financeira crítica (jsonb array, DELETE/INSERT items) | OPEN |
| P5-T08-FIN | P5 | 7 entidades financeiras sem Zod e sem critério de validação testado: `purchase_orders`, `lancamentos`, `contas_a_pagar`, `pagamentos_conta_a_pagar`, `plano_de_contas`, `configuracoes`, `produtos` | OPEN |
| P6-DEP01 | P6 | `next@15.5.14` em `apps/catalogo` — 4 HIGH middleware bypass CVEs (GHSA-26hh, GHSA-267c, GHSA-492v, GHSA-36qx); fix ≥15.5.18 | OPEN |

### 🟡 IMPORTANTE

| ID | Fase | Descrição | Status |
|---|---|---|---|
| P1-L01 | P1 | `_parked/` não excluído do ESLint — polui contagem de erros (10e+6w dos 72 totais) | RESOLVED |
| P1-L02 | P1 | 29 `no-explicit-any` em produção (16 arquivos) | OPEN |
| P2-DB02 | P2 | 3 policies `rls_policy_always_true` para INSERT público (contatos, cat_pedidos, cat_itens_pedido) — sem rate limit | STILL_OPEN |
| P2-DB04 | P2/P6 | 7 FKs sem índice: `contas_a_pagar` (×3: created_by, plano_conta_id, updated_by) + `pagamentos_conta_a_pagar` (×4: conta_a_pagar_id, conta_id, created_by, updated_by) | STILL_OPEN |
| P2-DB05 | P2/P6 | 2 policies com `auth.uid()` RAW (re-avalia por row): `admin_users` + `interacoes` | STILL_OPEN |
| P2-DB07 | P2/P6 | 18 multiple_permissive_policies (admin ALL + authenticated SELECT sobrepostos) | STILL_OPEN |
| P2-DB08 | P2 | Migration `20260423224225` não-idempotente: cada `db reset` cria tabela `_backup_contatos_nome_<TS>` com PII | STILL_OPEN |
| P3-T01 | P3 | `mappers.ts:28-32`: 5 aliases `= any` + 2 cascade (lines 215, 257) — PurchaseOrderRow, CatalogOrderRow etc | OPEN |
| P3-T02 | P3 | `dashboardService.ts:3-5`: 3 aliases `= any` de views — HomeFinanceiroRow, HomeOperacionalRow, HomeAlertasRow | OPEN |
| P3-T04 | P3 | 14 callbacks `(x: any)` em queries Supabase (9 arquivos) — types existem mas não importados | OPEN |
| P3-T10 | P3 | Cobertura Zod: 2/21 entidades com validação de boundary — 19 entidades write sem Zod | OPEN |
| P4-DC01 | P4 | `_parked/contas-a-pagar`: tabelas + view vivas em prod, sem UI — decisão pendente (DROP ou reativar) | OPEN |
| P4-DC02 | P4 | `AlertasRecompraWidget.tsx:77`: navega para `/relacionamento` (parked, retorna null) → tela em branco silenciosa | RESOLVED |
| P4-DC03 | P4 | 2 widgets mortos em `src/`: `AlertasContasAPagarWidget.tsx` + `LogisticsWidget.tsx` (zero importers, em src/ não em _parked/) | RESOLVED |
| P5-T04 | P5 | ZERO role/permission tests em todos os 11 SECDEF RPCs | OPEN |
| P5-T05 | P5 | `add_image_reference`, `delete_image_reference`: zero testes | OPEN |
| P5-T06 | P5 | `registrar_pagamento_venda`: happy path ✓ — zero boundary, zero role | OPEN |
| P5-T07 | P5 | Schemas Zod (contato, venda, pagamento): zero unit tests de validação | OPEN |
| P5-T08 | P5 | ~12 entidades não-financeiras sem nenhum critério de validação testado | OPEN |
| P5-T09 | P5 | Teste órfão failing: `backfill_contatos_nome.integration.test.ts` (= P4-DC04) | RESOLVED |
| P5-T10 | P5 | Vitest sem CI gate: sem coverage thresholds, sem GitHub Actions | OPEN |
| P6-DEP02 | P6 | `vite@7.3.1` — 3 HIGH CVEs (dev server): server.fs.deny bypass, arbitrary file read, .map traversal; fix ≥7.3.2 | RESOLVED |
| P6-DEP03 | P6 | `serialize-javascript@6.0.2` (via vite-plugin-pwa) — HIGH RCE (build tool, não prod) | OPEN |
| P6-BUND01 | P6 | `Estoque3DView-C9Zv8QyA.js`: 340.8 KB gzip — excede threshold 200 KB (Three.js lazy-loaded) | RESOLVED |

### 🟢 MELHORIA

| ID | Fase | Descrição | Status |
|---|---|---|---|
| P1-L03 | P1 | 12 `no-explicit-any` em arquivos de teste | OPEN |
| P1-L04 | P1 | 5 erros `no-unused-vars` em catch blocks (`_error`, `_err`) | OPEN |
| P1-L05 | P1 | 1 erro `no-empty` em catch block (VendaDetalhe.tsx:125) | OPEN |
| P1-L06 | P1 | 3 erros `react-hooks/preserve-manual-memoization` em useContatos.ts | OPEN |
| P1-L07 | P1 | 3 warnings `react-hooks/exhaustive-deps` em useContatos.ts (toast faltando) | OPEN |
| P1-L08 | P1 | 3 erros `no-empty-object-type` em vite-env.d.ts (boilerplate) | OPEN |
| P1-TEST01 | P1 | Teste órfão: backfill_contatos_nome.integration.test.ts (= P4-DC04 = P5-T09) | RESOLVED |
| P2-DB01 | P2 | 3 funções com `search_path` mutável (não SECDEF — baixo risco) | STILL_OPEN |
| P2-DB03 | P2 | `auth_leaked_password_protection` desligado no Supabase Auth | STILL_OPEN |
| P2-DB06 | P2/P6 | 16 unused indexes (espaço em disco, sem risco) | STILL_OPEN |
| P3-T03 | P3 | `cashFlowService.ts:28`: `VendaAlerta = any` (alias isolado) | OPEN |
| P3-T06 | P3 | `DomainProduto`: campo duplicado `preco_ancoragem` (snake) + `precoAncoragem` (camel) | OPEN |
| P3-T08 | P3 | `database.ts` contém bloco `graphql_public` (CLI artifact — auto-eliminado no próximo gen) | OPEN |
| P3-T09 | P3 | `useCatalogoPendentes.ts:56`: `const vendaInsert: any` (declaração local) | OPEN |
| P4-DC04 | P4 | Teste órfão: `backfill_contatos_nome.integration.test.ts` (= P1-TEST01 = P5-T09) | RESOLVED |
| P4-DC05 | P4 | Feature flags `ENABLE_GELADEIRA=false` + `ENABLE_RECOMPRA=false` — Vite DCE confirmado, code in src/ | RESOLVED |
| P4-DC06 | P4 | `.env.example` é template AIOS genérico — não documenta VITE_SUPABASE_* | OPEN |
| P4-DC07 | P4 | `vite.config.ts` proxy `/api → localhost:5000` sem referência em src/ | OPEN |
| P4-DC08 | P4 | 3 type aliases órfãos em `@mont/shared` (PedidoCatalogo, ItemPedidoCatalogo, ImagemProdutoCatalogo) | RESOLVED |
| P4-DC09 | P4 | 6 npm deps não usadas removidas: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, clsx, dotenv, tailwind-merge. Bundle pós-L.1: ~687 KB gzip JS (pré-L.1: 663.5 KB; +23.5 KB overhead do Vite 7 — Estoque3DView ainda presente a 351 KB, parked em D3) | RESOLVED |
| P4-DC10 | P4 | Arquivos órfãos em src/: utils duplicados, barrel files vazios, widgets experimentais (WarRoomWidget, TacticalActionCard) | RESOLVED |
| P5-T11 | P5 | Sem `__fixtures__/`: helpers inline duplicados por arquivo de teste | OPEN |
| P5-T12 | P5 | ~20 `as any` em spec files (cascade de P3-T01/T02 — resolve automaticamente) | OPEN |
| P6-SEC01 | P6 | `test-utils.ts`: LOCAL_SERVICE_KEY hardcoded (`iss=supabase-demo` — Docker local, sem validade em prod) | OPEN |
| P6-DEP04 | P6 | Vários patches disponíveis: react 19.2.4→19.2.6, zod 4.3.6→4.4.3, supabase-js 2.101.1→2.105.4, tanstack-query 5.96.1→5.100.10 | RESOLVED |

---

## 2. Resolvidos (referência)

| ID | Descrição | Onda |
|---|---|---|
| C1 | Bucket `products`: policies de escrita anon removidas, substituídas por admin-only | Onda 1 |
| H1 | Tabelas `_backup_contatos_*` + `fn_backfill_contatos_nome` dropadas | Onda 1 |
| C2 (lado anon) | REVOKE EXECUTE em 20 RPCs para anon — apenas `criar_pedido` permanece intencional | Onda 1 |
| C2 | 9 RPCs (6 financeiras + `add_image_reference`, `delete_image_reference`, `rpc_total_a_receber_dashboard`) guardadas com `is_admin()` — design: zero REVOKE de `authenticated` (admin e non-admin compartilham o mesmo role Postgres `authenticated`); guard: `NOT is_admin() AND COALESCE(auth.role(),'') <> 'service_role'`. **Nota advisor:** `authenticated_security_definer_function_executable` continua listando as 9 funções — EXECUTE grant de `authenticated` preservado intencionalmente; guard é o mecanismo de enforcement, não REVOKE | H-3 |
| P3-T05 | `registrar_pagamento_conta_a_pagar` + `criar_obrigacao_parcelada` — subconjunto de C2; guards `is_admin()` aplicados uniformemente junto com as 7 outras RPCs em H-3 | H-3 |
| P4-DC04 / P5-T09 / P1-TEST01 | `backfill_contatos_nome.integration.test.ts` removido (`git rm`) — RPC + tabela dropadas na Onda 1 | Onda L.1 |
| P4-DC03 | `AlertasContasAPagarWidget.tsx` + `LogisticsWidget.tsx` deletados (zero importers, em src/) | Onda L.1 |
| P4-DC10 | Utils duplicados (`cn.ts`, `formatters.ts`, `lib/utils.ts`) + barrel files + `WarRoomWidget.tsx` + `TacticalActionCard.tsx` removidos | Onda L.1 |
| P4-DC09 | 6 deps removidas: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `clsx`, `dotenv`, `tailwind-merge`. Bundle pós-L.1: ~687 KB gzip (pré: 663.5 KB; +23.5 KB Vite 7 overhead; Estoque3DView 351 KB ainda presente — parked em D3) | Onda L.1 |
| P4-DC08 | 3 type aliases órfãos removidos de `@mont/shared`: `PedidoCatalogo`, `ItemPedidoCatalogo`, `ImagemProdutoCatalogo` + barrel re-exports | Onda L.1 |
| P1-L01 | `_parked/**` adicionado ao `globalIgnores` em `eslint.config.js` | Onda L.1 |
| P6-DEP02 | `vite` atualizado para `7.3.2` (3 CVEs dev server corrigidas) | Onda L.1 |
| P6-DEP04 | Patches aplicados: `react@19.2.6`, `zod@4.4.3`, `supabase-js@2.105.4`, `tanstack-query@5.100.10`, etc. | Onda L.1 |
| P4-DC05 | `flags.ts` removido; geladeira (7 arquivos) + recompra (3 arquivos) movidos para `_parked/` via `git mv` — decisão (b): park, não reativar | Pré-Hardening D3 |
| P4-DC02 | `AlertasRecompraWidget` parked (→ `_parked/recompra/`) — bug de navigate para /relacionamento eliminado junto com o widget | Pré-Hardening D3 |
| P6-BUND01 | `Estoque3DView` parked — chunk Three.js 351 KB gzip eliminado. Bundle pós-D3: ~336 KB gzip JS (de 687 KB pós-L.1; −351 KB = −51%) | Pré-Hardening D3 |

---

## 3. Clusters de Achados

### Cluster: "SECDEF RPCs sem guarda" — ✅ Parcialmente resolvido (H-3)

**IDs:** C2 (✅ RESOLVED) · P3-T05 (✅ RESOLVED) · P5-T04 (🟡 OPEN — role tests manuais feitos, sem automação) · H4 (🔴 STILL_OPEN)

| ID | Contribuição ao cluster | Status |
|---|---|---|
| C2 | 9 RPCs (6 financeiras + image + dashboard): guard `is_admin()` aplicado via H-3 | ✅ RESOLVED |
| P3-T05 | `registrar_pagamento_conta_a_pagar` + `criar_obrigacao_parcelada`: guard aplicado uniformemente em H-3 | ✅ RESOLVED |
| H4 | 11 views SECDEF: RLS do consumidor contornada silenciosamente | 🔴 STILL_OPEN |
| P5-T04 | 30 role tests manuais documentados em `post-apply.md` — sem automação Vitest | 🟡 PARTIAL |

**Remediação executada (H-3, 2026-05-20):**
- Guard `NOT is_admin() AND COALESCE(auth.role(),'') <> 'service_role'` em 8 funções plpgsql
- WHERE `AND (SELECT public.is_admin())` em `rpc_total_a_receber_dashboard` (LANGUAGE sql)
- Zero REVOKE de `authenticated` — design intencional: admin e non-admin compartilham role Postgres
- Advisor `authenticated_security_definer_function_executable` continua listando (proacl inalterado)
- Migration: `supabase/migrations/20260520084613_hardening_h3_guard_is_admin.sql`

**Próximo:** H-4 (views SECDEF) + automação de role tests em Vitest

---

### Cluster: "RLS permissivo"

**IDs:** H3 (🔴) · P2-DB02 (🟡) · P2-DB07 (🟡)

| ID | Contribuição ao cluster |
|---|---|
| H3 | contatos UPDATE USING(true): qualquer login pode alterar telefone, endereço, status_relacionamento de qualquer contato |
| P2-DB02 | 3 policies INSERT público sem validação de payload — contatos anônimos, pedidos do catálogo |
| P2-DB07 | 18 sobreposições "admin full access" + "authenticated read" — redundância que complica auditoria de policies |

**Remediação coordenada:**
1. H3: Substituir USING(true) por `USING((SELECT is_admin()))` — contatos UPDATE restrito a admin (decisão 2026-05-19)
2. P2-DB02: Adicionar `with_check = (length(nome) > 2 AND telefone ~ '^\d{10,13}$')` nas insert policies públicas
3. P2-DB07: Consolidar admin+authenticated em policy `FOR ALL` unificada por tabela (backlog — não bloqueia H3)

---

### Cluster: "Contas a Pagar" — Decisão: keep parked (2026-05-19)

**IDs:** P4-DC01 (🟡) · P2-DB04 (🟡) · P3-T05 (🔴, parcial) · P5-T08-FIN (🔴, parcial)

| ID | Contribuição ao cluster |
|---|---|
| P4-DC01 | Tabelas `contas_a_pagar` + `pagamentos_conta_a_pagar` + view `view_contas_a_pagar_dashboard` vivas sem UI |
| P2-DB04 | 7 FKs não indexadas nessas 2 tabelas (contas_a_pagar ×3 + pagamentos_conta_a_pagar ×4) |
| P3-T05 | 2 RPCs financeiras UNGUARDED nessas tabelas: DROP agora (cluster SECDEF) ou guard ao reativar |
| P5-T08-FIN | Tabelas vivas sem nenhum teste de validação |

**Decisão 2026-05-19: manter parked por ora.** RPCs recebem guards `is_admin()` na Onda Hardening (H-3), uniformes com as 4 RPCs ativas (H-4).

**Cenário A — Reativar (deferred):**
  - Criar UI (mover de _parked/ para src/)
  - Adicionar 7 indexes (P2-DB04)
  - Guards is_admin() já aplicados por H-3 — reutilizar
  - Adicionar integration tests (P5-T08-FIN)

**Cenário B — DROP (deferred, requer nova decisão):**
  - Migration: DROP TABLE pagamentos_conta_a_pagar, DROP TABLE contas_a_pagar (CASCADE)
  - DROP VIEW view_contas_a_pagar_dashboard
  - DROP FUNCTION registrar_pagamento_conta_a_pagar, criar_obrigacao_parcelada (resolve P3-T05)
  - Deletar `_parked/contas-a-pagar/` do repo

---

### Cluster: "as any / Tipo fraco" — Tipo safety

**IDs:** P1-L02 (🟡) · P3-T01 (🟡) · P3-T02 (🟡) · P3-T04 (🟡) · P3-T09 (🟢) · P3-T03 (🟢) · P5-T12 (🟢)

| ID | Contribuição | Arquivos |
|---|---|---|
| P1-L02 | 29 ocorrências `no-explicit-any` em produção | 16 arquivos src/ |
| P3-T01 | 5 aliases raiz + 2 cascade em mappers.ts — maior impacto por esforço | mappers.ts:28-32 |
| P3-T02 | 3 aliases de views em dashboardService.ts | dashboardService.ts:3-5 |
| P3-T04 | 14 callbacks `(x: any)` em queries (Types existem via Tables<T>) | 9 serviços/hooks |
| P3-T09 | 1 declaração local `vendaInsert: any` | useCatalogoPendentes.ts:56 |
| P3-T03 | 1 alias isolado `VendaAlerta = any` | cashFlowService.ts:28 |
| P5-T12 | ~20 `as any` em spec files — cascade automática de P3-T01/T02 | spec files |

**Ponto de entrada:** P3-T01 (mappers.ts) — 5 linhas corrigidas eliminam 7 instâncias (2 cascatas). Depois P3-T02 (3 linhas). P5-T12 resolve sem esforço adicional como cascade.

---

### Cluster: "Cobertura testes financeiros" — Risco de regressão

**IDs:** P5-T01 (🔴) · P5-T02 (🔴) · P5-T03 (🔴) · P5-T06 (🟡) · P5-T08-FIN (🔴)

| ID | RPC / Entidade | Gap |
|---|---|---|
| P5-T01 | `registrar_despesa_manual` | Zero testes |
| P5-T02 | `registrar_entrada_manual` | Zero testes |
| P5-T03 | `update_purchase_order_with_items` | Zero testes |
| P5-T06 | `registrar_pagamento_venda` | Happy path only — sem boundary, sem role |
| P5-T08-FIN | `purchase_orders`, `lancamentos`, `configuracoes`, `produtos`, + parked entities | Zero validação testada |

**Contexto:** Data de referência financeira é 01/05/2026. Lançamentos incorretos afetam diretamente KPIs do Dashboard. Cada RPC listada afeta `contas.saldo_atual` via trigger `update_conta_saldo_lancamento`.

---

### Cluster: "Parked code — Limpeza"

**IDs:** P4-DC02 (🟡) · P4-DC03 (🟡) · P4-DC04/P5-T09/P1-TEST01 (🟢) · P4-DC05 (🟢) · P4-DC08 (🟢) · P4-DC09 (🟢) · P4-DC10 (🟢)

| ID | Ação | Esforço |
|---|---|---|
| P4-DC02 | Substituir `navigate('/relacionamento?aba=reativacao')` por ação alternativa (WhatsApp direct ou remover botão) | 5 min |
| P4-DC03 | Mover `AlertasContasAPagarWidget.tsx` + `LogisticsWidget.tsx` para _parked/ ou deletar | 5 min |
| P4-DC04/P5-T09/P1-TEST01 | `git rm tests/integration/backfill_contatos_nome.integration.test.ts` | 1 min |
| P4-DC05 | Remover `flags.ts` + EstoqueWidget + recompraService (DCE confirmado) | 20 min |
| P4-DC08 | Remover 3 type aliases de `@mont/shared/types.ts` + barrel | 5 min |
| P4-DC09 | `pnpm remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities clsx dotenv tailwind-merge --filter interno` | 2 min |
| P4-DC10 | Remover cn.ts, formatters.ts duplicados; avaliar barrel files; remover WarRoomWidget + TacticalActionCard | 30 min |

---

### Cluster: "DB Performance" — Acúmulo técnico

**IDs:** P2-DB04 (🟡) · P2-DB05 (🟡) · P2-DB06 (🟢) · P2-DB07 (🟡) · P2-DB08 (🟡)

| ID | Fix | Complexidade |
|---|---|---|
| P2-DB04 | `CREATE INDEX ON contas_a_pagar (plano_conta_id, created_by, updated_by); CREATE INDEX ON pagamentos_conta_a_pagar (conta_a_pagar_id, conta_id, created_by, updated_by)` | Trivial (1 migration) |
| P2-DB05 | Trocar `auth.uid()` por `(SELECT auth.uid())` em 2 policies (admin_users + interacoes) | Trivial (1 migration) |
| P2-DB06 | DROP de 16 índices nunca consultados (pg_stat_user_indexes.idx_scan=0) | Baixo risco (1 migration reversível) |
| P2-DB07 | Consolidar policies admin+authenticated em policy `FOR ALL` unificada | Médio (21 tabelas, 18 sobreposições) |
| P2-DB08 | Reescrever migration 20260423224225 para não executar backfill no apply, ou usar DROP wildcard na migration de cleanup | Médio (reescrever migration histórica) |

---

## 4. Sugestão de Ondas

### Onda Hardening — 🔴 Segurança (atacar todos os 🔴 abertos)

**Objetivo:** Fechar surface de ataque. Nenhum usuário autenticado deve poder movimentar caixa sem autorização admin.

**Pré-requisito:** Backup de produção (`.\supabase\scripts\dump-prod.ps1`) antes de qualquer migration.

**Pattern:** role tests do comportamento atual (baseline) → guards → role tests do comportamento esperado (verificação)

| Passo | ID(s) | Ação | Tipo | Estimativa |
|---|---|---|---|---|
| H-1 | P6-DEP01 | `pnpm --filter catalogo update next@^15.5.18` — patch trivial dentro do minor | `pnpm update` | Trivial (15min) |
| H-2 | P5-T04 (baseline) | **Role tests do comportamento ATUAL**: documentar o que anon × authenticated não-admin × admin conseguem fazer hoje nas 6 RPCs 🔴 e em contatos UPDATE — baseline antes de qualquer guard | Código | Baixo (1h) |
| H-3 | C2 + P3-T05 | ✅ **DONE 2026-05-20** — Guard `is_admin()` nas 9 RPCs (6 financeiras + add_image_reference + delete_image_reference + rpc_total). Zero REVOKE (admin e non-admin compartilham role `authenticated`). Migration: `20260520084613_hardening_h3_guard_is_admin.sql`. 30/30 role tests OK. | Migration | ✅ |
| H-4 | C2 | ✅ **DONE — subsumed by H-3** (as 4 RPCs ativas cobertas pela migration de H-3 junto com as 2 parked) | — | ✅ |
| H-5 | H3 | Corrigir policy `contatos.Authenticated update access`: substituir USING(true) por `USING((SELECT is_admin()))` — contatos = admin only (decisão 2026-05-19) | Migration | Baixo (1h) |
| H-6 | H4 | `ALTER VIEW ranking_compras ... SET (security_invoker=on)` × 11 views | Migration | Baixo (1h) |
| H-7 | P5-T04 (expected) + P5-T01/T02/T03 | **Role tests do comportamento ESPERADO**: verificar que guards bloqueiam anon + authenticated não-admin; integration tests das 3 RPCs sem cobertura (despesa, entrada, purchase_order) | Código | Médio (4h) |
| H-8 | P5-T08-FIN (ativas) | Integration tests de DB rejection para `purchase_orders`, `lancamentos`, `configuracoes`, `produtos` | Código | Médio (4h) |
| H-9 | P2-DB05 | Trocar `auth.uid()` RAW por `(SELECT auth.uid())` em 2 policies (admin_users + interacoes) | Migration | Trivial (15min) |

**Total estimado: ~17h** (15min + 1h + 2h + 4h + 1h + 1h + 4h + 4h + 15min — H-3 subiu 15min→2h por não dropar)

---

**Critério de fechamento — Onda Hardening concluída quando:**

1. `get_advisors` retorna vazio para todos os seguintes:
   - `anon_security_definer_function_executable` → 0 (exceto `criar_pedido`, intencional)
   - `authenticated_security_definer_function_executable` → 0 (exceto `criar_pedido`)
   - `rls_policy_always_true` → 0 (exceto 3 policies INSERT público de P2-DB02 — residue aceito)
   - `security_definer_view` → 0
2. Suíte de role tests cobrindo (anon × authenticated não-admin × admin) para:
   - As 6 RPCs financeiras guardadas: `registrar_despesa_manual`, `registrar_entrada_manual`, `registrar_pagamento_venda`, `update_purchase_order_with_items`, `registrar_pagamento_conta_a_pagar`, `criar_obrigacao_parcelada`
3. `pnpm audit` retorna zero CVEs 🔴 em `apps/catalogo`

---

**Resultado esperado:** Zero RPCs financeiras executáveis sem is_admin(); 11 views com RLS respeitada; contatos UPDATE restrito; next.js sem CVEs críticas em prod.

---

### Onda Limpeza — Dead code + Dívida técnica

**Objetivo:** Reduzir ruído no codebase. Zero bloqueador de feature. Dividida em 3 sub-ondas por tipo.

---

#### L.1 — Patches + Dead code óbvio

*Executa primeiro: zero dependências de decisão, zero risco de regressão.*

| Passo | ID(s) | Ação | Estimativa |
|---|---|---|---|
| L-1 | P4-DC04/P5-T09/P1-TEST01 | `git rm tests/integration/backfill_contatos_nome.integration.test.ts` | Trivial (15min) |
| L-2 | P4-DC02 | Substituir `navigate('/relacionamento?aba=reativacao')` em `AlertasRecompraWidget.tsx:77` por ação alternativa (WhatsApp direct ou remover botão) | Trivial (15min) |
| L-3 | P4-DC03 | Remover/mover `AlertasContasAPagarWidget.tsx` + `LogisticsWidget.tsx` de src/ para _parked/ ou deletar | Trivial (15min) |
| L-4 | P4-DC09 | `pnpm remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities clsx dotenv tailwind-merge --filter interno` | Trivial (15min) |
| L-5 | P4-DC08 | Remover 3 aliases órfãos de `@mont/shared/types.ts` (PedidoCatalogo, ItemPedidoCatalogo, ImagemProdutoCatalogo) + barrel re-exports | Trivial (15min) |
| L-6 | P4-DC10 | Remover utils duplicados (`cn.ts`, `formatters.ts`, `lib/utils.ts`), barrel files vazios, `WarRoomWidget.tsx`, `TacticalActionCard.tsx`; verificar imports path antes de remover barrels | Baixo (1h) |
| L-7 | P1-L01 | Adicionar `'_parked/**'` ao `globalIgnores` em `eslint.config.js:9` | Trivial (15min) |
| L-11 | P6-DEP02 | `pnpm --filter interno update vite@^7.3.2` | Trivial (15min) |
| L-12 | P6-DEP04 | `pnpm update` patches: react, zod, supabase-js, tanstack-query, postcss, turbo, vitest, etc. | Trivial (15min) |

**Total L.1: ~2.5h**

---

#### L.2 — Type safety

*Executa independente de L.1. P5-T12 resolve como cascade automática de L-8/L-9 (sem custo adicional).*

| Passo | ID(s) | Ação | Estimativa |
|---|---|---|---|
| L-8 | P3-T01 + P3-T02 | Substituir aliases `= any` em `mappers.ts:28-32` (5 raízes + 2 cascade automáticas) e `dashboardService.ts:3-5` (3 view aliases) por `Tables<T>` | Médio (4h) |
| L-9 | P3-T04 | Tipar 14 callbacks `(x: any)` em queries Supabase (9 arquivos) com `Tables<T>` ou `Pick<>` inline — ver tabela S3 de Phase 3 | Médio (4h) |
| L-14 | P5-T07 | Adicionar unit tests de schema Zod: `contatoSchema` (phone refine), `vendaSchema` (fiado → data obrigatória), `pagamentoSchema` (data não-futura UTC-3) | Baixo (1h) |

**Total L.2: ~9h**

---

#### L.3 — Consolidações DB + Decisões

*Executa por último: L-13 requer decisão humana; L-10 e L-16 são migrations simples.*

| Passo | ID(s) | Ação | Estimativa |
|---|---|---|---|
| L-10 | P2-DB06 | DROP 16 unused indexes via migration (`idx_scan = 0` em `pg_stat_user_indexes`) | Trivial (15min) |
| L-13 | P4-DC05 | ~~Decidir `ENABLE_GELADEIRA` + `ENABLE_RECOMPRA`~~ — decisão tomada 2026-05-19: opção (b) executada no Pré-Hardening D3 | **DONE** |
| L-15 | P2-DB03 | Ligar `auth_leaked_password_protection` no Supabase Dashboard (toggle — sem migration) | Trivial (15min) |
| L-16 | P2-DB01 | `ALTER FUNCTION public.prevent_delete_automatic_plan SET search_path TO 'public'` × 3 funções | Trivial (15min) |

**Total L.3: ~2h**

---

**Total Onda Limpeza (L.1 + L.2 + L.3): ~13.5h**

---

### Onda Reativação ou DROP — Decisão de feature

**Objetivo:** Fechar o estado "indefinido" das features parked. Cada feature precisa de veredicto binário.

| Feature | DB vivo? | IDs relacionados | Cenário A — Reativar | Est. A | Cenário B — DROP | Est. B |
|---|---|---|---|---|---|---|
| **Contas a Pagar** | Sim (tabelas + RPCs + view) | P4-DC01, P2-DB04, P3-T05, P5-T08-FIN | UI (_parked/ → src/) + 7 indexes (P2-DB04) + guards RPCs + testes (P5-T08-FIN) | Alto (1 dia) | `DROP TABLE pagamentos_conta_a_pagar, contas_a_pagar CASCADE; DROP VIEW view_contas_a_pagar_dashboard; DROP FUNCTION registrar_pagamento_conta_a_pagar, criar_obrigacao_parcelada;` + `rm -rf _parked/contas-a-pagar/` | Baixo (1h) |
| **Relacionamento/Kanban** | Sim (view + RPC + cols contatos) | P4-DC02 | UI + mover de _parked/ + corrigir AlertasRecompraWidget | Alto (1 dia) | `DROP VIEW view_relacionamento_kanban; DROP FUNCTION fn_mover_card_relacionamento;` + remover cols status_relacionamento (avaliar impacto) | Baixo (1h) |
| **Fluxo de Caixa / Plano de Contas** | Sim (tabelas ativas, cashFlowService usa) | — | cashFlowService já ativo para alertas — reativar UI de extrato/lançamentos | Médio (4h) | Sem DROP — tabelas compartilhadas com sistema ativo (lancamentos, contas) | N/A |
| **Entregas** | Não (sem DB exclusivo) | P4-DC03 | Criar DB + UI | Alto (1 dia) | `rm -rf _parked/entregas/` + remover LogisticsWidget (L-3 já cobre) | Trivial (15min) |
| **Relatorio Fabrica** | Não (sem DB exclusivo) | — | Recriar view/RPC + UI | Alto (1 dia) | `rm -rf _parked/relatorio-fabrica/` | Trivial (15min) |

**Total estimado por cenário:**
- Tudo DROP: ~3h (Contas a Pagar 1h + Relacionamento 1h + Entregas+Relatorio 30min)
- Tudo Reativar: ~3,5 dias

**Decisão recomendada por impacto/esforço:**
- **Contas a Pagar**: Decidir ANTES da Onda Hardening — se DROP, simplifica H-3 (já contemplado). Se Reativar, H-3 muda para "adicionar guard" em vez de DROP.
- **Relacionamento**: DB tem peso (view + RPC + cols); P4-DC02 é bug ativo independente da decisão.
- **Entregas + Relatorio Fabrica**: Custo de DROP irrisório; custo de manter indefinidamente acumula.

---

## 5. Resumo quantitativo

| | 🔴 | 🟡 | 🟢 | Total |
|---|:---:|:---:|:---:|:---:|
| Phase 1 | 0 | 2 | 8 | 10 |
| Phase 2 | 3 | 5 | 4 | 12 |
| Phase 3 | 1 | 4 | 5 | 10 |
| Phase 4 | 0 | 3 | 7 | 10 |
| Phase 5 | 4 | 7 | 2 | 13 |
| Phase 6 | 1 | 3 | 2 | 6 |
| **TOTAL** | **7** | **24** | **28** | **59** |

*(C2 e P3-T05 — 2 🔴 — fechados em H-3 2026-05-20)*

**Estimativas por onda:**
- Onda Hardening: H-3 ✅ (9 RPCs, 30/30 testes) · H-4 ✅ (subsumed) · restante: H-5 a H-9 (~11h)
- Onda Limpeza L.1: ~2.5h (patches + dead code óbvio)
- Onda Limpeza L.2: ~9h (type safety)
- Onda Limpeza L.3: ~2h (DB + decisões)
- Onda Reativação/DROP: ~3h tudo DROP / ~3,5 dias tudo reativar

**Acumulado por onda (IDs):**
- Onda Hardening: 7 🔴 restantes + 1 🟡 (P2-DB05) = 8 itens abertos
- Onda Limpeza: 16 itens 🟢/🟡
- Onda Reativação/DROP: 5 features para decidir

**Positivos notáveis (não são findings):**
- N+1: ZERO — services usam nested select + Promise.all() corretamente
- Bundle total: 0.65 MB gzip — abaixo de 1 MB
- Secrets em git/bundle: ZERO credenciais de produção
- DDL drift: ZERO — 26 views + 29 funções em prod cobertos por migrations
- RLS: 100% de tabelas com RLS habilitado (21/21) — achados são de granularidade, não de cobertura
- TypeScript: `tsc --noEmit` e `tsc -b + vite build` passam limpo
- RPCs param drift: ZERO — todos os 9 callers ativos correspondem à assinatura exata do DB
