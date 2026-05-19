# Phase 6 — PERFORMANCE & SECURITY
# Outline de execução
# Data: 2026-05-17
# Base: commit `21280b1` (branch `main`)
# Status: AGUARDANDO APROVAÇÃO DO DIRETOR

---

## Header obrigatório

| Campo | Valor |
|---|---|
| **Scope** | Monorepo completo (`apps/interno`, `apps/catalogo`, `packages/`) — ângulos A/D/E em interno; C/B em interno+catalogo conforme necessário |
| **Padrão brownfield** | MAPEAMENTO APENAS — zero remediação durante a fase. Achados catalogados com ID P6-Xnn, severidade, evidência, ação recomendada |
| **Sementes consumidas** | P2-DB04 (7 FKs sem índice), P2-DB06 (14 unused indexes), P2-DB07 (17 permissive policies), P5-T10 (sem CI gate), advisors.log Phase 2 (performance pendentes), H3/C1/P2-DB03 (segurança residual por referência), P4-DC05/DC09 (bundle/deps) |
| **Logs raw** | `apps/interno/reports/phase6/{secrets.log, db-indexes.log, advisors.log, deps.log, bundle.log, n1.log}` |
| **Output final** | `apps/interno/reports/phase6/findings.md` |
| **Ângulo bloqueante** | D (secrets) — 🔴 encontrado = parar e reportar antes de continuar |

---

## Critérios de severidade (unificados)

| Nível | Critério |
|---|---|
| 🔴 | Vulnerabilidade explorável: credencial/token em git history ou bundle compilado; dep com CVE Critical; env var secreta exposta em bundle; `pnpm audit` high com exploitability confirmed |
| 🟡 | N+1 confirmada em caminho renderizado; initial chunk > 200 KB gzipped; total bundle > 1 MB gzipped; chunk de feature parqueada > 50 KB; FK não indexada em delete cascade; `leaked_password_protection` desligado (P2-DB03); `pnpm audit` high sem exploitability confirmada ou moderate; outdated major sem atualização há > 12 meses |
| 🟢 | Índice unused sem impacto de write; policy overlap sem elevação de privilégio; outdated minor/patch; dep desatualizada não-crítica sem CVE |

**Critério específico para `pnpm audit`:**

| Severity | Default | Ajuste por exploitability |
|---|---|---|
| Critical | 🔴 | — |
| High | 🟡 | → 🔴 se CVE com PoC público ou CVSS ≥ 9.0 |
| Moderate | 🟡 | — |
| Low | 🟢 | — |

---

## Sementes consolidadas

| Semente | Origem | Descrição | Ângulo |
|---|---|---|---|
| P2-DB04 | Phase 2 | 7 FKs sem índice (contas_a_pagar ×3, pagamentos_conta_a_pagar ×4) | A |
| P2-DB06 | Phase 2 | 14 unused indexes (produtos, lancamentos, contas, contatos, vendas, etc.) | A |
| P2-DB07 | Phase 2 | 17 multiple permissive policies | A |
| auth_rls_initplan (2) | advisors.log Phase 2 | auth.uid() RAW em admin_users + interacoes | F |
| `leaked_password_protection` | advisors.log Phase 2 | Auth setting desligado — P2-DB03 | F |
| H3 STILL_OPEN | Phase 2 findings | contatos UPDATE sem restrição | F (ref. por ID) |
| C1 residual | Phase 2 findings | public_bucket_allows_listing | F (ref. por ID) |
| P4-DC05 | Phase 4 | Feature flags hardcoded — confirmar DCE no bundle | B |
| P4-DC09 | Phase 4 | 6 deps declaradas não usadas — confirmar leakage | B + C |
| P5-T10 | Phase 5 | Sem coverage config + CI gate | A |
| Secret leakage | NEW | git history + bundle compiled | D |
| CVEs | NEW | pnpm audit (interno + catalogo) | C |
| N+1 patterns | NEW | services + hooks layer | E |

---

## Sequência de execução

```
D (secrets — bloqueante) → A (DB seeds) → F (advisors) → C (deps) → B (bundle) → E (N+1)
```

---

## Ângulo D — Secret/env leakage

**Objetivo:** Varrer git history + bundle compilado por credenciais hardcoded.

**Scope:** Monorepo inteiro (`git log --all -p`) — não apenas apps/interno.

### Passo D.1 — gitleaks (se disponível)

```powershell
# Verificar se gitleaks está instalado
if (Get-Command gitleaks -ErrorAction SilentlyContinue) {
    gitleaks detect --source . --report-format json --report-path phase6/gitleaks-report.json
} else {
    Write-Host "gitleaks não disponível — usar fallback grep (D.2)"
}
```

