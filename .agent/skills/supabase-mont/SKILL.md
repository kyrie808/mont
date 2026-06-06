---
name: supabase-mont
description: Supabase database operations for this project. Use when working with database, tables, triggers, RPC, migrations, or types.
allowed-tools: Read, Write, Bash, Grep
---

# Supabase Expert — Mont

Project ID: herlvujykltxnwqmwmyx (shared between apps/interno + apps/catalogo)

## Before ANY database change

**Risk tier first (Rule of Gold #3):**
- **Código/UI** que só consome o banco: sem cerimônia, roda direto na produção.
- **Schema/dados** (tabelas, colunas, views, RPCs, triggers, RLS, `UPDATE`/`DELETE` em linhas reais): (a) backup ANTES — `supabase/scripts/dump-prod.ps1`; (b) toda mudança de schema vira **arquivo de migration** (`npx supabase migration new ...` ou MCP `apply_migration`), NUNCA ad-hoc no Studio — mesmo aplicando direto na prod.

Então, o diagnóstico:

1. Run a diagnostic SELECT to see current state
2. For triggers: `SELECT tgname, tgrelid::regclass, tgenabled FROM pg_trigger WHERE tgname LIKE '%pattern%';`
3. For RPCs: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';`
4. Explain what you will change and wait for approval

## Security defaults — ao criar função / RPC / policy / FK

Aprendido dos advisors (05/06/2026). Aplicar SEMPRE, pra não reproduzir débito:

- **Função nova:** sempre `SET search_path = ''` e referenciar objetos com schema explícito (`public.tabela`). Evita `function_search_path_mutable`.
- **RPC nova:** `SECURITY INVOKER` por padrão. `SECURITY DEFINER` só quando realmente precisar elevar privilégio — e aí `REVOKE EXECUTE ON FUNCTION ... FROM anon;` (e de `authenticated` também se for financeira/admin).
- **Policy nova:** uma policy por role/ação. NÃO empilhar `Admin full access` + `Authenticated ...` pro mesmo role/ação (gera `multiple_permissive_policies`).
- **FK nova:** criar índice de cobertura na coluna FK.
- **Depois de QUALQUER DDL:** rodar MCP `get_advisors` (security + performance) e `NOTIFY pgrst, 'reload schema'`.

### Intencional — NÃO "consertar"
Policies de INSERT públicas em `cat_pedidos`, `cat_itens_pedido`, `contatos` = checkout do catálogo público (anon cria pedido/contato). `criar_pedido` executável por anon = idem. NÃO remover sem verificar o fluxo do catálogo (`criar_pedido` é SECURITY DEFINER — pode tornar as policies redundantes, mas confirmar antes).

### Remediado em 05/06/2026 (migration `20260605231500_security_lint_cleanup`)
- `rpc_perfil_extras`: revogado `anon`/`PUBLIC` (tinha escapado do hardening de maio).
- `fn_capitalize_name`, `fn_count_words`, `prevent_delete_automatic_plan`: `SET search_path = ''` (só usam built-ins, seguro).
- Bucket `products`: removida a policy de SELECT público amplo (listagem). `getPublicUrl` não depende dela; escrita segue admin-only.

### Aceito com controle — NÃO revogar
12 funções `SECURITY DEFINER` executáveis por `authenticated` (10 financeiras/admin + `is_admin` + `criar_pedido`). **Já têm guard `is_admin()` interno** (verificado no corpo) — `is_admin()` consulta `public.admin_users`, então não-admin barra. Revogar `authenticated` quebraria o `apps/interno` (chama via sessão autenticada). O guard interno É o controle correto; o lint `0029` é aceito.

### ⚠️ GATE pré-área-do-cliente
Quando clientes passarem a logar (viram `authenticated`), confirmar que o modelo de auth do cliente NUNCA os insere em `public.admin_users` — é isso que mantém o guard `is_admin` válido contra as 12 funções acima. Levantar este gate quando o trabalho da área do cliente começar.

### Débito conhecido remanescente (trilha de performance, sob demanda)
Policies duplas (`Admin full access` + `Authenticated read`), FKs sem índice, índices de auditoria não usados, leaked-password protection (toggle no Dashboard). Prioridade menor que segurança.

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
6. Run `pnpm turbo build`

## Two-Project Architecture

This Supabase is shared with catalogo-mont.
- Tables with `cat_` prefix = catalog project
- Field ownership: `subtitulo`, `categoria` = only internal system edits
- `visivel_catalogo` controls catalog visibility (separate from `ativo`)
- Image tables: `sis_imagens_produto` (internal) + `cat_imagens_produto` (catalog)

## Key Tables

contatos, produtos, vendas, itens_venda, pagamentos_venda, purchase_orders, purchase_order_items, lancamentos, contas, contas_a_pagar, cat_pedidos, cat_itens_pedido

(Nomes verificados contra o schema de produção em 05/06/2026. NÃO existem `lancamentos_caixa`, `contas_caixa` nem `plano_contas`.)
