# Phase 6 — PERFORMANCE & SEGURANÇA: Findings
**Data:** 2026-05-17
**Base:** commit `21280b1` (branch `main`)
**Projeto:** `herlvujykltxnwqmwmyx`
**Escopo:** D (credenciais) → A (DB performance) → F (advisors abertos) → C (deps) → B (bundle) → E (N+1)

---

## Header obrigatório

| Campo | Valor |
|---|---|
| **Severity unificado** | 🔴 = credencial prod em git/bundle, CVE Critical, middleware bypass em PROD; 🟡 = N+1 confirmada, bundle >200 KB chunk, FK sem índice cascade, dep HIGH+exploitável; 🟢 = qualidade (demo key, build-tool CVE, unused index) |
| **Ferramentas** | git pickaxe, MCP execute_sql, MCP get_advisors, pnpm audit, GZipStream PowerShell |
| **Logs raw** | `phase6/{secrets.log, db-indexes.log, advisors.log, deps.log, bundle.log, n1.log}` |
| **Referência Phase 2** | Todos findings abertos H3, H4, C2, P2-DB04..07 confirmados still_open — não re-detalhados, referenciados por ID |

---

## Ângulo D — Varredura de Credenciais (secrets.log)

### D.1 — Ferramentas

gitleaks: NOT FOUND. Fallback: git pickaxe manual (git log --all -S \<pattern\> --pickaxe-regex).

### D.2 — Resultados por padrão

| Padrão | Resultado |
|---|---|
| `eyJ...` (JWT) | 1 hit: commit 79249ded (2026-04-05) — test-utils.ts |
| `sk-...` (OpenAI/Stripe) | ✅ clean |
| `service.?role` | 8 hits — todos textuais (docs/config/migration) |
| `AKIA...` (AWS) | ✅ clean |
| `xoxb-...` (Slack) | ✅ clean |
| `ghp_...` (GitHub PAT) | ✅ clean |

---

**[P6-SEC01]** [🟢 MELHORIA] CREDENCIAIS — JWT local Docker hardcoded em test-utils.ts (iss=supabase-demo)

**Arquivo:** `packages/shared/src/test-utils.ts:5-6`
**Evidência:**
```typescript
const LOCAL_ANON_KEY = 'eyJ...demo-anon...'
const LOCAL_SERVICE_KEY = 'eyJ...demo-service_role...'
```
Payloads decodificados:
- LOCAL_ANON_KEY: `{"iss":"supabase-demo","role":"anon","exp":1983812996}`
- LOCAL_SERVICE_KEY: `{"iss":"supabase-demo","role":"service_role","exp":1983812996}`

**`iss: "supabase-demo"`** — chave padrão do Docker local Supabase, pública e documentada. NÃO funciona contra o projeto de produção `herlvujykltxnwqmwmyx`. Env vars sobrescrevem os fallbacks.

**Impacto:** Zero em produção. Mas o padrão ensina a futuros colaboradores que commitar JWTs é aceitável.

**Bundle D.3:** JWT encontrado no bundle = anon key público: `{"iss":"supabase","ref":"herlvujykltxnwqmwmyx","role":"anon"}` → ✅ EXPECTED.

**Fix:** Substituir JWTs hardcoded por `throw new Error('SUPABASE_URL env var required in tests')` sem fallback, ou documentar explicitamente que são demo keys não-válidas em produção.

---

## Ângulo A — Performance DB (db-indexes.log)

Todos os findings são STILL_OPEN de Phase 2. Zero novos findings de DB performance.

| ID Phase 2 | Achado | Status | Severidade |
|---|---|---|---|
| P2-DB04 | 7 FKs sem índice (contas_a_pagar × 3, pagamentos_conta_a_pagar × 4) | STILL_OPEN | 🟡 |
| P2-DB05 | 2 auth_rls_initplan (admin_users, interacoes) | STILL_OPEN | 🟡 |
| P2-DB06 | 16 unused indexes (Phase 2 undercounted 14) | STILL_OPEN | 🟢 |
| P2-DB07 | 18 multiple_permissive_policies (Phase 2 undercounted 17) | STILL_OPEN | 🟡 |

**Nota:** Contagens de P2-DB06 e P2-DB07 corrigidas para cima (14→16 e 17→18) — Phase 2 undercountou na listagem. Os índices e policies subjacentes são os mesmos.

---

## Ângulo F — Advisors abertos Phase 2 (advisors.log)

