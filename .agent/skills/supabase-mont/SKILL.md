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

### Remediado em 29/10/2026 (migration `20261029211837_catalogo_fecha_escrita_publica`)
A antiga regra "INSERT público e `criar_pedido` por anon são intencionais" **caiu**: a premissa (checkout do catálogo chama como anon) estava obsoleta desde 01/04/2026 — o único chamador, `apps/catalogo/src/app/api/pedidos/route.ts`, usa **service role**. Com a chave pública dava para criar pedido/venda com qualquer preço e sobrescrever nome/endereço de contato real pelo telefone.
- `criar_pedido`: EXECUTE só `service_role` (revogado de `PUBLIC`, `anon`, `authenticated`).
- Removidas as policies `Public insert orders` (`cat_pedidos`), `Public insert items` (`cat_itens_pedido`), `Public insert access` (`contatos`). Admin escreve pelas policies de admin; Edge Functions e rotas do catálogo usam service role; funções `SECURITY DEFINER` ignoram RLS.
- `anon` sem `INSERT/UPDATE/DELETE` nessas 3 tabelas (defesa em profundidade).
- **NÃO reabrir** escrita pública nessas tabelas nem devolver `criar_pedido` a anon. Checkout público novo (ex.: `apps/loja`) = server action/route handler com service role chamando RPC própria, nunca anon. Rollback (só se o checkout quebrar): `supabase/rollbacks/20261029211837_catalogo_fecha_escrita_publica.rollback.sql`.
- Pendente (Fase 2 da loja, junto com o endereço no pedido): `criar_pedido` ainda sobrescreve nome/endereço de contato existente quando chamado pela rota legítima.

### Remediado em 05/06/2026 (migration `20260605231500_security_lint_cleanup`)
- `rpc_perfil_extras`: revogado `anon`/`PUBLIC` (tinha escapado do hardening de maio).
- `fn_capitalize_name`, `fn_count_words`, `prevent_delete_automatic_plan`: `SET search_path = ''` (só usam built-ins, seguro).
- Bucket `products`: removida a policy de SELECT público amplo (listagem). `getPublicUrl` não depende dela; escrita segue admin-only.

### Aceito com controle — NÃO revogar
11 funções `SECURITY DEFINER` executáveis por `authenticated` (10 financeiras/admin + `is_admin`; `criar_pedido` saiu desta lista em 29/10/2026 — virou só `service_role` e, na verdade, nunca teve guard `is_admin`). **Já têm guard `is_admin()` interno** (verificado no corpo) — `is_admin()` consulta `public.admin_users`, então não-admin barra. Revogar `authenticated` quebraria o `apps/interno` (chama via sessão autenticada). O guard interno É o controle correto; o lint `0029` é aceito.

### ⚠️ GATE pré-área-do-cliente
Quando clientes passarem a logar (viram `authenticated`), confirmar que o modelo de auth do cliente NUNCA os insere em `public.admin_users` — é isso que mantém o guard `is_admin` válido contra as 11 funções acima. Levantar este gate quando o trabalho da área do cliente começar.

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