### Passo D.2 — Fallback: git log grep por padrão

Scope: `git log --all -p` no monorepo. Padrões obrigatórios:

| Padrão | Tipo | Regex |
|---|---|---|
| JWT / Supabase anon+service keys | Token base64 prefixado com eyJ | `eyJ[A-Za-z0-9_\-]{40,}` |
| OpenAI / Anthropic API keys | sk- prefix | `sk-[A-Za-z0-9]{20,}` |
| Supabase service_role literal | Literal string | `service[_-]role` |
| AWS access key | AKIA prefix | `AKIA[A-Z0-9]{16}` |
| Slack bot token | xoxb prefix | `xoxb-[0-9A-Za-z\-]{24,}` |
| GitHub PAT | ghp_ prefix | `ghp_[A-Za-z0-9]{36}` |

```powershell
# Executar cada padrão separadamente — git log com grep (Bash via wsl ou git bash)
$patterns = @(
    'eyJ[A-Za-z0-9_\-]{40,}',
    'sk-[A-Za-z0-9]{20,}',
    'service[_-]role',
    'AKIA[A-Z0-9]{16}',
    'xoxb-[0-9A-Za-z\-]{24,}',
    'ghp_[A-Za-z0-9]{36}'
)
# Usar Bash tool para cada:
# git log --all -p | grep -E "<pattern>" | grep -v "^\-\-\-" | grep -v "^+++" | head -20
```

**Exclusões explícitas:** `import.meta.env.VITE_*` em arquivos `.ts/.tsx` (referências legítimas, não valores), comentários de documentação, linhas removidas (prefixo `-`) em commits de rotação de keys.

### Passo D.3 — Bundle check (após build do ângulo B)

```powershell
# Após pnpm --filter interno build:
$distPath = "apps/interno/dist/assets"
$patterns = @('eyJ[A-Za-z0-9_\-]{40,}', 'sk-[A-Za-z0-9]{20,}', 'AKIA[A-Z0-9]{16}',
              'xoxb-', 'ghp_', 'herlvujykltxnwqmwmyx')  # project ID como fallback
Get-ChildItem "$distPath/*.js" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    foreach ($p in $patterns) {
        if ($content -match $p) {
            Write-Output "MATCH: $($_.Name) — pattern: $p"
        }
    }
}
```

**Output:** `phase6/secrets.log`

**Regra bloqueante:** Qualquer match em D.2 ou D.3 = 🔴, parar e reportar ao diretor imediatamente. D.1 gitleaks clean = consignado no log como evidência.

---

## Ângulo A — Reconciliação das sementes DB

**Objetivo:** Confirmar via query direta se P2-DB04/06/07 e P5-T10 persistem.

### A.1 — FKs sem índice (P2-DB04)

```sql
SELECT
    tc.table_name, kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column,
    (SELECT COUNT(*) FROM pg_index pi
     JOIN pg_attribute pa ON pa.attrelid = pi.indrelid AND pa.attnum = ANY(pi.indkey)
     WHERE pi.indrelid = kcu.table_name::regclass
     AND pa.attname = kcu.column_name) AS index_count
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage ccu
    ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (SELECT COUNT(*) FROM pg_index pi
       JOIN pg_attribute pa ON pa.attrelid = pi.indrelid AND pa.attnum = ANY(pi.indkey)
       WHERE pi.indrelid = kcu.table_name::regclass
       AND pa.attname = kcu.column_name) = 0
ORDER BY tc.table_name, kcu.column_name;
```

**Severidade:** FK sem índice em coluna usada em DELETE CASCADE = 🟡; FK em tabela _parked = 🟢.

### A.2 — Unused indexes (P2-DB06)