Confirmação ativa por query SQL para cada ID.

| ID | Achado | Evidência Phase 6 | Status |
|---|---|---|---|
| H3 | contatos.Authenticated update access (USING=true) | SQL: qual='true', with_check='true', roles='{authenticated}' | 🔴 STILL_OPEN |
| H4 | 11 security_definer views | advisor: 11 × security_definer_view ERROR | 🔴 STILL_OPEN |
| C2 | 6 RPCs financeiras UNGUARDED (authenticated CAN_EXECUTE SECDEF) | SQL: CAN_EXECUTE=true para criar_obrigacao_parcelada, registrar_despesa_manual, registrar_entrada_manual, registrar_pagamento_venda, update_purchase_order_with_items + advisor para registrar_pagamento_conta_a_pagar | 🔴 STILL_OPEN |
| C1 | products bucket (SELECT público) | advisor: public_bucket_allows_listing | ✅ RESIDUE ACEITO |
| P2-DB05 | auth_rls_initplan (admin_users, interacoes) | advisor: 2 × auth_rls_initplan WARN | 🟡 STILL_OPEN |
| P2-DB03 | auth_leaked_password_protection desligado | advisor: auth_leaked_password_protection WARN | 🟢 STILL_OPEN |

---

## Ângulo C — Dependências (deps.log)

### Vulnerabilidades críticas em produção

---

**[P6-DEP01]** [🔴 CRÍTICO] DEPS — `next@15.5.14` em catalogo — 4 HIGH middleware/proxy bypass CVEs (PROD)

**Arquivo:** `apps/catalogo/package.json`
**CVEs:**
- GHSA-26hh-7cqf-hhc6: Middleware bypass via segment-prefetch (fix incompleto do anterior) — fix ≥15.5.18
- GHSA-267c-6grr-h53f: Middleware bypass via segment-prefetch — fix ≥15.5.16
- GHSA-492v-c6pp-mqqv: Middleware bypass via dynamic route injection — fix ≥15.5.16
- GHSA-36qx-fr4f-26g5: Middleware bypass via i18n Pages Router — fix ≥15.5.16

**Exploitabilidade:** Alta se `apps/catalogo/middleware.ts` existir para proteção da rota `/admin` — bypass exporia admin a usuários não autenticados. Confirmar existência de middleware.ts (não verificado nesta fase de mapeamento).

**Adicionais:** 5 HIGH (SSRF, DoS × 4), 4 MODERATE (XSS × 2, DoS Image, cache poisoning), 2 LOW.

**Fix:** `pnpm --filter catalogo update next@^15.5.18` — fica dentro do minor 15.5.x.

---

**[P6-DEP02]** [🟡 IMPORTANTE] DEPS — `vite@7.3.1` — 3 HIGH CVEs em dev server

**Arquivo:** `apps/interno/package.json`
**CVEs:**
- GHSA-v2wj-q39q-566r: server.fs.deny bypass — fix ≥7.3.2
- GHSA-p9ff-h696-f583: Arbitrary file read via WebSocket — fix ≥7.3.2
- GHSA-4w7w-66w2-5vf9: Path traversal in .map handling (moderate) — fix ≥7.3.2

**Exploitabilidade:** Dev server apenas — não exploitável em produção (Vite não serve em prod). Risco limitado ao ambiente local do desenvolvedor.

**Fix:** `pnpm --filter interno update vite@^7.3.2` — patch trivial, mantém major 7.x.

---

**[P6-DEP03]** [🟡 IMPORTANTE] DEPS — `serialize-javascript@6.0.2` (transitive de vite-plugin-pwa) — HIGH RCE

**Path:** `vite-plugin-pwa@1.2.0 > workbox-build@7.4.0 > @rollup/plugin-terser@0.4.4 > serialize-javascript@6.0.2`
**CVEs:** GHSA-5c6j-r48x-rmvq (HIGH RCE), GHSA-qj8w-gfj5-8c6v (MODERATE DoS)

**Exploitabilidade:** Build tool — afeta apenas o processo de build, não o código enviado ao browser. Seria exploitável apenas com input de terceiros malicioso no processo de build (supply chain).

**Fix:** Aguardar `vite-plugin-pwa@>=1.3.x` que atualize workbox-build; ou monitorar quando @rollup/plugin-terser atualizar serialize-javascript.

---

**[P6-DEP04]** [🟢 MELHORIA] DEPS — Vários patches menores disponíveis

