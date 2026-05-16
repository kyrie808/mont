---
name: supabase-mont
description: Supabase database operations for this project. Use when working with database, tables, triggers, RPC, migrations, or types.
allowed-tools: Read, Write, Bash, Grep
---

# Supabase Expert — Mont

Project ID: herlvujykltxnwqmwmyx (shared between apps/interno + apps/catalogo)

## Before ANY database change

1. Run a diagnostic SELECT to see current state
2. For triggers: `SELECT tgname, tgrelid::regclass, tgenabled FROM pg_trigger WHERE tgname LIKE '%pattern%';`
3. For RPCs: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';`
4. Explain what you will change and wait for approval

## PostgREST Gotchas

- `.limit()` is IGNORED on DELETE → use subquery approach
- Silent null on joins = FK not recognized → `NOTIFY pgrst, 'reload schema'`
- After ANY schema change: `NOTIFY pgrst, 'reload schema'`

## Type Regeneration Flow

1. Make DB change
2. Use MCP `generate_typescript_types` (or Supabase CLI)
3. Update packages/shared/src/database.ts
4. Check if apps/interno/src/types/domain.ts needs updates
5. Check if apps/interno/src/services/mappers.ts needs updates
6. Run `npm run build`

## Two-Project Architecture

This Supabase is shared with catalogo-mont.
- Tables with `cat_` prefix = catalog project
- Field ownership: `subtitulo`, `categoria` = only internal system edits
- `visivel_catalogo` controls catalog visibility (separate from `ativo`)
- Image tables: `sis_imagens_produto` (internal) + `cat_imagens_produto` (catalog)

## Key Tables

contatos, produtos, vendas, itens_venda, pagamentos_venda, purchase_orders, purchase_order_items, lancamentos_caixa, contas_caixa, plano_contas
