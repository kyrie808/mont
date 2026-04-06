# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Mont** is a monorepo for Mont Distribuidora — an artisanal pão de queijo distribution business. Two apps + shared packages, managed with pnpm workspaces and Turborepo. Both apps are in production.

- **apps/catalogo** — Public product catalog (Next.js 15, React 19, App Router) → montdistribuidora.com.br
- **apps/interno** — Internal CRM/ERP "Jarvis" (Vite + React 19, SPA with HashRouter) → sistema.montdistribuidora.com.br
- **packages/shared** (`@mont/shared`) — Supabase database types (auto-generated), formatters, validators, cn
- **packages/config** (`@mont/config`) — Shared tsconfig base

## ⚠️ Rules of Gold (NEVER violate)

1. **Zero `as any`** — Type correctly always. Only 3 accepted: zodResolver/react-hook-form incompatibility.
2. **Zero hacks** — Architect like a senior engineer. If something is wrong, fix it properly.
3. **Never alter production database directly** — All changes go through local Docker → migration → test → `npx supabase db push`.
4. **Zero unauthorized visual changes** — Do NOT rewrite UI components. If scope is type changes, change types only. Never change CSS, animations, text, layout, colors without explicit authorization.
5. **Diagnosis first, execution second** — Analyze current state before implementing. "No frankensteins."
6. **Checkpoint per stage** — Commit, build, report before advancing.
7. **Credentials never in git** — `.env.local` always in `.gitignore`.

## Common Commands

```bash
# Install
pnpm install

# Dev
pnpm --filter catalogo dev    # Next.js on localhost:3000
pnpm --filter interno dev     # Vite on localhost:5173

# Build
pnpm turbo build                          # Build all
pnpm turbo build --filter=catalogo        # Build catalog only
pnpm turbo build --filter=interno         # Build internal only

# Tests (run against local Docker database)
npx supabase start                        # Start local DB first
pnpm --filter interno test                # Run all tests
pnpm turbo test                           # Run all tests via turbo
npx supabase stop                         # Stop local DB after

# Type checking
pnpm --filter catalogo exec tsc --noEmit
pnpm --filter interno exec tsc --noEmit

# Lint
pnpm --filter catalogo lint
pnpm --filter interno lint
```

## Database Workflow (Supabase Local + Docker)

**For code/UI changes:** Develop normally, no Docker needed. Apps point to production via `.env.local`.

**For schema changes (tables, columns, views, RPCs, triggers):**
```bash
npx supabase start                                    # Start local DB
# Make changes in local Studio (http://127.0.0.1:54323)
npx supabase migration new descriptive_name            # Record migration
npx supabase gen types typescript --local > packages/shared/src/database.ts
# IMPORTANT: types.ts has manual aliases — database.ts is auto-generated only
npx supabase db push                                   # Apply to production
npx supabase stop                                      # Stop local DB
```

**RULE: Never alter production database directly. Everything originates locally via migration.**

## Architecture

### Backend: Supabase
Both apps share the same Supabase project (`herlvujykltxnwqmwmyx`). All monetary values are in **reais** (numeric). Zero centavos, zero conversions.

