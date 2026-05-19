# Phase 2 — DATABASE: Findings
**Data:** 2026-05-17
**Base:** commit `21280b1` (branch `main`)
**Projeto Supabase:** `herlvujykltxnwqmwmyx`
**Comparação:** AUDIT.md de 2026-05-08 (commit `e286072`) — 5 achados originais de DB: C1, C2, H1, H3, H4

---

## Header obrigatório

| Campo | Valor |
|---|---|
| **Schemas inspecionados** | `public` (todas as tabelas, views, funções, policies) + `storage` (apenas para C1 e varredura de buckets) |
| **Schemas excluídos** | `auth.*`, `vault.*`, `realtime.*` (managed Supabase, fora do controle do projeto) |
| **MCP tools utilizados** | `get_advisors` (security + performance), `list_migrations`, `list_tables`, `execute_sql` |
| **Migrations folder confirmada** | Única: `supabase/migrations/` (12 .sql files). Glob duplo (`**/supabase/migrations/*.sql` + `**/migrations/**/*.sql`) retorna mesmos 12 resultados. Sem `apps/catalogo/supabase/migrations/`. |
| **Logs raw** | `apps/interno/reports/phase2/{advisors.log, migrations.log, rls.log, drift.log}` |
| **Severidade `search_path mutable`** | 🟢 sozinho; 🟡 em SECURITY DEFINER; 🔴 em SECURITY DEFINER chamável por anon/public (regra ajuste #3) |
| **Regra de IDs P2-DBxx** | Tudo do advisor + RLS 🔴/🟡 + DDL drift, **MENOS** os 5 itens C1/C2/H1/H3/H4 já reconciliados, ganha ID novo P2-DBxx. Status field marca KNOWN (match AUDIT.md M*) / NEW / STILL_OPEN (regra ajuste #5). |

---

## 1. Reconciliação Onda 1 (5 achados originais)

| ID | Achado original AUDIT.md | Status atual | Evidência | Resíduo |
|---|---|---|---|---|
| **C1** | Bucket `products` permite anon INSERT/UPDATE/DELETE | **🟢 RESOLVED** | `pg_policies` em `storage.objects` para products: 3 policies destrutivas (`Allow all inserts/updates/deletes`) ausentes; substituídas por `Admin insert/update/delete products bucket` com `qual = ((bucket_id = 'products') AND (SELECT is_admin()))` e role=authenticated. Migration: `20260515070000_restrict_products_bucket_policies.sql`. | 🟢 SELECT público amplo (`Allow public read access on products bucket`) — advisor `public_bucket_allows_listing`. Aceito pelo AUDIT.md C1 fix ("Manter apenas SELECT público"), mas o lint sinaliza que mesmo SELECT público permite list. Não é regressão — é o fim de C1 conforme escopo planejado. |
| **C2** | 21 RPCs SECURITY DEFINER executáveis por anon (incluindo registrar_pagamento_venda) | **🔴 PARTIAL** | Anon EXECUTE: apenas `criar_pedido` permanece (intentional — RPC do catálogo público). Advisor `anon_security_definer_function_executable` retorna 1, contra 21 originais. Migration: `20260515070200_restrict_rpc_execute_grants.sql`. Funções dropadas (Onda 1+2): fn_backfill_contatos_nome, rpc_total_a_receber_simples, rpt_churn, rpt_vendas_por_periodo. | 🔴 11 RPCs authenticated SECURITY DEFINER — classificação GUARDED/UNGUARDED (fechamento Phase 2): <br><br>**GUARDED (1):** `is_admin` — read-only helper, by design<br>**INTENCIONAL SEM GUARDA (1):** `criar_pedido` — RPC pública do catálogo, aceito<br>**UNGUARDED 🔴 financeiras (6):** `registrar_pagamento_venda`, `registrar_pagamento_conta_a_pagar`, `criar_obrigacao_parcelada`, `update_purchase_order_with_items`, `registrar_despesa_manual`, `registrar_entrada_manual` — critério: RPC que movimenta caixa, cria dívida ou edita PO. Qualquer login pode criar obrigações parceladas, editar orçamentos de compra, lançar despesas/receitas manuais ou quitar vendas/dívidas — sem is_admin() ou auth check<br>**UNGUARDED 🟡 mutação não-financeira (2):** `add_image_reference`, `delete_image_reference`<br>**UNGUARDED 🟡 information disclosure (1):** `rpc_total_a_receber_dashboard` — sem is_admin(), expõe total a receber + nº vendas abertas para qualquer login autenticado<br><br>AUDIT.md C2 fix recomendou `REVOKE FROM authenticated` + `is_admin()` no corpo — não feito. Elevação de 🟡→🔴: critério financeiro estendido — toda RPC que movimenta caixa, cria dívida ou edita PO é classificada como financeira (6/9 RPCs de mutação). |
| **H1** | Tabelas `_backup_contatos_nome_*` + `backfill_contatos_nome_log` + função `fn_backfill_contatos_nome()` sem RLS | **🟢 RESOLVED** | Query `pg_tables WHERE tablename LIKE '\_backup_contatos_nome%' OR tablename = 'backfill_contatos_nome_log'` retorna `null`. Query `pg_proc WHERE proname='fn_backfill_contatos_nome'` retorna `null`. Migration: `20260515070100_drop_backfill_contatos_artifacts.sql`. Confirmado também via Phase 1 (teste de integração falha com PGRST202). | Resíduo de H2 (migration de origem ainda recria tudo no `db reset`) — ver P2-DB07 abaixo. |
| **H3** | Policy `Authenticated update access` em `contatos` usa `USING(true)` | **🔴 STILL_OPEN** | `pg_policies WHERE tablename='contatos' AND policyname='Authenticated update access'` retorna `qual='true', with_check='true', roles={authenticated}`. Advisor `rls_policy_always_true` confirma. NENHUMA migration Onda 1 alterou esta policy. | Tudo. Sem RBAC client-side (M4) e sem RBAC server-side, qualquer login pode UPDATE em qualquer contato — telefone, endereço, status_relacionamento. |
| **H4** | 11 views SECURITY DEFINER bypassam RLS do consumidor | **🔴 STILL_OPEN** | Advisor `security_definer_view` retorna 11 views — match exato com lista do AUDIT.md H4. Query `pg_class WHERE relkind='v' AND reloptions IS NULL` confirma: ranking_compras, ranking_indicacoes, view_contas_a_pagar_dashboard, view_extrato_mensal, crm_view_operational_snapshot, vw_catalogo_produtos, view_relacionamento_kanban, view_fluxo_resumo, vw_admin_dashboard, rpt_projecao_pagamentos, vw_marketing_pedidos. 14 outras views (rpt_*, view_home_*, etc.) já têm `reloptions=['security_invoker=true']`. | Tudo. Nenhuma migration Onda 1 endereçou esse achado. As 14 views novas (Onda 2 scope) foram criadas com `security_invoker=on`, mas as 11 antigas não foram migradas. |

### Resumo da reconciliação

- 🟢 RESOLVED: 2 (C1, H1)
- 🔴 PARTIAL: 1 (C2 — anon resolved, mas 9/11 RPCs authenticated UNGUARDED sendo 6 financeiras críticas)
- 🔴 STILL_OPEN: 2 (H3, H4)

Onda 1 atacou os achados **mais críticos** (C1 + parte de C2 + H1 — todos com risco anon ou PII vazada). C2 elevado de 🟡→🔴 após classificação GUARDED/UNGUARDED dos 11 RPCs authenticated: 6 RPCs financeiras (caixa, dívidas, POs) + 2 mutações não-financeiras (imagens) + 1 information disclosure, todas sem is_admin() ou auth check — qualquer usuário autenticado pode manipular registros financeiros diretamente via PostgREST.

### Definição das Ondas de remediação

| Onda | Migrations (em ordem de apply) | Achados AUDIT.md endereçados | Tipo |
|---|---|---|---|
| **Onda 1** | `20260515070000_restrict_products_bucket_policies.sql`<br>`20260515070100_drop_backfill_contatos_artifacts.sql`<br>`20260515070200_restrict_rpc_execute_grants.sql` | C1 (RESOLVED), H1 (RESOLVED), C2 (PARTIAL — lado anon) | Bloco planejado — commit `663492d` (2026-05-09, renomeado para 15 em `96d1fe8`) |
| **Onda 2** | `20260515060529_align_contas_rls_with_siblings.sql`<br>`20260516070000_drop_orphan_rpcs.sql` | Nenhum achado AUDIT.md original — escopo incremental fora do baseline | Limpeza incremental — 2 commits independentes: `87e3008` (2026-05-15) + `7d2be75` (2026-05-16) |

**Onda 2 não foi um bloco planejado.** É o rótulo dado a 2 commits de manutenção independentes aplicados após Onda 1:
- `align_contas_rls_with_siblings` — corrigiu ausência de policy de leitura autenticada em `contas` (tabela ficou sem `SELECT for authenticated` — detectado no pós-Onda 1)
- `drop_orphan_rpcs` — removeu `rpc_total_a_receber_simples`, `rpt_churn`, `rpt_vendas_por_periodo`: RPCs sem referência no frontend, resíduo do schema original

O vocabulário **"Onda 1+2"** neste documento significa a união das 5 migrations de remediação aplicadas entre 2026-05-15 e 2026-05-16. Qualquer referência à "Onda 2 scope" em achados de views/policies refere-se a objetos criados nessa janela, não a um bloco de segurança coordenado.

---

## 2. Findings novos Phase 2 (IDs P2-DBxx)

Aplicando a regra do header: itens do advisor + RLS 🔴/🟡 + DDL drift que NÃO mapeiam para C1/C2/H1/H3/H4.

### Categoria SECURITY

---

**[P2-DB01]** [🟢 MELHORIA] `function_search_path_mutable` em 3 funções

**Status:** KNOWN — match AUDIT.md M2.
**Severidade aplicada:** 🟢 (regra ajuste #3): nenhuma das 3 é SECURITY DEFINER.
**Evidência:**
```
public.prevent_delete_automatic_plan   prosecdef=false   anon_exec=true
public.fn_count_words                  prosecdef=false   anon_exec=true
public.fn_capitalize_name              prosecdef=false   anon_exec=true
```
**Fix:** `ALTER FUNCTION public.X SET search_path TO 'public'` para cada uma (3 linhas de SQL).

---

**[P2-DB02]** [🟡 IMPORTANTE] `rls_policy_always_true` em 3 policies `Public insert` (sem rate-limit)

**Status:** KNOWN — match AUDIT.md M1.
**Tabelas:** `public.contatos.Public insert access`, `public.cat_pedidos.Public insert orders`, `public.cat_itens_pedido.Public insert items`
**Evidência:** Todas com `cmd=INSERT, qual=null, with_check=true, roles={-}` (public). Necessárias para fluxo do catálogo público anônimo.
**Fix:** Deixar as policies (negócio depende); adicionar rate limit upstream (Edge Function / Cloudflare) ou validação de payload no `with_check` (ex.: `with_check = (length(nome) > 2 AND telefone ~ '^\\d{10,13}$')`).

---

**[P2-DB03]** [🟢 MELHORIA] `auth_leaked_password_protection` desligado no Supabase Auth

**Status:** KNOWN — match AUDIT.md M3.
**Evidência:** Advisor `auth_leaked_password_protection` WARN. Config do projeto Supabase.
**Fix:** Dashboard Supabase > Authentication > Settings > Password protection (toggle ON). Sem migration.

---

### Categoria PERFORMANCE (contagem + categorias agora; detalhe Phase 6 conforme ajuste #2)

---

**[P2-DB04]** [🟡 IMPORTANTE] `unindexed_foreign_keys` — 7 FKs sem índice de cobertura

**Status:** NEW (não documentado no AUDIT.md original).
**Tabelas/FKs afetadas:**
- `contas_a_pagar`: 3 FKs (`created_by`, `plano_conta_id`, `updated_by`)
- `pagamentos_conta_a_pagar`: 4 FKs (`conta_a_pagar_id`, `conta_id`, `created_by`, `updated_by`)
**Evidência:** Advisor `unindexed_foreign_keys` INFO × 7.
**Fix:** Phase 6 vai detalhar. Resumo: criar `CREATE INDEX ON tabela (fk_column)` para cada uma. Cuidado com `pagamentos_conta_a_pagar.conta_a_pagar_id` que é o caminho de DELETE-cascade — esse precisa de índice mesmo em volumes baixos.

---

**[P2-DB05]** [🟡 IMPORTANTE] `auth_rls_initplan` — 2 policies com `auth.uid()` RAW (bonus do ajuste)

**Status:** NEW (não documentado no AUDIT.md). Também atende ao **bonus opcional** do escopo.
**Policies afetadas:**
- `public.admin_users.Admin full access on admin_users` — qual contém `auth.uid()` RAW (não `(SELECT auth.uid())`)
- `public.interacoes.Authenticated insert own interacoes` — with_check contém `auth.uid()` RAW

**Evidência (query `qual ~* 'auth\\.'` filtrada):**
```
admin_users.Admin full access on admin_users
  qual:  (EXISTS (SELECT 1 FROM admin_users a WHERE ((a.user_id = auth.uid()) AND (a.role = ANY (ARRAY['admin','super_admin'])))))
  pattern: RAW

interacoes.Authenticated insert own interacoes
  with_check: ((criado_por = auth.uid()) OR (criado_por IS NULL))
  pattern: RAW
```
Todas as outras policies com `auth.uid()` já usam `(SELECT auth.uid())` wrapped (advisor não as flag).
**Fix:** trocar `auth.uid()` por `(SELECT auth.uid())` em 2 lugares. Migration trivial (~5 linhas). Per-row → per-query subplan evaluation.

---

**[P2-DB06]** [🟢 MELHORIA] `unused_index` — 14 índices nunca consultados

**Status:** NEW (não documentado).
**Detalhe → Phase 6.**
**Tabelas afetadas:** produtos (×2: categoria, destaque), cat_pedidos (status), cat_itens_pedido (produto), purchase_orders (fornecedor_id), purchase_order_payments (conta_id), lancamentos (×2: conta_id, created_by, updated_by — total 3), purchase_order_items (purchase_order_id), contas (×2: created_by, updated_by), contatos (×2: created_by, updated_by), vendas (created_by), interacoes (criado_por).
**Fix:** Phase 6 vai detalhar política de drop. Sem urgência — apenas espaço em disco.

---

**[P2-DB07]** [🟡 IMPORTANTE] `multiple_permissive_policies` — 17 sobreposições admin+authenticated

**Status:** NEW (não documentado explicitamente, mas é consequência do padrão "Admin full access" + "Authenticated read access" que aparece nas policies de quase todas as tabelas).
**Detalhe → Phase 6.**
**Padrão dominante:** `("Admin full access" ALL to authenticated)` + `("Authenticated read access" SELECT to authenticated)` — em SELECT ambas são avaliadas em paralelo.
**Tabelas afetadas (resumo):** admin_users (1), cat_imagens_produto (1), cat_itens_pedido (1), cat_pedidos (1), configuracoes (1), contas (1), contatos (3 — INSERT+SELECT+UPDATE), interacoes (2), itens_venda (1), lancamentos (1), pagamentos_venda (1), plano_de_contas (1), produtos (1), sis_imagens_produto (1), vendas (1).
**Fix:** Phase 6 vai detalhar consolidação. Pattern recomendado: substituir as duas por uma única policy `FOR ALL` com qual `(SELECT is_admin()) OR <regra do read access>`.

---

### Categoria DDL DRIFT

**Verificação sistemática completa (fechamento Phase 2):**

- **(a) Views:** 26 em prod, 26 cobertas — 25 em `remote_schema.sql` (quoted identifiers) + `view_relacionamento_kanban` em `crm_kanban_schema.sql` (lowercase). **ZERO drift.**
- **(a) Funções:** 29 em prod, 29 cobertas — 29 em `remote_schema.sql` (3 delas DROPadas depois pela Onda 2, ausência em prod correta) + 4 REPLACE em migrations posteriores + `fn_mover_card_relacionamento` em `20260429002336`. **ZERO drift.**
- **(c) Signature drift (5 RPCs verificadas):** `fn_sync_cat_pedido_to_venda`, `registrar_pagamento_venda`, `criar_obrigacao_parcelada`, `update_purchase_order_with_items`, `criar_pedido` — todas com args/return/prosecdef idênticos entre prod e última migration que as define. **ZERO signature drift.**

---

**[P2-DB08]** [🟡 IMPORTANTE] Migration `20260423224225` não-idempotente, gera tabelas órfãs a cada `db reset`

**Status:** KNOWN — match AUDIT.md H2. STILL_OPEN (não remediado pela Onda 1).
**Evidência (drift.log seção b):**
```
20260423224225_backfill_contatos_nome.sql:
  L23: snapshot_name := '_backup_contatos_nome_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS')
  L33: EXECUTE format('CREATE TABLE %I AS SELECT id, nome AS nome_antes, ... FROM contatos', snapshot_name)
  L69: SELECT public.fn_backfill_contatos_nome()  ← executa no apply

20260515070100_drop_backfill_contatos_artifacts.sql:
  L42: DROP TABLE IF EXISTS public._backup_contatos_nome_20260424_121318  ← TIMESTAMP HARDCODED da execução original em prod
  L43: DROP TABLE IF EXISTS public.backfill_contatos_nome_log
  L44: DROP FUNCTION IF EXISTS public.fn_backfill_contatos_nome()
```
**Efeito em reapply:** `db reset` → step 1 cria a tabela com timestamp NOVO (não hardcoded) e executa a função → step 2 dropa apenas o hardcoded `_backup_contatos_nome_20260424_121318` (que não existe) e a função/log. Resultado: cada reset deixa um `_backup_contatos_nome_<NEW_TS>` órfão com PII (id+nome+telefone de contatos).
**Em prod hoje:** sem impacto (apply único histórico, executado uma vez antes do drop).
**Fix:** ou (a) reescrever migration 20260423224225 para não executar no apply (remover L69, fazer backfill manualmente via SQL ad-hoc registrado), ou (b) marcar a migration 20260423224225 como "skip on apply" via `--squashed/baselined` no histórico Supabase, ou (c) tornar o drop migration "drop all matching" via `DO $$ FOR r IN SELECT tablename FROM pg_tables WHERE tablename LIKE '\_backup_contatos_nome%' LOOP EXECUTE format('DROP TABLE %I', r.tablename) ...`.

---

## 3. RLS Coverage Table

**Resumo:** 21 tabelas em public, **TODAS** com `rls_enabled=true`. Zero tabelas com `policy_count=0`.

**Destacados (🔴/🟡 no topo):** Nenhum 🔴 (todas têm RLS ON + pelo menos 1 policy). 🟡 abaixo são "soft" — RLS habilitado mas com policy permissiva demais.

| tablename | rls_enabled | policy_count | flag | policy_summary |
|---|:---:|:---:|---|---|
| contatos | ✅ | 4 | 🟡 H3 + M1 | `Authenticated update access [UPDATE→true]` (H3 STILL_OPEN); `Public insert access [INSERT→true]` (M1) |
| cat_itens_pedido | ✅ | 2 | 🟡 M1 | `Public insert items [INSERT→true]` |
| cat_pedidos | ✅ | 2 | 🟡 M1 | `Public insert orders [INSERT→true]` |
| admin_users | ✅ | 2 | 🟡 P2-DB05 | `Admin full access` com `auth.uid()` RAW (perf init plan) |
| interacoes | ✅ | 3 | 🟡 P2-DB05 | `Authenticated insert own` com `auth.uid()` RAW |
| contas_a_pagar | ✅ | 1 | 🟢 | `Admin manage [ALL→public]` mas `qual=(SELECT is_admin())` — funcionalmente safe; cosmético: role=public em vez de authenticated |
| pagamentos_conta_a_pagar | ✅ | 1 | 🟢 | mesmo padrão de contas_a_pagar |
| cat_imagens_produto | ✅ | 2 | — | Admin manage + Public read images |
| cat_pedidos_pendentes_vinculacao | ✅ | 1 | — | Admin only |
| configuracoes | ✅ | 2 | — | Admin + Authenticated read |
| contas | ✅ | 2 | — | Admin + Authenticated read |
| itens_venda | ✅ | 2 | — | Admin + Authenticated read |
| lancamentos | ✅ | 2 | — | Admin + Authenticated read |
| pagamentos_venda | ✅ | 2 | — | Admin + Authenticated read |
| plano_de_contas | ✅ | 2 | — | Admin + Authenticated read |
| produtos | ✅ | 2 | — | Admin + Public read |
| purchase_order_items | ✅ | 1 | — | Admin only |
| purchase_order_payments | ✅ | 1 | — | Admin only |
| purchase_orders | ✅ | 1 | — | Admin only |
| sis_imagens_produto | ✅ | 3 | — | Admin + Authenticated read + Anon read |
| vendas | ✅ | 2 | — | Admin + Authenticated read |

**Nenhuma tabela 🔴.** Os 🟡 já estão capturados em H3, M1 (P2-DB02) e P2-DB05 — sem achado novo derivado puramente da varredura RLS.

---

## 4. Bonus opcional: `auth.uid()` RAW vs `(SELECT auth.uid())`

Já capturado em **P2-DB05** acima (2 ocorrências). Sem ocorrências adicionais em policies fora do scope public/storage.

---

## 5. Storage buckets (varredura ampliada — ajuste #1)

| Bucket | public | object_count | Policies | Achado |
|---|:---:|:---:|---|---|
| `products` | true | 12 | 4 (3 admin-only write + 1 public read) | Capturado em **C1 RESOLVED** + resíduo public_bucket_allows_listing |

**Resultado:** apenas 1 bucket existe. Sem buckets adicionais para flag. A ampliação do escopo não produziu achado novo.

---

## Resumo executivo (Phase 2)

### Por severidade

| | Phase 2 only | Cumulativo (Phases 1+2) |
|---|:---:|:---:|
| 🔴 CRÍTICO | 3 (C2 PARTIAL 🔴 elevado, H3, H4 — 2 STILL_OPEN + 1 PARTIAL) | 3 |
| 🟡 IMPORTANTE | 5 (P2-DB02, P2-DB04, P2-DB05, P2-DB07, P2-DB08) + 2 IMPORTANTE da Phase 1 | 7 |
| 🟢 MELHORIA | 3 (C1 resíduo, P2-DB01, P2-DB03, P2-DB06) + 9 MELHORIA da Phase 1 | 12 |

### Por status

| Status | Phase 2 |
|---|:---:|
| RESOLVED (Onda 1) | 2 (C1, H1) |
| PARTIAL | 1 (C2) |
| STILL_OPEN | 2 (H3, H4) |
| KNOWN (mapped to AUDIT.md M*/H2) | 4 (P2-DB01, P2-DB02, P2-DB03, P2-DB08) |
| NEW | 4 (P2-DB04, P2-DB05, P2-DB06, P2-DB07) |

### Maiores surpresas vs AUDIT.md

1. **Onda 1 fez o trabalho prometido:** C1 e H1 fechados, C2 fechado no lado anon. Sem regressão.
2. **C2 eleva para 🔴 PARTIAL:** classificação GUARDED/UNGUARDED revelou que 6/9 RPCs de mutação authenticated são financeiras UNGUARDED — `registrar_pagamento_venda`, `registrar_pagamento_conta_a_pagar`, `criar_obrigacao_parcelada`, `update_purchase_order_with_items`, `registrar_despesa_manual`, `registrar_entrada_manual`. Critério financeiro: toda RPC que movimenta caixa, cria dívida ou edita PO. `rpc_total_a_receber_dashboard` adicionalmente expõe agregados financeiros (🟡 information disclosure). Qualquer usuário autenticado pode manipular registros financeiros diretamente via PostgREST sem controle server-side.
3. **Nenhum NEW de severidade alta além do C2:** os 4 NEW são todos de performance (unindexed FKs, auth_rls_initplan, unused_index, multiple_permissive_policies). Phase 6 vai aprofundar.
4. **H3 + H4 permanecem abertos** — privilege escalation authenticated.
5. **Zumbi confirmado em migration 20260423224225** (AUDIT.md H2): cada `db reset` em dev/CI gera uma tabela `_backup_contatos_nome_<TS>` órfã com PII. Em prod sem impacto, mas pattern problemático.
6. **Zero tabelas com RLS desabilitado em public.** A cobertura RLS está completa. Os achados RLS são todos sobre granularidade de policies, não cobertura.
7. **ZERO drift DDL** (verificação sistemática completa): 26 views e 29 funções em prod — todas com migration de origem. 5 RPCs verificadas com zero signature drift. As únicas ausências em prod são funções corretamente DROPadas por migrations.

### Próxima fase

**Phase 3 — TIPOS & CONSISTÊNCIA** (mapeamento database.ts ↔ DomainTypes, mappers, snake/camel inconsistencies como AUDIT.md H5).

### Ação imediata recomendada (acumular para onda final)

Nenhuma. Conforme acordo, todos os findings são acumulados para ataque em ondas após Phase 6.