```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Nota:** `idx_scan = 0` depende do tempo desde o último `pg_stat_reset()`. Incluir no header do log: `SELECT stats_reset FROM pg_stat_bgwriter;`

### A.3 — Multiple permissive policies (P2-DB07)

```sql
SELECT tablename, cmd, COUNT(*) AS policy_count,
       STRING_AGG(policyname, ' | ' ORDER BY policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;
```

### A.4 — P5-T10 (coverage config)

Inspeção de `apps/interno/vite.config.ts` — confirmar ausência do bloco `coverage:` e `@vitest/coverage-v8` em package.json. Verificar se GitHub Actions workflow existe em `.github/workflows/`.

**Output:** `phase6/db-indexes.log`

---

## Ângulo F — Performance advisors detalhados (Phase 2 residual)

**Regra de inclusão:** Abrir `apps/interno/reports/phase2/advisors.log` (não recapturar via MCP, salvo exceção abaixo). Processar apenas:
1. Performance advisors **pendentes** (auth_rls_initplan ×2, leaked_password_protection — não endereçados em Onda 1/2)
2. Achados de segurança residual: referenciar por ID (H3, C1) — não re-detalhar

**Exceção para recaptura:** Se a análise de A.2 (unused indexes) mostrar que `idx_scan > 0` para algum dos 14 índices listados no Phase 2 advisors.log, recapturar `unused_index` via MCP `get_advisors`. Documentar no header do log se recaptura foi necessária.

### F.1 — auth_rls_initplan (2 ocorrências)

Tabelas afetadas: `admin_users.Admin full access`, `interacoes.Authenticated insert own interacoes`.

Padrão: `auth.uid()` chamado como função em `qual`/`with_check` — Supabase inicializa o plano para cada row.

```sql
-- Comparar custo com/sem SELECT wrapper (EXPLAIN ANALYZE em dev/local apenas)
EXPLAIN SELECT * FROM admin_users LIMIT 10;
-- vs. como seria com: WHERE (SELECT auth.uid()) = user_id
```

Severidade: 🟡 (custo de initplan escala com volume de rows — impacto em tabelas grandes).

### F.2 — leaked_password_protection (P2-DB03)

Confirmar estado atual via MCP `get_advisors` ou painel Auth. Não requer query SQL — é um setting de Auth, não de DB.

Severidade: 🟡 (conforme critério unificado).

### F.3 — Segurança residual (por referência)

| ID | Descrição | Status de reference |
|---|---|---|
| H3 | contatos UPDATE qual+check=true sem restrição | Phase 2 STILL_OPEN — não re-detalhar |
| C1 | public_bucket_allows_listing (SELECT público amplo) | Phase 2 achado aceito — confirmar se ainda presente |
| C2 partial | 9 RPCs authenticated UNGUARDED | Phase 2 STILL_OPEN — Phase 5 P5-T04 também referencia |

F.3 produz apenas uma linha de confirmação: "H3/C1/C2 permanecem conforme Phase 2 findings.md — sem delta."

**Output:** `phase6/advisors.log`

---

## Ângulo C — Dependency audit

**Objetivo:** CVEs conhecidas + deps desatualizadas.

```powershell
# Audit (apenas apps/interno)
pnpm --filter interno audit --audit-level=low 2>&1 | Tee-Object -FilePath "apps/interno/reports/phase6/deps.log"
# Audit monorepo completo
pnpm audit --audit-level=low 2>&1 | Tee-Object -Append -FilePath "apps/interno/reports/phase6/deps.log"
# Outdated
pnpm --filter interno outdated 2>&1 | Tee-Object -Append -FilePath "apps/interno/reports/phase6/deps.log"
pnpm --filter catalogo outdated 2>&1 | Tee-Object -Append -FilePath "apps/interno/reports/phase6/deps.log"
```

**Critério de severidade para audit:**

| pnpm audit severity | Severidade Phase 6 | Ajuste |
|---|---|---|
| Critical | 🔴 | — |
| High | 🟡 | → 🔴 se CVE com PoC público confirmado ou CVSS ≥ 9.0 |
| Moderate | 🟡 | — |
| Low | 🟢 | — |

**Critério para outdated:**

| Defasagem | Severidade |
|---|---|
| Major version sem atualização há > 12 meses | 🟡 |
| Major version (recente) | 🟢 |
| Minor ou patch | 🟢 |

**Output:** `phase6/deps.log`

---

## Ângulo B — Bundle size

**Objetivo:** Medir chunks gzipados do bundle de produção. Confirmar DCE de P4-DC05 (feature flags hardcoded) e leakage de P4-DC09 (deps não usadas).

### B.1 — Build

```powershell
pnpm --filter interno build 2>&1 | Tee-Object -FilePath "apps/interno/reports/phase6/bundle-build.log"
```

O output do Vite já inclui estimativas gzip por chunk.

### B.2 — Medição gzipada por chunk

```powershell
Get-ChildItem "apps/interno/dist/assets/*.js" | ForEach-Object {
    $raw = [System.IO.File]::ReadAllBytes($_.FullName)
    $ms = New-Object System.IO.MemoryStream
    $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Compress)
    $gz.Write($raw, 0, $raw.Length); $gz.Close()
    [PSCustomObject]@{
        Name    = $_.Name
        OrigKB  = [Math]::Round($raw.Length / 1024, 1)
        GzipKB  = [Math]::Round($ms.Length / 1024, 1)
    }
} | Sort-Object GzipKB -Descending |
    Tee-Object -Append -FilePath "apps/interno/reports/phase6/bundle.log" |
    Format-Table -AutoSize