Environment variables:
- **catalogo:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_APP_URL`
- **interno:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### apps/catalogo (Next.js 15)
- App Router (`src/app/`)
- Admin section (`src/app/admin/`) with Supabase auth
- Public catalog with cart (Zustand 5, `src/lib/cart/`)
- GSAP animations (`src/lib/gsap/`) — DO NOT modify without authorization
- WhatsApp checkout (`src/lib/whatsapp/`)
- SSR Supabase client via `@supabase/ssr` (`src/lib/supabase/client.ts`, `server.ts`, `admin.ts`)
- ESLint 9 flat config (`eslint.config.mjs`)

### apps/interno (Vite SPA)
- Lazy-loaded pages via `React.lazy()` in `App.tsx`
- HashRouter (static SPA on Vercel)
- Service layer: `src/services/` (vendaService, contatoService, produtoService, etc.)
- State: Zustand 5 stores + TanStack React Query
- Zod 4 schemas in `src/schemas/`
- UI: custom components with CVA + clsx + tailwind-merge
- PWA via `vite-plugin-pwa`
- 3D: React Three Fiber + drei (estoque visualization)
- ESLint 9 flat config (`eslint.config.js`)
- Tests: Vitest + jsdom + Testing Library

### packages/shared
Consumed as TypeScript source (no build step). Exports:
- `cn()` — Tailwind class merger
- `formatCurrency(value: number)` — Formats reais. NO `fromCents` parameter.
- `formatPhone`, `formatDate`, `formatWeight`, etc.
- `isValidPhone`
- All Supabase database types: `Database`, `Produto`, `Venda`, `Contato`, `Conta`, etc.
- Type helpers: `Tables<T>`, `Enums<T>`, `Insert<T>`, `Update<T>`

**IMPORTANT:** `database.ts` is AUTO-GENERATED by Supabase CLI. Never edit manually. Manual type aliases live in `types.ts`.

### packages/config
- `typescript/base.json` — shared tsconfig (strict, skipLibCheck, ESNext, bundler)
- Both apps extend this base with their framework-specific options

## Database Critical Points

- **Bidirectional sync:** triggers `fn_sync_cat_pedido_to_venda` and `fn_sync_venda_to_cat_pedido`
- **RPC `criar_pedido`:** single version, receives reais, creates cat_pedidos + cat_itens_pedido + vendas + itens_venda
- **Brindes:** sales with `pago=false` and `status='entregue'` — exclude from revenue calculations
- **FK deletion order:** lancamentos → pagamentos_venda → itens_venda → vendas → cat_itens_pedido → cat_pedidos → contatos

## Language and Domain

Codebase and UI are in **Brazilian Portuguese**. Table names, field names, component names, variables — all Portuguese. Follow this convention. Examples: `vendas`, `contatos`, `produtos`, `contas_a_pagar`, `fluxo_caixa`.

## Testing

- **Framework:** Vitest (configured in `apps/interno`)
- **Integration tests:** `apps/interno/src/__tests__/` — run against local Docker Supabase
- **Unit tests:** `apps/interno/src/services/__tests__/`
- **Test helpers:** `packages/shared/src/test-utils.ts` (NOT exported from barrel — use subpath `@mont/shared/test-utils`)
- **Seed data:** `supabase/seed.sql`
- **Parallelism:** Disabled (`fileParallelism: false`) to avoid race conditions on shared DB
- **30 tests passing** covering: vendas, sync bidirecional, checkout, financeiro

## Deploy

- **Vercel:** `mont-catalogo` and `mont-interno`, both from `kyrie808/mont`
- **Build command:** `cd ../.. && pnpm turbo build --filter=[app]`
- **Install command:** `pnpm install`
- **All env vars declared in `turbo.json` globalEnv**
- **Turborepo Ignore Build Step:** configure `npx turbo-ignore` per project

## Roadmap — Etapa 5 (Current)

### Completed ✅
- Item 1: database.ts → @mont/shared (single source of truth)
- Item 2: Unified Product types (all Portuguese)
- Item 3: React 18→19 + Next.js 14→15 + Zustand 4→5
- Item 4: Zod 3→4
- Item 5: Zustand 4→5 (came with Item 3)
- Item 6: ESLint 8→9 (flat config)
- Item 7: @mont/config (shared tsconfig base)
- Item 7.5: Supabase CLI + Docker (local dev DB + regenerated types + ~100 `as any` eliminated)
- Item 8: TDD for critical flows (30 tests, trigger bug fixed via migration)

### Remaining
- Item 9: Extract @mont/ui (shared UI components)
- Item 10: Unify migrations in root
- Item 11: Archive old repos as read-only

### Financial tracking zero date: May 1, 2026
All data before this date is approximate reference. From May 1 onwards, all financial data must be accurate.
