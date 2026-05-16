---
name: brownfield-discovery
description: Manual comprehensive brownfield codebase audit with 6-phase diagnostic: build/types, database, type consistency, frontend/UX, tests, performance/security. TRIGGER ONLY when user explicitly requests "brownfield", "diagnóstico", "audit", "análise completa", "health check", or "mapear problemas". This skill requires explicit manual invocation — never invoked automatically by model. Use only for complete codebase health checks, technical debt discovery, and legacy analysis. Do NOT use for simple code review, single-file fixes, or feature implementation.
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Bash
  - Write
---

# Brownfield Discovery

Comprehensive 6-phase diagnostic tool for brownfield codebases. This skill performs systematic analysis without executing any corrections — it only reports findings.

**IMPORTANT:** This skill NEVER executes fixes. It diagnoses and reports only.

## Core Principle

⚠️ **Report ONLY what you VERIFIED.** If a check wasn't performed, mark it as `⚠️ NÃO VERIFICADO`. Never speculate or infer issues without evidence.

## The 6 Phases — Execute in Order

### Phase 1: BUILD & TYPES

Execute commands and capture ALL outputs:

1. `npm run build` — capture TypeScript compilation errors
2. `npm run lint` — capture ESLint violations
3. `npm run test` — capture test failures and output

If commands don't exist in package.json scripts, mark as `⚠️ NÃO VERIFICADO`.

**What to capture:**
- Build-blocking TypeScript errors (file path, line, message)
- Lint violations (categories: security, complexity, best-practices)
- Test failures (test name, expected vs actual, flaky indicators)
- Missing or malformed type definitions

**Report format per issue:**
```
[SEVERIDADE] BUILD — Descrição do erro
**Arquivo:** path/to/file.ts:123
**Evidência:** "Exact error message from build/lint/test"
**Fix:** Suggested fix (1-2 sentences)
```

### Phase 2: DATABASE

Check for Supabase MCP availability in available_tools.

**If MCP available:**
- Use `list_tables` with verbose=true to inspect schema
- Use `get_advisors` type `security` for security advisories
- Use `get_advisors` type `performance` for performance advisories
- Use `list_migrations` to identify orphaned/conflicting migrations

**If MCP not available:**
- Read migration files from common paths: `supabase/migrations/`, `migrations/`, `db/migrations/`
- Check for SQL syntax issues, inconsistent naming, missing constraints

**What to capture:**
- Missing RLS policies (from security advisors)
- Missing indexes (from performance advisors)
- Orphaned or conflicting migrations
- Schema violations: undefined FKs, missing constraints, inconsistent types

**Multi-project check:**
- If CLAUDE.md or GEMINI.md mentions shared databases, identify which tables belong to which project
- Do NOT report tables from other projects as orphaned
- Check field ownership rules (which project owns which fields)

### Phase 3: TYPES & CONSISTÊNCIA

Read type definition files and compare with actual usage:

1. Read database types: `src/types/database.ts` or auto-generated Supabase types
2. Read domain types: `src/types/domain.ts` or equivalent
3. Grep for type usage across codebase

**What to capture:**
- Type mismatches between DB schema and domain types
- Dead types (defined but never used in codebase)
- Excessive `any` types usage
- `@ts-ignore` or `@ts-nocheck` comments
- Naming inconsistencies (snake_case vs camelCase where inappropriate)
- Mapper inconsistencies (snake_case → camelCase conversion issues)
- Enum values defined in types but not used/missing in DB

**Mapper verification:**
- Read the mappers file (commonly src/services/mappers.ts)
- For each mapper function, verify that ALL source fields (snake_case) map to ALL destination fields (camelCase)
- Report fields that exist in DB types but are missing in domain types
- Report fields that exist in domain types but are missing in DB types

### Phase 4: FRONTEND & UX

Analyze React components and UI code:

**Logic mixing detection:**
- Business logic inside components (should be in services/hooks)
- API calls directly in JSX (should be in hooks with React Query)
- State scattered without proper lifting/state management

**Accessibility (a11y):**
- Grep for `<input`, `<button`, `<img` without required attributes
- Missing `aria-label`, `aria-labelledby`, `alt`, `role`
- Heading hierarchy violations (h1 → h3, skipping levels)

**Responsiveness:**
- Read component files in `src/components/`
- Check for fixed widths without responsive classes
- Missing `md:`, `lg:`, `xl:` Tailwind breakpoints
- Overflow issues (horizontal scroll on mobile)

**Dead code detection:**
- Unused imports (checked with linter if available)
- Unused components (defined but not imported anywhere)
- Large commented-out code blocks (>5 lines)

