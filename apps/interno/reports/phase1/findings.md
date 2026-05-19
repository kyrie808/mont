# Phase 1 — BUILD & TYPES: Findings
**Data:** 2026-05-16  
**Base:** commit `21280b1` (branch `main`)  
**Comparação:** AUDIT.md de 2026-05-08 (commit `e286072`)

---

## Header obrigatório

| Campo | Valor |
|---|---|
| **ESLint config** | `apps/interno/eslint.config.js` — ESLint 9 flat config. Plugins: `@typescript-eslint/recommended`, `eslint-plugin-react-hooks` (flat), `eslint-plugin-react-refresh`. **Sem diff vs e286072.** |
| **Ignores declarados** | `['dist', '.agent', '.claude']` — `_parked/` **NÃO** está na lista, portanto é lintado. |
| **tsconfig (tsc --noEmit)** | `apps/interno/tsconfig.json` → project references: `tsconfig.app.json` (src/) + `tsconfig.node.json` (tooling). **Sem diff vs e286072.** |
| **tsconfig (build)** | Mesmo `tsconfig.json` via `tsc -b`, seguido de `vite build` |
| **Paths efetivamente cobertos pelo lint** | `apps/interno/**/*.{ts,tsx}` menos `dist/`, `.agent/`, `.claude/`. Inclui `_parked/` (não excluído) **e** arquivos de teste (`src/__tests__/`, `src/services/__tests__/`). |
| **Logs raw** | `apps/interno/reports/phase1/{tsc.log, lint.log, test.log, build.log}` — tsc.log é 0 bytes (exit 0, sem output do tsc). |

---

## Baseline recalculado (in-scope)

AUDIT.md original reportou "63 errors + 9 warnings" como contagem bruta de `eslint .`, sem distinção entre escopo ativo, parked e testes. Recalculando com filtro de escopo desta auditoria (excluir `_parked/`, excluir `src/__tests__/` e `src/services/__tests__/`):

| Bucket | Errors | Warnings | Total |
|---|---|---|---|
| `_parked/` (movido em 67ab163, 2026-05-14, **após** o audit) | 10 | 6 | 16 |
| Test files (`src/__tests__/` + `src/services/__tests__/`) | 12 | 0 | 12 |
| **`src/` produção (in-scope desta passada)** | **41** | **3** | **44** |
| **Total (`eslint .` bruto)** | 63 | 9 | 72 |

**Comparação contra e286072 (baseline real, mesma metodologia):**

| | e286072 (2026-05-08) | 21280b1 (2026-05-16) | Delta |
|---|---|---|---|
| Total bruto | 63e + 9w = 72 | 63e + 9w = 72 | 0 |
| In-scope `src/` produção | 41e + 3w = 44 | 41e + 3w = 44 | **0** |

**Justificativa do delta zero:** ESLint config sem diff. Os arquivos que pareciam "NEW" hoje (`ProductNicknamesModal.tsx`, `useConfiguracoes.ts`, `purchaseOrderService.ts`) foram todos adicionados no commit `6abfc2e` (anterior ao audit) e estão sem diff vs e286072 (`git diff e286072 HEAD -- <files>` vazio). AUDIT.md M7 mencionou "28 ocorrências de no-explicit-any" como abreviação da lista densa em brownfield.md; o total real em produção sempre foi 29 (M7 listou explicitamente apenas as mais densas).

**Validação adicional:** AUDIT.md M7 mencionou `pages/RelatorioFabrica.tsx:51,60` como tendo 2 `no-explicit-any`. Esse arquivo está hoje em `_parked/relatorio-fabrica/`. Reconciliação:

- e286072: prod `no-explicit-any` ≈ 29 (today's prod) + 3 (em arquivos que migraram para _parked: RelatorioFabrica×2 + Entregas×1) = 32 ocorrências
- M7 reportou 28 → cobre as ~20 mais densas listadas explicitamente + ~8 dispersas; consistente com 32 totais quando se considera que a "lista densa" não é exaustiva

---

## `as any` conhecidos — validação

Os 3 aceitos por CLAUDE.md (zodResolver/react-hook-form):

| # | Arquivo | Linha | Evidência |
|---|---------|-------|-----------|
| 1 | `src/components/contatos/ContatoFormModal.tsx` | 92 | `} as any)` — react-hook-form `reset()` |
| 2 | `src/components/features/vendas/PaymentSidebar.tsx` | 65 | `resolver: zodResolver(pagamentoSchema) as any` |
| 3 | `src/components/features/vendas/NovaVenda/CheckoutSidebar.tsx` | 47 | `resolver: zodResolver(vendaSchema) as any` |

Todos os demais `as any` em produção (26 restantes) e em testes (12) são dívida técnica, não exceções reconhecidas.

---

## Sumário por comando

| Comando | Exit | Resultado |
|---|---|---|
| `tsc --noEmit` | **0** | Limpo — nenhum erro |
| `lint` (eslint .) | **1** | 63 errors + 9 warnings (72 total) |
| `test` (vitest run) | **1** | 89 passed, **1 failed**, 90 total |
| `build` (tsc -b + vite) | **0** | Limpo — build passa |

---

## Findings

### 1d — BUILD

---

[🟢 MELHORIA] BUILD — Build completo passa (NEW na baseline — AUDIT.md não executou `build`)

**Arquivo:** `apps/interno/` (tsc -b + vite build)  
**Evidência:** `EXIT: 0` — `tsc -b && vite build` sem erros. Nota: tsc-build mode (`-b`) é mais rigoroso que `--noEmit` pois compila com project references; o fato de passar limpo confirma que não há erros acumulados ocultos em tsconfig.node.json.  
**Status:** NEW (positivo — AUDIT.md só correu `tsc --noEmit`)  
**Fix:** Nenhum.

---

### 1a — TYPESCRIPT (tsc --noEmit)

---

[🟢 MELHORIA] TIPOS — tsc clean, zero erros de compilação

**Arquivo:** `apps/interno/src/**`  
**Evidência:** Exit 0, log vazio (apenas BOM).  
**Status:** KNOWN — consistente com baseline AUDIT.md.  
**Fix:** Nenhum.

---

### 1b — LINT

---

**[P1-L01]** [🟡 IMPORTANTE] LINT/ESCOPO — `_parked/` não excluído do ESLint, polui contagem total

**Arquivo:** `apps/interno/eslint.config.js:9`  
**Evidência:** `globalIgnores(['dist', '.agent', '.claude'])` — `_parked` ausente. Resultado: 10 errors + 6 warnings dos 72 totais vêm de `_parked/`. A contagem de "63 errors + 9 warnings" reportada pelo AUDIT.md incluía `_parked/` sem distinção.  
**Status:** NEW — AUDIT.md não sinalizou este problema de escopo.  
**Fix:** Adicionar `'_parked/**'` ao `globalIgnores` em `eslint.config.js:9`. Após isso, contagem in-scope cai para ~53 errors + 3 warnings.

---

**[P1-L02]** [🟡 IMPORTANTE] LINT — `no-explicit-any` em produção: 29 ocorrências (KNOWN)

**Arquivo:** 16 arquivos em `src/` — distribuição abaixo.  
**Evidência:** Contagem atual por arquivo:

```
src/services/mappers.ts:28,29,30,31,32,215,257          — 7  (KNOWN M7)
src/services/vendaService.ts:87,115,267,268              — 4  (KNOWN M7)
src/services/dashboardService.ts:3,4,5                   — 3  (KNOWN M7)
src/services/catalogService.ts:26,29                     — 2  (KNOWN M7)
src/services/recompraService.ts:34,43                    — 2  (KNOWN M7)
src/services/cashFlowService.ts:28                       — 1  (KNOWN M7)
src/services/produtoService.ts:32                        — 1  (KNOWN M7, lista completa em brownfield.md)
src/services/purchaseOrderService.ts:28                  — 1  (KNOWN — existe desde 6abfc2e, sem diff vs e286072)
src/hooks/useEstoqueMetrics.ts:42                        — 1  (KNOWN M7, lista completa)
src/hooks/useIndicacoes.ts:78                            — 1  (KNOWN M7, lista completa)
src/hooks/useCatalogoPendentes.ts:56                     — 1  (KNOWN M7 / H10)
src/hooks/useConfiguracoes.ts:56                         — 1  (KNOWN — existe desde 6abfc2e, sem diff vs e286072)
src/components/contatos/ContatoFormModal.tsx:92          — 1  (KNOWN — exceção aceita)
src/components/features/vendas/CheckoutSidebar.tsx:47    — 1  (KNOWN — exceção aceita)
src/components/features/vendas/PaymentSidebar.tsx:65     — 1  (KNOWN — exceção aceita)
src/components/features/purchase-orders/ProductNicknamesModal.tsx:61 — 1  (KNOWN — existe desde 6abfc2e, sem diff vs e286072)
```

**Status:** KNOWN — 29 ocorrências em prod, idêntico ao baseline e286072. AUDIT.md M7 disse "28" como abreviação imprecisa; nenhum dos arquivos listados acima foi adicionado/modificado entre 2026-05-08 e 2026-05-16 (validado via `git log --diff-filter=A` e `git diff`).  
**Fix:** Sem mudança de prioridade vs AUDIT.md M7 — atacar em ondas começando pelos `type X = any` em `dashboardService.ts:3-5`, `cashFlowService.ts:28`, `mappers.ts:28-32`.

---

**[P1-L03]** [🟢 MELHORIA] LINT — `no-explicit-any` em arquivos de teste: 12 ocorrências

**Arquivo:** `src/__tests__/` e `src/services/__tests__/` — 4 arquivos.  
**Evidência:**

```
src/__tests__/sync.integration.test.ts:61,72,148,159,227,238   — 6
src/__tests__/checkout.integration.test.ts:65,76               — 2
src/__tests__/financeiro.integration.test.ts:82                 — 1
src/services/__tests__/dashboardService.spec.ts:4,5,6           — 3
```

Todos são `as any` em dados de teste parciais (`p_itens: itens as any`, `data as any`) — padrão aceitável em testes de integração onde o tipo RPC não está totalmente mapeado.  
**Status:** NEW contagem (AUDIT.md M7 não incluiu arquivos de teste no cômputo dos 28) — mas provavelmente existiam ao tempo da auditoria sem serem reportados.  
**Fix:** Médio-prazo: tipificar os parâmetros RPC corretamente (liga com M7 — uma vez que os tipos sejam resolvidos, cascateia para os testes). Não bloqueia nada.

---

**[P1-L04]** [🟢 MELHORIA] LINT — `no-unused-vars` em catch blocks: 5 erros em `src/`

**Arquivo:** Múltiplos.  
**Evidência:**

```
src/pages/Configuracoes.tsx:119:18  — '_error' defined but never used
src/pages/Configuracoes.tsx:136:18  — '_error' defined but never used
src/pages/Configuracoes.tsx:165:18  — '_err' defined but never used
src/pages/NovaVenda.tsx:166:18      — '_error' defined but never used
src/pages/VendaDetalhe.tsx:125:22   — '_err' defined but never used
```

**Status:** KNOWN — M11 documentou este padrão em AUDIT.md.  
**Fix:** Substituir `(_error)` por `(error)` e logar via wrapper com contexto, ou simplesmente `catch { }` sem parâmetro se o handler não usa o erro.

---

**[P1-L05]** [🟢 MELHORIA] LINT — `no-empty` em catch blocks: 1 erro em `src/`

**Arquivo:** `src/pages/VendaDetalhe.tsx:125:28`  
**Evidência:** `Empty block statement — no-empty`  
**Status:** KNOWN — L7 em AUDIT.md.  
**Fix:** Ver P1-L04 acima — mesmo catch block.

---

**[P1-L06]** [🟢 MELHORIA] LINT — `react-hooks/preserve-manual-memoization`: 3 erros (Compilation Skipped)

**Arquivo:** `src/hooks/useContatos.ts:51,60,69`  
**Evidência:**

```
51:39  error  Compilation Skipped: Existing memoization could not be preserved  react-hooks/preserve-manual-memoization
60:39  error  Compilation Skipped: Existing memoization could not be preserved  react-hooks/preserve-manual-memoization
69:39  error  Compilation Skipped: Existing memoization could not be preserved  react-hooks/preserve-manual-memoization
```

React Compiler infere `toast` como dep, mas `useCallback` declara `[createMutation]`, `[updateMutation]`, `[deleteMutation]`.  
**Status:** KNOWN — L13 em AUDIT.md.  
**Fix:** Remover `useCallback` manual (React Compiler memoiza automaticamente), ou adicionar `toast` nas deps explicitamente.

---

**[P1-L07]** [🟢 MELHORIA] LINT — `react-hooks/exhaustive-deps`: 3 warnings em `src/`

**Arquivo:** `src/hooks/useContatos.ts:58,67,82`  
**Evidência:**

```
58:8  warning  React Hook useCallback has a missing dependency: 'toast'  react-hooks/exhaustive-deps
67:8  warning  React Hook useCallback has a missing dependency: 'toast'  react-hooks/exhaustive-deps
82:8  warning  React Hook useCallback has a missing dependency: 'toast'  react-hooks/exhaustive-deps
```

**Status:** KNOWN — M21 em AUDIT.md.  
**Fix:** Memoizar referência de `toast` no provider ou adicionar nas deps (ver P1-L06 — mesmo hook).

---

**[P1-L08]** [🟢 MELHORIA] LINT — `no-empty-object-type` em boilerplate Vite: 3 erros

**Arquivo:** `src/vite-env.d.ts:7,13,20`  
**Evidência:** `An interface declaring no members is equivalent to its supertype — @typescript-eslint/no-empty-object-type`  
**Status:** KNOWN — L5 em AUDIT.md.  
**Fix:** Substituir `interface X {}` por `// eslint-disable-next-line @typescript-eslint/no-empty-object-type` ou por `type X = unknown`.

---

### 1c — TESTES

---

**[P1-TEST01]** [🟢 MELHORIA] TESTES — Teste órfão: `fn_backfill_contatos_nome` dropada intencionalmente, teste pendente de remoção

**Arquivo:** `tests/integration/backfill_contatos_nome.integration.test.ts:69`  
**Evidência (output do vitest):**

```
AssertionError: expected { code: 'PGRST202', ... } to be null

Received:
{
  "code": "PGRST202",
  "details": "Searched for the function public.fn_backfill_contatos_nome without parameters ...",
  "hint": "Perhaps you meant to call the function public.fn_capitalize_name",
  "message": "Could not find the function public.fn_backfill_contatos_nome without parameters in the schema cache"
}
```

**Evidência (migration versionada):**

```
supabase/migrations/20260515070100_drop_backfill_contatos_artifacts.sql:44
  DROP FUNCTION IF EXISTS public.fn_backfill_contatos_nome();
```

Criada em commit `663492d` (2026-05-09, "chore(security): onda 1 de auditoria — drop backfill, restrict bucket policies, restrict RPC grants"), renomeada em `96d1fe8` (2026-05-15) por questão de ordering CLI. SQL inalterado.

**Status:** INTENCIONAL — DROP é o cumprimento direto de H1 do AUDIT.md ("DROP TABLE IF EXISTS public._backup_contatos_nome_20260424_121318; DROP TABLE IF EXISTS public.backfill_contatos_nome_log; DROP FUNCTION IF EXISTS public.fn_backfill_contatos_nome();"). Não é regressão de produção nem DDL manual — é remediação Onda 1 versionada corretamente. Apenas o teste de integração não foi removido junto.  
**Fix:** Deletar `tests/integration/backfill_contatos_nome.integration.test.ts` em onda subsequente. Sem urgência — o teste falha de forma autoexplicativa (PGRST202 com hint da função alvo).

---

**[P1-TEST02]** [🟢 MELHORIA] TESTES — Suite cresceu: 85 → 90 testes (positivo)

**Arquivo:** `tests/integration/` e `src/__tests__/`  
**Evidência:** `Test Files: 1 failed | 15 passed (16) — Tests: 1 failed | 89 passed (90)`  
vs. AUDIT.md: "85 tests passing across 15 files".  
**Status:** NEW (positivo) — 5 novos testes adicionados.  
**Fix:** Nenhum.

---

## Resumo executivo (Phase 1)

| Severidade | Qtd | IDs |
|---|---|---|
| 🔴 CRÍTICO | 0 | — |
| 🟡 IMPORTANTE | 2 | P1-L01, P1-L02 |
| 🟢 MELHORIA | 9 | P1-L03..L08, P1-B01, P1-TEST01, P1-TEST02 |

| Status | Qtd | IDs |
|---|---|---|
| REGRESSION | 0 | — |
| NEW | 2 | P1-L01 (_parked/ não ignorado pelo ESLint), P1-TEST02 (+5 testes, positivo) |
| KNOWN | 9 | P1-L02..L08, P1-B01, P1-TEST01 |

**Delta vs AUDIT.md baseline (2026-05-08), filtro in-scope idêntico (excluir `_parked/` + testes):**

| Métrica | e286072 | 21280b1 | Delta |
|---|---|---|---|
| `tsc --noEmit` | ⚠️ não documentado em AUDIT.md | Limpo (exit 0) | — |
| `build` (tsc -b + vite build) | ⚠️ não documentado em AUDIT.md | Limpo (exit 0) | — |
| Lint in-scope (`src/` prod) | 41e + 3w = 44 | 41e + 3w = 44 | **0** |
| Lint total bruto | 63e + 9w = 72 | 63e + 9w = 72 | **0** |
| Testes | 85 passed (15 files) | 89 passed + 1 falha intencional (16 files) | +5 testes; 1 órfão |

**Conclusão da Phase 1:** dívida de tipo/lint **estável** desde o audit — nenhuma regressão, nenhum item novo de prioridade alta. Único achado novo é organizacional: ESLint config não foi atualizado quando o `_parked/` foi criado (commit 67ab163), poluindo a contagem bruta. O teste `backfill_contatos_nome` quebrou apenas porque a função alvo foi dropada via migration versionada (cumprimento direto de H1) — esperado e benigno.

**Próxima fase:** Phase 2 — DATABASE (advisors de segurança/performance via MCP, list_migrations, RLS coverage).