react@19.2.4→19.2.6, zod@4.3.6→4.4.3, @supabase/supabase-js@2.101.1→2.105.4, @tanstack/react-query@5.96.1→5.100.10, postcss, turbo, vitest, etc.

Nenhum CVE de produção. Atualização de manutenção na wave Limpeza.

---

## Ângulo B — Bundle (bundle.log)

---

**[P6-BUND01]** [🟡 IMPORTANTE] BUNDLE — Estoque3DView 340.8 KB gzip — excede threshold 200 KB

**Chunk:** `Estoque3DView-C9Zv8QyA.js` (1193.9 KB raw / 340.8 KB gzip)
**Conteúdo:** Three.js + @react-three/fiber + @react-three/drei (rota de visualização 3D do estoque)

**Contexto:** Este é o chunk lazy-loaded da rota 3D — carregado apenas quando o usuário navega para essa tela. Não é o EstoqueWidget (DCE'd por P4-DC05). Não é parked. É uma feature ativa.

**Thresholds Phase 6:**

| Threshold | Valor | Status |
|---|---|---|
| Initial chunk > 200 KB gzip | 340.8 KB | 🟡 |
| Total bundle > 1 MB gzip | 0.65 MB | ✅ |
| Total bundle > 2 MB gzip | 0.65 MB | ✅ |
| Parked feature chunk > 50 KB | 0 (nenhum parked) | ✅ |
| Main index chunk > 200 KB | 190.8 KB | ✅ |

**Fix:** Three.js é intrinsecamente pesado. Opção: separar drei/postprocessing em sub-chunks via dynamic import. Impacto prático baixo (lazy loading já mitiga — usuário só paga o custo ao acessar a rota 3D).

---

## Ângulo E — N+1 Queries (n1.log)

---

[✅ CLEAN] N+1 — Zero padrões N+1 encontrados

**Grep:** 0 matches de async forEach/map/filter em services + hooks (8 arquivos revisados).

**Padrão dominante:**
1. Supabase nested `.select('*, relacao:tabela(*)')` — equivalente a JOIN, 1 query
2. `Promise.all([query1, query2, query3])` — N paralelas (correto)

**False positives identificados:** Loops em dados in-memory (calculateKPIs, processAlertasFinanceiros) — sem DB calls.

**_parked:** Glob retornou 0 arquivos em `_parked/*.ts` — não existe diretório _parked em apps/interno.

---

## Resumo executivo (Phase 6)

### Por severidade

| Severidade | Qtd | IDs |
|---|---|---|
| 🔴 CRÍTICO | 1 | P6-DEP01 (next.js middleware bypass CVEs em PROD) |
| 🟡 IMPORTANTE | 3 | P6-DEP02 (vite HIGH CVEs dev), P6-DEP03 (serialize-javascript RCE build), P6-BUND01 (Estoque3DView 340 KB) |
| 🟢 MELHORIA | 2 | P6-SEC01 (demo JWT hardcoded), P6-DEP04 (patches menores) |

### Advisors Phase 2 confirmados still_open (F)

| ID | Severidade | Status |
|---|---|---|
| H3 (contatos UPDATE USING=true) | 🔴 | STILL_OPEN |
| H4 (11 SECDEF views) | 🔴 | STILL_OPEN |
| C2 (6 RPCs financeiras unguarded) | 🔴 | STILL_OPEN |
| P2-DB04 (7 FKs sem índice) | 🟡 | STILL_OPEN |
| P2-DB05 (2 auth_rls_initplan) | 🟡 | STILL_OPEN |
| P2-DB06 (16 unused indexes) | 🟢 | STILL_OPEN |
| P2-DB07 (18 permissive policies) | 🟡 | STILL_OPEN |

### Positivos notáveis

- **N+1: ZERO** — services usam nested select + Promise.all corretamente
- **Bundle: saudável** — total 0.65 MB gzip, main chunk <200 KB
- **Secrets: CLEAN** — sem credenciais de produção no git ou bundle
- **Advisors: estáveis** — zero novos advisors desde Phase 2

### Conclusão

Phase 6 identificou **1 achado 🔴 novo** (P6-DEP01 — next.js CVEs em prod), **3 achados 🟡** (vite, serialize-javascript, bundle 3D) e confirmou que todos os **7 achados Phase 2** permanecem abertos sem remediação aplicada. A performance de queries está clean. Os 🔴 acumulados são todos de segurança e requerem Onda Hardening.