**Report large components (>300 lines):**
```
[🟢] FRONTEND — Componente >300 linhas, considerar refatoração
**Arquivo:** src/components/filename.tsx
**Evidência:** "Componente tem 347 linhas"
**Fix:** Extrair subcomponentes e lógica para hooks/services
```

### Phase 5: TESTES

Check test coverage and critical paths:

1. Check if `--coverage` flag works with `npm run test`
2. List all test files (usually `*.test.ts`, `*.test.tsx`, `*.spec.ts`)
3. Identify critical modules without test files

**Common critical paths (check for tests):**
- Authentication/authorization
- Payments/financial operations
- Core business logic (services/)
- Data persistence (database operations)

**What to capture:**
- Critical paths without any test coverage
- Test files with 0 actual tests (empty or only `describe` blocks)
- Tests that mock too much (reduce confidence)
- Missing test files for key features identified from imports

### Phase 6: PERFORMANCE & SEGURANÇA

**Bundle analysis:**
- Check for build report (often `dist/report.html`, `build/stats.html`)
- If report unavailable, check package.json for large dependencies
- Dependencies >500KB are candidates for tree-shaking or alternatives

**Query performance:**
- Read service files in `src/services/`
- Look for `.select('*')` patterns (fetch too much data)
- Search for loops with API calls inside (N+1 pattern)
- Check for missing `.limit()` on list query operations

**Security:**
- Grep for exposed credentials in non-.env files:
  - `VITE_`, `REACT_APP_`, `NEXT_PUBLIC_` prefixes in source files
  - `API_KEY`, `SECRET`, `TOKEN` patterns
- Grep for `console.log` with sensitive data patterns
- Grep for `eval()`, `innerHTML`, `dangerouslySetInnerHTML`
- Check if `.env.example` exists and documents all required vars

**Example security finding:**
```
[🔴] SECURITY — API key exposta no código
**Arquivo:** src/services/api.ts:12
**Evidência:** "const API_KEY = 'sk-12345...'"
**Fix:** Mover para .env e usar import.meta.env.VITE_API_KEY
```

## Report Item Format

Use EXACTLY this format for each verified finding:

```
[SEVERIDADE] CATEGORIA — Descrição curta (uma frase)

**Arquivo:** path/to/file.ts:123
**Evidência:** "Reproduce the EXACT error or output"
**Fix:** Suggested fix (1-2 sentences maximum)
```

### Severity Levels

- 🔴 **CRÍTICO** — Build fails, security vulnerability, production bug, data loss risk
- 🟡 **IMPORTANTE** — Performance issue, missing tests for critical path, type safety loss
- 🟢 **MELHORIA** — Code smell, dead code, a11y minor issue, style inconsistency

## Final Report Structure

After completing all 6 phases, output:

```markdown
# Relatório de Diagnóstico — [PROJECT_NAME]

## Resumo Executivo

- 🔴 CRÍTICO: X
- 🟡 IMPORTANTE: Y
- 🟢 MELHORIA: Z

### Top 5 Urgentes

1. [Category] [Brief description]
2. [Category] [Brief description]
3. [Category] [Brief description]
4. [Category] [Brief description]
5. [Category] [Brief description]

### Estimativa de Esforço

- Correções críticas: X dias/horas
- Melhorias importantes: Y dias/horas
- Refinamentos sugeridos: Z dias/horas

---

## Detalhes por Fase

### Phase 1: BUILD & TYPES
[findings with exact format above]

### Phase 2: DATABASE
[findings]

### Phase 3: TIPOS & CONSISTÊNCIA
[findings]

### Phase 4: FRONTEND & UX
[findings]

### Phase 5: TESTES
[findings]

### Phase 6: PERFORMANCE & SEGURANÇA
[findings]

---

## ⚠️ NÃO VERIFICADO

[List any phases or checks that could not be performed due to tool/structure limitations]
```

## What NOT to Do

- ❌ Never execute fixes even if obvious
- ❌ Never create TODO/FIXME comments without action path
- ❌ Never report issues without file:line when available
- ❌ Never skip phases — all 6 must be attempted
- ❌ Never merge findings from different phases
- ❌ Never make assumptions about tool availability — mark as `⚠️ NÃO VERIFICADO`
- ❌ Never generate placeholder fixes like "fix this"

## Special Framework Notes

**React 19 projects:**
- Deprecated patterns: useEffect for data fetching without cleanup
- Suspense boundary placement
- Server vs Client Component mixing issues

**Supabase projects:**
- RLS policy coverage check via MCP advisors
- Edge functions JWT verification requirement
- Exposed anon keys in client code
- Trigger/RPC modifications (report only, don't execute)

**TanStack Query projects:**
- Missing `.invalidateQueries` after mutations
- Missing `staleTime`/`cacheTime` configuration
- Queries without `.data` guard checks