```

### B.3 — Thresholds e severidade

| Condição | Severidade |
|---|---|
| Initial chunk > 200 KB gzipped | 🟡 |
| Total bundle > 1 MB gzipped | 🟡 |
| Chunk contendo código de feature parqueada > 50 KB (P4-DC05/DC09) | 🟡 |
| Total bundle > 2 MB gzipped | 🔴 |

### B.4 — Verificação de leakage de features parqueadas (P4-DC05/DC09)

```powershell
# Strings de features parqueadas que não devem aparecer no bundle
$leakPatterns = @(
    'recompraService', 'logisticaService', 'RelatorioFabrica',
    'ContaAPagarModal', 'contasAReceber', 'parked'
)
Get-ChildItem "apps/interno/dist/assets/*.js" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    foreach ($p in $leakPatterns) {
        if ($content -match $p) {
            Write-Output "LEAKAGE: $($_.Name) — string: $p"
        }
    }
} | Tee-Object -Append -FilePath "apps/interno/reports/phase6/bundle.log"
```

**Output:** `phase6/bundle.log`

---

## Ângulo E — N+1 patterns no service/hook layer

**Objetivo:** Identificar queries em loop — `async` dentro de `forEach/map/for/filter` — nos services e hooks mais pesados.

### E.1 — Grep de padrões N+1

```powershell
# Pattern: await dentro de iteração (N+1 candidate)
$servicePath = "apps/interno/src/services"
$hooksPath   = "apps/interno/src/hooks"

Get-ChildItem "$servicePath/*.ts", "$hooksPath/*.ts", "$hooksPath/*.tsx" -Recurse |
    Select-String -Pattern "\.(forEach|map|for|filter)\s*\(.*async|for\s*\(.*await|forEach\s*\(.*await" |
    Select-Object Filename, LineNumber, Line |
    Tee-Object -FilePath "apps/interno/reports/phase6/n1-grep.log" |
    Format-Table -AutoSize
```

### E.2 — Lista-alvo (leitura manual após grep)

Arquivos a revisar em detalhe — conforme Phase 1 top de chamadas pesadas:

| Arquivo | Razão de inclusão |
|---|---|
| `src/services/vendaService.ts` | getVendas carrega vendas + pagamentos + itens |
| `src/services/dashboardService.ts` | getHomeData chama 3+ queries sem paralelismo confirmado |
| `src/services/cashFlowService.ts` | getExtrato / getFluxoResumo — estrutura de queries desconhecida |
| `src/services/contatoService.ts` | relacionamento + interações potencialmente em N+1 |
| `_parked/relatorioService.ts` | Phase 1 heavy — parked mas padrão pode ser reativado |
| `_parked/recompraService.ts` | P4-DC05 orphan — padrão N+1 antes de arquivar |
| `src/hooks/useEstoqueMetrics.ts` (se existir) | Phase 1 top pesado |
| `src/hooks/useIndicacoes.ts` (se existir) | Phase 1 top pesado |

**Critério:** Loop `for/forEach/map` com `await supabase.from(...)` dentro = N+1 confirmada. Query de lista seguida de query por ID sem `.in()` batch = N+1 confirmada.

### E.3 — Output tabular esperado

| Arquivo | Linha | Padrão detectado | Severidade | Fix sugerido |
|---|---|---|---|---|
| `vendaService.ts` | N | `vendas.map(async v => await supabase...)` | 🟡 | batch via `.in('id', ids)` |

**Output:** `phase6/n1.log`

---

## Arquivos de saída

| Arquivo | Ângulo | Conteúdo |
|---|---|---|
| `phase6/secrets.log` | D | gitleaks result (se disponível) + grep patterns git history + bundle check |
| `phase6/db-indexes.log` | A | FKs sem índice, unused indexes (com pg_stat reset date), permissive policies, P5-T10 config |
| `phase6/advisors.log` | F | auth_rls_initplan EXPLAIN, leaked_password state, H3/C1/C2 confirmação |
| `phase6/deps.log` | C | pnpm audit output + pnpm outdated (interno + catalogo) |
| `phase6/bundle.log` | B | Build output + chunk sizes gzipados + leakage check |
| `phase6/n1.log` | E | grep output + tabela manual com arquivo:linha, padrão, fix |
| `phase6/findings.md` | — | Report final: ID P6-Xnn, severidade, evidência, ação |
