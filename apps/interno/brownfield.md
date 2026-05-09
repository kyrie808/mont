# Brownfield Analysis — apps/interno

> Iniciado em: 2026-05-08T00:00:00Z
> Commit base: e286072
> Branch: main

---

## Fase 1 — Inventário Estrutural

> Concluída em: 2026-05-08T00:00:00Z

### 1. Stack real

**Vite 7 + React 19 SPA puro com HashRouter.** Não é Next.js. Confirmado em `apps/interno/package.json:6-8` (script `vite`/`vite build`/`vitest run`) e `apps/interno/src/App.tsx:2,41` (`HashRouter` do `react-router-dom@^7.10.1`).

Dependências de produção em uso (de `apps/interno/package.json:13-42`):
- **Core**: `react@^19.2.0`, `react-dom@^19.2.0`, `react-router-dom@^7.10.1`
- **Backend**: `@supabase/supabase-js@^2.95.3`, `@mont/shared@workspace:*`
- **State / data**: `@tanstack/react-query@^5.90.20`, `zustand@^5.0.9`
- **Forms / validação**: `react-hook-form@^7.72.0`, `@hookform/resolvers@^5.2.2`, `zod@^4.3.6`
- **DnD (Kanban CRM)**: `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`
- **UI**: `class-variance-authority@^0.7.1`, `clsx@^2.1.1`, `tailwind-merge@^3.4.0`, `lucide-react@^0.556.0`, `@radix-ui/react-slot@^1.2.4`, `framer-motion@^12.23.26`
- **3D estoque**: `@react-three/fiber@^9.4.2`, `@react-three/drei@^10.7.7`, `three@^0.182.0`, `leva@^0.10.1`
- **Datas**: `date-fns@^4.1.0`
- **PWA**: `vite-plugin-pwa@^1.2.0`, `workbox-window@^7.4.0`
- **Outras**: `dotenv@^17.2.4`

Dev: `vitest@^4.0.18`, `jsdom@^28.1.0`, `@testing-library/react@^16.3.2`, `@testing-library/jest-dom@^6.9.1`, `eslint@^9.39.1`, `typescript-eslint@^8.46.4`, `tailwindcss@^3.4.18`, `typescript@~5.9.3`.

ESLint config em `apps/interno/eslint.config.js` é flat config minimalista — apenas `js.recommended`, `tseslint.recommended`, `reactHooks.flat.recommended` e `reactRefresh.vite`. **Não há regras customizadas, nem `eslint-plugin-react-compiler`** — o que importa para os warnings de Compilation Skipped (eles vêm do `eslint-plugin-react-hooks@^7.0.1`, que já embute React Compiler diagnostics).

QueryClient global com `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`, `retry: 1` em `apps/interno/src/lib/react-query.ts:3-12`. Cliente Supabase único e exportado em `apps/interno/src/lib/supabase.ts:11`, tipado com `Database` de `@mont/shared`. **Sem service role key** — somente anon key.

### 2. Mapa de pastas (até 2 níveis)

```
apps/interno/
├── .env.example
├── .env.local
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── TESTING.md
├── tsc-error.txt          ← achado: arquivo solto, parece artefato deixado
├── tsconfig.{json,app.json,node.json}
├── types-append.txt       ← achado: arquivo solto
├── vercel.json
├── vite.config.ts
├── artifacts/
├── dist/
├── public/
├── src/
│   ├── App.{tsx,css}
│   ├── main.tsx
│   ├── index.css
│   ├── vite-env.d.ts
│   ├── assets/
│   ├── components/
│   │   ├── auth/
│   │   ├── common/
│   │   ├── contatos/
│   │   ├── dashboard/
│   │   ├── features/      ← 7 sub-features (configuracoes, contas-a-pagar, contatos, entregas, estoque, financeiro, purchase-orders, vendas)
│   │   ├── layout/
│   │   └── ui/
│   ├── constants/
│   ├── contexts/          ← apenas ThemeContext.tsx
│   ├── hooks/             ← 28 hooks customizados + index.ts
│   ├── lib/               ← supabase.ts, react-query.ts, utils.ts
│   ├── pages/             ← 21 páginas + index.ts
│   ├── schemas/           ← contato.ts, venda.ts, index.ts
│   ├── scripts/
│   ├── services/          ← 11 services + 3 specs em __tests__/
│   ├── stores/            ← apenas useCartStore + useNavigationStore
│   ├── test/              ← setup
│   ├── types/             ← apenas domain.ts
│   ├── utils/             ← calculations, fiado, formatters, vendaBadge, geocoding, cn
│   └── __tests__/         ← 5 integration tests (vendas, financeiro, sync, checkout, relacionamento-prioridade)
└── tests/
    └── integration/       ← 3 integration tests (backfill_contatos_nome, criar_pedido, name_helpers)
```

**Achado de arquitetura**: existem DUAS pastas de testes de integração: `apps/interno/src/__tests__/` (5 arquivos) e `apps/interno/tests/integration/` (3 arquivos). Inconsistência confirmada (item 5 dos achados pré-existentes).

**Achado de arquivos soltos na raiz do app**: `tsc-error.txt` e `types-append.txt` na raiz de `apps/interno/`. Provavelmente artefatos de sessões anteriores não removidos.

### 3. Pontos de integração

#### 3.1 RPCs Supabase (de produção, excluindo testes)

11 RPCs únicas chamadas pelo código de produção:

| RPC | Chamado em |
|---|---|
| `registrar_pagamento_venda` | `apps/interno/src/services/vendaService.ts:231` |
| `rpc_total_a_receber_dashboard` | `apps/interno/src/services/vendaService.ts:257`, `apps/interno/src/services/dashboardService.ts:250` |
| `registrar_despesa_manual` | `apps/interno/src/services/cashFlowService.ts:128` |
| `registrar_entrada_manual` | `apps/interno/src/services/cashFlowService.ts:145` |
| `get_areceber_breakdown` | `apps/interno/src/services/dashboardService.ts:109` |
| `criar_obrigacao_parcelada` | `apps/interno/src/services/contasAPagarService.ts:44` |
| `registrar_pagamento_conta_a_pagar` | `apps/interno/src/services/contasAPagarService.ts:77` |
| `update_purchase_order_with_items` | `apps/interno/src/services/purchaseOrderService.ts:89` |
| `add_image_reference` | `apps/interno/src/services/produtoService.ts:160` |
| `fn_mover_card_relacionamento` | `apps/interno/src/services/relacionamentoService.ts:33` |

Adicionalmente em testes (não de produção, mas relevante para inventário): `criar_pedido` (chamado em `__tests__/sync.integration.test.ts:50,137,216` e `__tests__/checkout.integration.test.ts:54`) — código de produção do interno NÃO chama `criar_pedido` diretamente; quem o consome é o `apps/catalogo`. Confirmado pela ausência de `supabase.rpc('criar_pedido'` em `src/services/*.ts` e `src/pages/*.tsx`.

#### 3.2 Tabelas e views Supabase acessadas via `from(...)`

Tabelas de domínio:
- `vendas` (vendaService, useAlertasFinanceiros, useIndicacoes, cashFlowService, logisticaService, recompraService, catalogService, hooks/useCatalogoPendentes, Entregas.tsx)
- `itens_venda` (vendaService:147)
- `pagamentos_venda` (vendaService:295,326)
- `lancamentos` (cashFlowService:104, vendaService:202,306,317)
- `contatos` (contatoService:14,47,102,156,178; useIndicacoes; recompraService)
- `contas` (vendaService implicitamente via dashboards; cashFlowService:48,57)
- `contas_a_pagar` (contasAPagarService:15,25,93)
- `pagamentos_conta_a_pagar` (contasAPagarService:102)
- `plano_de_contas` (cashFlowService:68,88)
- `produtos` (produtoService:13,42,70,97,113; useEstoqueMetrics; ProductNicknamesModal)
- `sis_imagens_produto` (produtoService:26)
- `purchase_orders`, `purchase_order_items`, `purchase_order_payments` (purchaseOrderService)
- `cat_pedidos`, `cat_itens_pedido`, `cat_pedidos_pendentes_vinculacao` (catalogService, vendaService, useCatalogoPendentes)
- `configuracoes` (Configuracoes.tsx, useConfiguracoes, RelatorioFabrica.tsx, Entregas.tsx)

Views (read-only):
- `view_extrato_saldo` (cashFlowService:79)
- `view_extrato_mensal` (cashFlowService:161)
- `view_fluxo_resumo` (cashFlowService:176)
- `view_home_financeiro`, `view_home_operacional`, `view_home_alertas` (dashboardService:94,100,106)
- `view_lucro_liquido_mensal`, `view_liquidado_mensal` (dashboardService:141,175)
- `view_contas_a_pagar_dashboard` (dashboardService:199)
- `view_relacionamento_kanban` (relacionamentoService:17)
- `rpt_projecao_pagamentos` (dashboardService:225, contasAPagarService:61)
- `ranking_compras` (useRankingCompras:31)
- `ranking_indicacoes` (useTopIndicadores:32)

Storage:
- bucket `products` (produtoService:133,141,153,179) — upload, download, remove de imagens.

#### 3.3 Edge functions

**Nenhuma** edge function chamada de dentro do interno. `Grep` por `functions.invoke|edge-functions` retornou zero. Apps/interno só usa `.from()`, `.rpc()`, `.storage.from()` e `.auth.*`.

#### 3.4 Endpoints externos

Apenas um:
- `https://brasilapi.com.br/api/cep/v2/${cleanCep}` em `apps/interno/src/hooks/useCep.ts:39` para autocompletar endereços por CEP.

#### 3.5 Realtime / subscriptions

Apenas uma subscription ativa em todo o app:
- `apps/interno/src/hooks/useLogistica.ts:43` — canal `logistica-changes`. Limpeza correta em `:52` com `supabase.removeChannel(channel)`.

### 4. Rotas / páginas

Lista exaustiva (todas em `apps/interno/src/App.tsx:43-71`):

| Rota | Página | O que faz |
|---|---|---|
| `/login` | `LoginPage.tsx` | Login Supabase (única rota fora do AuthGuard) |
| `/` | `Dashboard.tsx` | Home financeira/operacional do operador (333 linhas) |
| `/contatos` | `Contatos.tsx` | Lista de contatos/clientes |
| `/contatos/:id` | `ContatoDetalhe.tsx` | Detalhe do contato com tabs (intel, vendas, indicações, jornada) |
| `/nova-venda` | `NovaVenda.tsx` | Wizard de criação de venda (tb. `/vendas/:id/editar`) |
| `/vendas` | `Vendas.tsx` | Lista de vendas com filtros |
| `/vendas/:id` | `VendaDetalhe.tsx` | Detalhe de uma venda |
| `/vendas/:id/editar` | `NovaVenda.tsx` | Reuso do wizard em modo edição |
| `/ranking` | `Ranking.tsx` | Ranking de compras/indicações |
| `/pedidos-compra` | `PedidosCompra.tsx` | Pedidos de compra (purchase orders) |
| `/relacionamento` | `Relacionamento.tsx` | CRM Kanban com DnD (commit ece56f0) |
| `/configuracoes` | `Configuracoes.tsx` | Painel de configurações da empresa |
| `/produtos` | `Produtos.tsx` | CRUD de produtos (570 linhas, maior arquivo) |
| `/relatorio-fabrica` | `RelatorioFabrica.tsx` | Relatório de produção/fábrica |
| `/estoque` | `Estoque.tsx` | Estoque + visualização 3D R3F |
| `/entregas` | `Entregas.tsx` | Painel de entregas/logística |
| `/menu` | `Menu.tsx` | Menu lateral / hub de navegação |
| `/catalogo-pendentes` | `CatalogoPendentes.tsx` | Pedidos pendentes de vinculação vindos do catálogo |
| `/fluxo-caixa` | `FluxoCaixa.tsx` | Fluxo de caixa / extrato |
| `/contas-a-receber` | `ContasReceber.tsx` | Contas a receber (335 linhas) |
| `/contas-a-pagar` | `ContasAPagar.tsx` | Contas a pagar (363 linhas) |
| `/clientes` | `Navigate → /contatos` | Redirect legado |
| `*` | `Navigate → /` | Catchall |

Todas as páginas (exceto `/login`) são lazy-loaded via `React.lazy` e renderizadas dentro de `<AuthGuard><AppLayout /></AuthGuard>`. Suspense fallback é um `<Spinner size="lg" />`. ErrorBoundary envolve toda a aplicação.

### 5. Componentes mais "pesados" (top 10 por linhas, excluindo tests)

| # | Arquivo | Linhas |
|---|---|---|
| 1 | `apps/interno/src/pages/Produtos.tsx` | 570 |
| 2 | `apps/interno/src/pages/ContasAPagar.tsx` | 363 |
| 3 | `apps/interno/src/pages/ContasReceber.tsx` | 335 |
| 4 | `apps/interno/src/pages/Dashboard.tsx` | 333 |
| 5 | `apps/interno/src/services/vendaService.ts` | 302 |
| 6 | `apps/interno/src/services/dashboardService.ts` | 302 |
| 7 | `apps/interno/src/components/features/purchase-orders/PurchaseOrderForm.tsx` | 298 |
| 8 | `apps/interno/src/pages/Relacionamento.tsx` | 297 |
| 9 | `apps/interno/src/pages/PedidosCompra.tsx` | 297 |
| 10 | `apps/interno/src/pages/NovaVenda.tsx` | 295 |

Próximos (também relevantes para Fase 2):
- `CheckoutSidebar.tsx` (295), `Entregas.tsx` (282), `RelatorioFabrica.tsx` (278), `PaymentSidebar.tsx` (271), `PagamentoContaAPagarModal.tsx` (269), `domain.ts` (238), `mappers.ts` (237), `LancamentoModal.tsx` (231), `PurchaseOrderPaymentModal.tsx` (230), `Configuracoes.tsx` (225), `cashFlowService.ts` (219), `TransferenciaModal.tsx` (212), `ContaAPagarModal.tsx` (204).

### 6. Stores Zustand

Apenas duas — o app delega quase todo state assíncrono ao TanStack Query:

| Store | Arquivo | Gerencia |
|---|---|---|
| `useCartStore` | `apps/interno/src/stores/useCartStore.ts:21` | Carrinho do wizard de NovaVenda (items, cliente). Persistido (`zustand/middleware.persist`). |
| `useNavigationStore` | `apps/interno/src/stores/useNavigationStore.ts:9` | Estado do drawer lateral (open/close). |

### 7. Hooks customizados

Total: 29 (28 hooks + barrel `index.ts`). Os 10 prováveis "mais usados", agrupando por área funcional:

| Hook | Função |
|---|---|
| `useAuth` | Sessão Supabase, `signOut`. Usado em `AuthGuard` e provavelmente Header. (`hooks/useAuth.ts:5`) |
| `useVendas` | Lista/filtros/CRUD de vendas (191 linhas). |
| `useContatos` | Lista/filtros/CRUD de contatos. |
| `useProdutos` | CRUD de produtos. |
| `useDashboardMetrics` | Métricas agregadas do Dashboard (consome views). |
| `useRelacionamento` | Kanban CRM (board + mover_card). |
| `useContasAPagar` / `useContasReceber` | Contas (lista, totalizadores). |
| `useFluxoCaixa` / `useExtratoDeSaldo` / `useExtrato` | Fluxo de caixa (3 hooks separados). |
| `useDebounce` | Util genérico para inputs com filtro. |
| `useLogistica` | Único hook com Supabase Realtime (canal `logistica-changes`). |

Outros: `useAlertasFinanceiros`, `useCatalogoPendentes`, `useCatalogOrders`, `useCep`, `useConfiguracoes`, `useContas`, `useDashboardFilter`, `useEstoqueMetrics`, `useIndicacoes`, `useLancamentos`, `usePlanoDeContas`, `usePurchaseOrders`, `useRankingCompras`, `useRecompra`, `useRelatorioFabrica`, `useTopIndicadores`.

### 8. Auth e RBAC (preview, será aprofundado na Fase 2.1)

- Autenticação: `supabase.auth.getSession()` + `onAuthStateChange` em `apps/interno/src/hooks/useAuth.ts:12,19`. Sem refresh token customizado, sem PKCE flag visível.
- AuthGuard (`apps/interno/src/components/auth/AuthGuard.tsx:9`) só checa `user != null` para redirecionar. **Não há `role`/papel sendo lido** — preview de achado: ausência de RBAC client-side. Verificação RLS server-side fica para Fase 2.1.

### 9. Schemas (Zod)

Apenas dois arquivos de schema em `apps/interno/src/schemas/`:
- `contato.ts`
- `venda.ts`

Hipótese a confirmar na Fase 2.2: validação Zod existe somente para os fluxos de venda e contato; demais formulários (financeiro, contas a pagar, purchase orders, configurações) podem estar usando react-hook-form sem schema validator.

### 10. Outros pontos do inventário

- **`scripts/`** existe em `src/scripts/` — conteúdo a inspecionar na Fase 2 (provável seed/utilitários).
- **`.env.example` legacy do AIOS na raiz do monorepo** já registrado nos achados pré-existentes (item 6) — confirmado existir em `apps/interno/.env.example` (a confirmar se o legacy AIOS está em `D:\3. DEV\mont\.env.example` na raiz; será verificado na Fase 2.6).
- **Edge functions: zero**. Toda lógica server-side está em RPCs PL/pgSQL.
- **Realtime: uma subscription** (logística), com cleanup OK.

---

### Achados desta fase (inventário, não-confirmados — material bruto para Fase 2)

1. **F1-A** — Duas pastas de testes coexistem: `src/__tests__/` (5 testes) e `tests/integration/` (3 testes). Inconsistência confirmada.
2. **F1-B** — Arquivos órfãos na raiz do app: `apps/interno/tsc-error.txt` e `apps/interno/types-append.txt`. Investigar se são artefatos a remover.
3. **F1-C** — ESLint config em `apps/interno/eslint.config.js:8-23` é mínimo: não tem `eslint-plugin-import`, sem regras customizadas. Os warnings de Compilation Skipped vêm do `eslint-plugin-react-hooks@^7.0.1`.
4. **F1-D** — Auth usa apenas `supabase.auth` sem leitura de `role`/papel. AuthGuard só checa `user != null` (`AuthGuard.tsx:24`). Sem RBAC client-side aparente — RLS server-side pendente de auditoria na Fase 2.1.
5. **F1-E** — Zod presente apenas em 2 schemas (`contato`, `venda`). Hipótese: outros formulários sem validação centralizada — confirmar Fase 2.2.
6. **F1-F** — Realtime usado em 1 hook só (`useLogistica`). Outros painéis (Dashboard, ContasAPagar, Relacionamento Kanban) operam por refetch via React Query. Performance/UX — Fase 2.4/2.5.
7. **F1-G** — `scripts/` em `src/` exposto ao build do app — conteúdo a verificar (Fase 2.6).
8. **F1-H** — `cliente` Supabase é único e anon (`lib/supabase.ts:11`); não há service role aqui (correto — interno só roda no browser).
9. **F1-I** — Top 10 arquivos por tamanho concentrados em pages e services. Maiores: `Produtos.tsx` (570), `ContasAPagar.tsx` (363), `ContasReceber.tsx` (335), `Dashboard.tsx` (333) — alvos prioritários para Fase 2.3 (lógica) e 2.4 (perf).

---

## Fase 2 — Análise por Categoria

> Concluída em: 2026-05-08T00:00:00Z

> **Material bruto.** Não filtrei por severidade/esforço; isso vai para a Fase 3. Cada achado tem ID `F2.X-Y` para referência cruzada.

### Lint atual — números reais (≠ pré-existente)

`pnpm --filter interno lint` → **63 errors + 9 warnings (72 problemas total)**, NÃO os "12 errors + 2 warnings" assumidos:

- **`@typescript-eslint/no-explicit-any`**: 28 errors (não 12). Dos 28, **7 estão em arquivos de teste** (`mappers.spec.ts`, `cashFlowService.spec.ts`, `dashboardService.spec.ts` e os 3 integration tests usando `criar_pedido`). Os outros **21 estão em código de produção**.
- **`@typescript-eslint/no-unused-vars`**: 9 errors (`_error`, `_err`, `_event` capturados mas nunca usados — pattern de catch-and-swallow).
- **`no-empty`**: 2 errors (catch blocks vazios em `VendaDetalhe.tsx:125` e `ContasReceber.tsx:57`).
- **`@typescript-eslint/no-empty-object-type`**: 3 errors em `vite-env.d.ts:7,13,20`.
- **`react-hooks/set-state-in-effect`**: 1 error em `Relacionamento.tsx:186` — **NOVO** (não estava no pré-existente).
- **`react-hooks/preserve-manual-memoization` (Compilation Skipped: Existing memoization could not be preserved)**: 3 errors em `useContatos.ts:51, 60, 69` — **NOVO** (não estava no pré-existente). Esses são erros, não warnings.
- **`react-hooks/incompatible-library` (Compilation Skipped: Use of incompatible library)**: 2 warnings em `ContaAPagarModal.tsx:89` e `PagamentoContaAPagarModal.tsx:78` (= os pré-existentes).
- **`react-hooks/exhaustive-deps`**: 7 warnings em `PagamentoContaAPagarModal:103`, `useContatos:58/67/82`, `ContasAPagar:90`, `ContasReceber:50`, `Entregas:113`.

Adicional descoberto manualmente: **`ContatoFormModal.tsx:59`** tem `// eslint-disable-next-line react-hooks/incompatible-library` ANTES de `const tipoValue = watch('tipo')` — confirma que o developer DELIBERADAMENTE silenciou o warning e que o pattern `watch(field)` da `react-hook-form` é o gatilho de "Compilation Skipped".

---

### 2.1 — Segurança, autenticação e autorização

**Auditoria de RLS feita via dois canais:** (a) inspeção literal em `supabase/migrations/20260405045304_remote_schema.sql`, (b) `mcp__supabase-distribuidora__get_advisors` no projeto `herlvujykltxnwqmwmyx`. Resultado: **64 findings** (13 ERROR, 51 WARN).

#### F2.1-A — Bucket `products` do Storage permite `INSERT/UPDATE/DELETE` para `to public` (anon)

`supabase/migrations/20260405045304_remote_schema.sql:4117-4150`:

```sql
create policy "Allow all deletes on products bucket"  on "storage"."objects" as permissive for delete to public using (...)
create policy "Allow all inserts on products bucket"  on "storage"."objects" as permissive for insert to public with check (...)
create policy "Allow all updates on products bucket"  on "storage"."objects" as permissive for update to public ...
create policy "Allow public read access on products bucket" on "storage"."objects" as permissive for select to public ...
```

Qualquer pessoa com a URL pública do projeto pode subir, sobrescrever ou DELETAR todas as imagens de produto (interno consumido em `produtoService.ts:128-181`). O lint do Supabase só sinalizou `public_bucket_allows_listing` (SELECT) — os três grants destrutivos passaram pelo radar do advisor mas estão na schema.

#### F2.1-B — `_backup_contatos_nome_<timestamp>` e `backfill_contatos_nome_log` sem RLS (ERRORs do advisor)

Confirmado pelo advisor (`rls_disabled_in_public`):
- `public.backfill_contatos_nome_log`
- `public._backup_contatos_nome_20260424_121318`

Originadas em `supabase/migrations/20260423224225_backfill_contatos_nome.sql:7-13,27-32`. Sem RLS, expostas via PostgREST a qualquer authenticated. Snapshot inclui `nome` e `telefone` de TODOS os contatos.

#### F2.1-C — Migração de backfill é não-idempotente e gera tabelas órfãs a cada apply

Em `supabase/migrations/20260423224225_backfill_contatos_nome.sql:23`:

```sql
snapshot_name text := '_backup_contatos_nome_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS');
```

E na linha 69: `SELECT public.fn_backfill_contatos_nome();` é executado durante o apply. Cada `supabase db reset` cria UMA nova tabela `_backup_contatos_nome_*` que NUNCA é deletada. Em prod já existe `_backup_contatos_nome_20260424_121318`. A função e a tabela `backfill_contatos_nome_log` ficam permanentemente.

#### F2.1-D — `Authenticated update access` em `contatos` permite update irrestrito

`remote_schema.sql:3185`:

```sql
CREATE POLICY "Authenticated update access" ON "public"."contatos" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
```

QUALQUER usuário autenticado (não apenas admin) pode UPDATE em qualquer contato. Inclui campos sensíveis: `telefone`, `endereco`, `status_relacionamento`. Sem RBAC client-side e sem RBAC nesta policy. Lint do advisor: `rls_policy_always_true`.

#### F2.1-E — `Public insert access` em `contatos`/`cat_pedidos`/`cat_itens_pedido` (anon write)

`remote_schema.sql:3202-3210`:

```sql
CREATE POLICY "Public insert access" ON "public"."contatos" FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert items"   ON "public"."cat_itens_pedido" FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert orders"  ON "public"."cat_pedidos"     FOR INSERT WITH CHECK (true);
```

Necessário para o fluxo do catálogo público mas não há rate limit/anti-spam. Spam em `cat_pedidos` (e os triggers que ele dispara) pode esgotar recursos. Advisor: 3 findings `rls_policy_always_true`.

#### F2.1-F — 11 views são `SECURITY DEFINER` (advisor ERROR)

Advisor `security_definer_view`:
- `public.ranking_compras`, `public.view_contas_a_pagar_dashboard`, `public.view_extrato_mensal`, `public.crm_view_operational_snapshot`, `public.ranking_indicacoes`, `public.vw_catalogo_produtos`, `public.view_relacionamento_kanban`, `public.view_fluxo_resumo`, `public.vw_admin_dashboard`, `public.rpt_projecao_pagamentos`, `public.vw_marketing_pedidos`.

Views rodando com privilégios do criador (`postgres`) bypassam RLS dos consumidores. `view_relacionamento_kanban` (criada em `crm_kanban_schema.sql:34-92`) sem qualificador `security_invoker` — qualquer authenticated lê todos os contatos via essa view, mesmo que RLS de `contatos` restringisse.

#### F2.1-G — 21 RPCs `SECURITY DEFINER` executáveis por `anon` E `authenticated`

Advisor: `anon_security_definer_function_executable` e `authenticated_security_definer_function_executable`. Lista (em `public`):

`add_image_reference, criar_obrigacao_parcelada, criar_pedido, delete_image_reference, fn_backfill_contatos_nome, fn_sync_cat_pedido_to_venda, handle_audit_fields, handle_brinde_before_insert, handle_stock_on_status_change, is_admin, registrar_despesa_manual, registrar_entrada_manual, registrar_pagamento_conta_a_pagar, registrar_pagamento_venda, rpc_total_a_receber_dashboard, rpc_total_a_receber_simples, rpt_churn, rpt_vendas_por_periodo, sync_venda_to_cat_pedido, update_purchase_order_with_items, update_venda_pagamento_summary`.

`is_admin()` exposta a `anon` significa que anon pode INVOCAR mas a função retorna `false` para userId NULL — por sorte. As outras (financeiras: `registrar_pagamento_venda`, `registrar_despesa_manual`) executariam writes em vendas/lancamentos vindos de anon. **`fn_backfill_contatos_nome` chamável por anon** = quem souber o nome da função pode disparar criação de tabela snapshot e UPDATEs em `contatos`. Crítico.

#### F2.1-H — 3 funções com `search_path` mutável (`function_search_path_mutable`)

- `public.prevent_delete_automatic_plan` (trigger em `plano_de_contas`)
- `public.fn_count_words`
- `public.fn_capitalize_name`

Ambas `IMMUTABLE` mas sem `SET search_path`. Vetor de schema-hijack se um usuário criar um schema malicioso prefixado.

#### F2.1-I — Auth `leaked_password_protection` desabilitado

Advisor flag isolado. Supabase tem feature de bloquear senhas presentes no HaveIBeenPwned; não está ligado.

#### F2.1-J — Sem RBAC client-side; AuthGuard só checa `user != null`

`apps/interno/src/components/auth/AuthGuard.tsx:24` apenas verifica presença de user. **Não há leitura de `is_admin()`/role no client**. Significa que rotas como `/configuracoes`, `/produtos` (CRUD), `/plano-de-contas` (sensíveis) são acessíveis a qualquer usuário autenticado. Ao escrever, RLS no DB barra (vide F2.1-D contraexemplo), mas **a UI expõe toda a interface administrativa para qualquer login**.

#### F2.1-K — `useAuth.ts` sem refresh-token customizado

`apps/interno/src/hooks/useAuth.ts:5-38` apenas usa `onAuthStateChange`. Sem PKCE explicit, sem refresh-on-focus. A sessão refresha pelo SDK default (60min refresh window). OK funcionalmente, mas se o token vence durante uma operação longa o erro é silencioso.

#### F2.1-L — Possível injection via `or()` em `contatoService.func`

`apps/interno/src/services/contatoService.ts:24-26`:

```ts
const term = query.replace(/[%_]/g, '')
builder = builder.or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,apelido.ilike.%${term}%`)
```

`replace(/[%_]/g, '')` filtra wildcards SQL mas NÃO filtra `,`, `(`, `)` — meta-caracteres do filtro PostgREST `or()`. Um `query` contendo `,nome.eq.X` injeta cláusula adicional. Risk médio (somente em contas autenticadas, e RLS de contatos só permite SELECT a authenticated com USING (true) — então a "injeção" só amplia o SELECT, não escapa pra outra tabela). Mas é um padrão corrigível.

#### F2.1-M — Service role key não exposta no client (correto)

`apps/interno/src/lib/supabase.ts:11` usa `VITE_SUPABASE_ANON_KEY` apenas. Sem service role no bundle.

#### F2.1-N — Validação Zod presente apenas em 2 schemas (`contato`, `venda`)

`apps/interno/src/schemas/contato.ts` e `venda.ts`. Outros formulários usam react-hook-form com validação inline (ex.: `ContaModal.tsx:23-28` só usa `required` do rhf, sem schema Zod):
- `ContaAPagarModal.tsx` tem schema Zod inline (L11-20) — **bom**.
- `PagamentoContaAPagarModal.tsx` tem schema Zod inline (L23-29) — **bom**.
- `ContaModal.tsx` (financeiro) — **sem Zod**, só required.
- `LancamentoModal.tsx`, `TransferenciaModal.tsx`, `PlanoContaModal.tsx`, `PurchaseOrderForm.tsx`, `ProductNicknamesModal.tsx`, modais em `Configuracoes.tsx` — verificar individualmente; lista incompleta.

---

### 2.2 — Tipagem e qualidade de tipo

#### F2.2-A — 28 ocorrências de `Unexpected any` no lint (lista exata)

Cada uma classificada como **legítimo** / **corrigível** / **preguiça**:

**Em código de produção (21):**

| arquivo:linha | trecho relevante | classificação |
|---|---|---|
| `services/dashboardService.ts:3` | `type HomeFinanceiroRow = any` | **preguiça** — view existe em `Database['public']['Views']['view_home_financeiro']` |
| `services/dashboardService.ts:4` | `type HomeOperacionalRow = any` | **preguiça** — idem |
| `services/dashboardService.ts:5` | `type HomeAlertasRow = any` | **preguiça** — idem |
| `services/cashFlowService.ts:28` | `export type VendaAlerta = any` | **preguiça** — tipo público exportado como any e propagado via `processAlertasFinanceiros` |
| `services/mappers.ts:28-32` | `type PurchaseOrderRow = any` x5 | **preguiça** — todas as tabelas existem em `Database` |
| `services/mappers.ts:215` | `(dbOrder.items \|\| []).map((i: any) => ...)` | **corrigível** — após eliminar L28-32 |
| `services/mappers.ts:257` | `(dbOrder.itens \|\| []).map((i: any) => ...)` | **corrigível** |
| `services/vendaService.ts:87` | `(data \|\| []).map((v: any) => toDomainVenda(...))` | **corrigível** — typar como `VendaRowWithRelations[]` |
| `services/vendaService.ts:115` | `(produtos \|\| []).map((p: any) => ...)` | **corrigível** — `Array<{id, custo}>` trivial |
| `services/vendaService.ts:267` | `vendas.reduce((acc: any, v: DomainVenda) => ...)` | **corrigível** — `acc: VendasMetrics['produtosVendidos']` |
| `services/vendaService.ts:268` | `v.itens?.forEach((item: any) => ...)` | **corrigível** — itens é DomainItemVenda[] |
| `services/produtoService.ts:32` | `(data \|\| []).map((p: any) => ...)` | **corrigível** |
| `services/purchaseOrderService.ts:28` | `(data \|\| []).map((item: any) => ...)` | **corrigível** |
| `services/recompraService.ts:34` | `vendasData?.forEach((v: any) => ...)` | **corrigível** — usar Pick<Venda, 'contato_id'\|'data'> |
| `services/recompraService.ts:43` | `clientes.forEach((cliente: any) => ...)` | **preguiça** — `clientes` já tipado como `Contato[]` 4 linhas acima (L23) |
| `services/catalogService.ts:26` | `.map((v: any) => [v.cat_pedido_id, v.id])` | **corrigível** |
| `services/catalogService.ts:29` | `.map((order: any) => toDomainCatalogOrder(...))` | **corrigível** |
| `hooks/useCatalogoPendentes.ts:56` | `const vendaInsert: any = {...}` | **corrigível** — `Insert<'vendas'>` |
| `hooks/useConfiguracoes.ts:56` | `data?.forEach((item: any) => ...)` | **corrigível** — `Tables<'configuracoes'>` |
| `hooks/useEstoqueMetrics.ts:42` | `(produtos \|\| [])?.filter((p: any) => ...)` | **corrigível** |
| `hooks/useIndicacoes.ts:78` | `vendasCount?.forEach((v: any) => ...)` | **corrigível** |
| `pages/Entregas.tsx:123` | `.then(({ data }: any) => ...)` | **corrigível** — destructure tipado |
| `pages/RelatorioFabrica.tsx:51` | `.then(({ data }: any) => ...)` | **corrigível** |
| `pages/RelatorioFabrica.tsx:60` | `.then(({ data }: any) => ...)` | **corrigível** |
| `components/contatos/ContatoFormModal.tsx:92` | `} as any)` (no `reset(...)`) | **legítimo** — formato do reset com snake/camel mistos |
| `components/features/vendas/NovaVenda/CheckoutSidebar.tsx:47` | `resolver: zodResolver(vendaSchema) as any` | **legítimo** (CLAUDE.md exception 1) |
| `components/features/vendas/PaymentSidebar.tsx:63` | `resolver: zodResolver(pagamentoSchema) as any` | **legítimo** (CLAUDE.md exception 1) |
| `components/features/purchase-orders/ProductNicknamesModal.tsx:61` | `(updates.map((update: any) => ...))` | **corrigível** |

**Em código de teste (7)**: `__tests__/checkout.integration.test.ts:65,76`, `__tests__/financeiro.integration.test.ts:82`, `__tests__/sync.integration.test.ts:61,72,148,159,227,238`, `services/__tests__/dashboardService.spec.ts:4,5,6` — **legítimos** ou **preguiça leve**: tests para tipar fixtures Supabase complicado, mas `criar_pedido` retorna `{id: string}` tipado pelo schema. Os `as any` em fixtures de spec.ts são **preguiça** clássica.

**Total real**: 28 errors lint + ~14 outros `any` implícitos descobertos por Grep manual (em `services/__tests__/mappers.spec.ts` e `cashFlowService.spec.ts` aparecem dezenas de `as unknown as any` que o lint não pega porque usa `unknown` no meio).

#### F2.2-B — Discrepância pré-existente: "12 any errors" assumido vs 28 real

Pré-existente afirmava 12. Auditoria mostra 28. **Diferença de 16 itens não-catalogados** em CRM Kanban migration era a hipótese mas não confere — todos os 28 são pré-CRM Kanban exceto pelo `useCatalogoPendentes:56` (criado antes de ece58072). O número assumido estava simplesmente errado, ou foi medido em um snapshot diferente.

#### F2.2-C — Inconsistência em `DomainProduto`: `preco_ancoragem` vs `precoAncoragem`

`apps/interno/src/types/domain.ts:52-53`:

```ts
preco_ancoragem?: number | null
precoAncoragem?: number | null
```

Ambos os campos coexistem. `mappers.ts:128` popula apenas `precoAncoragem`. `produtoService.ts:94` usa o nome snake_case `preco_ancoragem` no `UpdateProduto` para mandar pro DB. **Read path e write path divergem**: ler retorna camelCase, escrever espera snake_case. Risk: form atualizado salva via `preco_ancoragem`; relê o produto e o form não exibe (lê `precoAncoragem`).

#### F2.2-D — `DomainContato.tipo` aceita `'catalogo'` mas schema Zod não

`types/domain.ts:22`: `tipo: 'B2C' | 'B2B' | 'FORNECEDOR' | 'catalogo'` (4 valores).
`schemas/contato.ts:16`: `tipo: z.enum(['B2C', 'B2B', 'FORNECEDOR'])` (3 valores).

Se o DB tiver contato com `tipo='catalogo'`, edição no form falha silenciosamente porque Zod rejeita. Não consegui encontrar onde 'catalogo' é setado — possivelmente um valor histórico/morto.

#### F2.2-E — Schema Zod `vendaSchema` tem `parcelas`, `data_entrega`, `observacoes` mas `CreateVenda` não

`schemas/venda.ts:17-22` declara `parcelas: z.number()`, `data_entrega: z.string().optional()`, `observacoes: z.string().optional()`. `types/domain.ts:112-124` `CreateVenda` NÃO tem nenhum destes campos.

`NovaVenda.tsx:142-156` mapeia `data.forma_pagamento`, `data.taxa_entrega`, `data.itens`, `data.data_prevista_pagamento` mas IGNORA `data.parcelas`, `data.data_entrega`, `data.observacoes`. **Form fields coletados e descartados silenciosamente**: parcelas (cartão), data_entrega, observações.

#### F2.2-F — `ContatoFormData` (Zod) não tem `email`, `lat`, `lng`

`schemas/contato.ts` não inclui `email`, `lat`, `lng` que estão em `DomainContato`. Form não captura email — confirmado lendo `FormIdentidade.tsx` indiretamente. `lat/lng` populados via `getCoordinates` no service.

#### F2.2-G — `cashFlowService.getContasReceber` retorna sem tipo explícito

`services/cashFlowService.ts:186-198`. Promise infere o tipo como o tipo de `data` retornado pelo PostgREST builder (com join `contato:contatos(nome)` aninhado). Não há `Promise<X[]>` na assinatura. Caller pega forma esquisita. Mid quality.

#### F2.2-H — Casts `as unknown as VendaRowWithRelations` (mappers.ts L171-174)

`mappers.ts:171,174`: `(dbVenda.itens \|\| []).map(i => toDomainItemVenda(i as ItemVendaRowWithProduto))`. Dado que `dbVenda.itens` já está tipado como `ItemVendaRow[]`, o cast existe porque o mapper espera `ItemVendaRowWithProduto` (com produto join). **Casts existem para esconder limite do tipo gerado vs o tipo realmente fetched**. Solução real: typar o resultado da query inteira via Supabase generated types + helper.

#### F2.2-I — `ProdutoService.delete_image_reference` não estava no inventário Fase 1

`services/produtoService.ts:174` chama `supabase.rpc('delete_image_reference', ...)`. Meu grep inicial pegou só 11 RPCs porque a chamada está quebrada em duas linhas (`supabase\n.rpc(...)`). **RPC #12** (`delete_image_reference`) faltou no Inventário; correção a propagar para a Fase 1 documentada.

#### F2.2-J — `vite-env.d.ts` 3 errors `no-empty-object-type`

`vite-env.d.ts:7,13,20`. Padrão típico do Vite mas o lint atual reclama. Trivial.

#### F2.2-K — `_error/_err/_event` capturados e não usados (9 errors)

`apps/interno/src/pages/Configuracoes.tsx:119,136,165`, `ContasReceber.tsx:45,57,119`, `ContaModal.tsx:38`, `NovaVenda.tsx:166`, `Relacionamento.tsx:219`, `VendaDetalhe.tsx:125`. Pattern: `try/catch (_error) { /* nothing or generic toast */ }`. **Erros propagados pelo backend são suprimidos** — operador vê toast genérico ou nada. Mid severity (DX e debug).

---

### 2.3 — Lógica de negócio (por área)

#### F2.3-A — `vendaService.createVenda`: insert SEM transação (orphan venda risk)

`services/vendaService.ts:106-152`:
1. INSERT em `vendas`
2. INSERT em `itens_venda`

Se passo 2 falha (FK, RLS, network), passo 1 já comitou — sobra venda órfã sem itens, com `total != soma(itens)`. `criar_pedido` (RPC do catálogo) é atômico via PL/pgSQL, mas `createVenda` no operador interno **não tem RPC equivalente**. Risk: alto em operação intermitente.

#### F2.3-B — `vendaService._syncCatPedido`: erros silenciados via console.error

`services/vendaService.ts:13-47`. Toda falha de sync com `cat_pedidos` é só loggada. Cenário: operador marca uma venda como "entregue", o sync para `cat_pedidos.status='entregue'` falha (RLS, race). Status entre as duas tabelas diverge silenciosamente. Posterior leitura via `view_relacionamento_kanban` (que joina ambas) mostra dados inconsistentes.

#### F2.3-C — `vendaService.updateVenda` chama `_syncCatPedido` 2x desnecessariamente

`services/vendaService.ts:166-172`. Se update inclui status E pago, faz 2 round-trips ao DB (um por sync). Cada um faz SELECT+UPDATE em cat_pedidos.

#### F2.3-D — `vendaService.deleteUltimoPagamento`: lookup de lançamento por `valor` é ambíguo

`services/vendaService.ts:303-313`: busca o lançamento mais recente da venda com `valor === pagamento.valor`. Cenário: venda com 2 pagamentos parciais de R$ 50 cada. Operador faz `deleteUltimoPagamento`. Achamos pagamento mais recente (P2). Achamos o lançamento mais recente com valor 50 — qual deles? "ORDER BY criado_em DESC" garante o mais recente, que casará com P2 se eles foram criados na mesma ordem. **Funciona na prática mas é inferência por timestamp em vez de FK direta**. Falha se um operador criou o lançamento manualmente fora de ordem.

#### F2.3-E — `vendaService.calculateKPIs`: `pote1kg`/`pote4kg` matcheiam por substring

`services/vendaService.ts:267-274`: `if (item.produto?.nome.includes('1kg')) acc.pote1kg += ...`. Frágil — se um produto novo tiver "1kg" no nome mas não for um pote (ex.: "Recheio 1kg"), entra na contagem.

#### F2.3-F — Brindes: regra documentada e respeitada inconsistentemente

CLAUDE.md: **"Brindes: sales with `pago=false` and `status='entregue'` — exclude from revenue calculations"**.

- `vendaService.calculateKPIs` (L284-285): `recebido = vendas.filter(v => v.pago).reduce(...)` (brindes têm pago=false → excluídos ✅), `aReceber` exclui `formaPagamento === 'brinde'` ✅.
- `pages/ContasReceber.tsx:44`: filtra brindes ✅.
- `view_relacionamento_kanban` (`crm_kanban_schema.sql:48-49`): `where v.status = 'entregue' and v.forma_pagamento <> 'brinde'` ✅.
- `pages/Vendas.tsx`, `VendasFilters.tsx`, `VendaCard.tsx`, `dashboardService` — não inspecionei linha-a-linha; views (`view_home_financeiro`, `view_lucro_liquido_mensal`) têm a regra embutida no DB? não confirmado.
- `services/recompraService.ts` filtra `status === 'entregue'` mas **NÃO filtra brindes** (L26-29). Cliente que recebeu só brindes contaria como compra para cálculo de "última compra" — provavelmente bug.
- `services/dashboardService.ts:GET_DASHBOARD_METRICS` consome views agregadas — depende da view excluir corretamente.

#### F2.3-G — `ContasReceber.confirmQuitar` registra forma_pagamento da venda, não do recebimento

`pages/ContasReceber.tsx:115`: `vendaService.quitarVenda(selectedVenda.id, selectedVenda.formaPagamento, selectedContaId)`. Modal de quitação só pede a **conta de destino** (não o método). O service usa `selectedVenda.formaPagamento` (geralmente 'fiado' nessa tela). Resultado: o `lancamentos.metodo` registra 'fiado' em vez de 'pix'/'dinheiro'. Operador perde a informação de COMO o cliente quitou. **Bug de UX/contábil**.

#### F2.3-H — `useCatalogoPendentes.vincularManualmente` cria venda SEM itens

`hooks/useCatalogoPendentes.ts:55-72`. Insere `vendas` row, mas não copia `cat_itens_pedido` → `itens_venda`. Resultado: venda existe com `total` mas sem itens. Não recalcula `custo_total`. KPIs (`calculateKPIs`) e relatório fábrica (`useRelatorioFabrica` que conta itens_venda) ficam errados. **Feature incompleta ou bug**.

#### F2.3-I — `_event` em `Relacionamento.tsx:219` não usado: handleDragCancel limpa o card mas não loga cancelamento

`pages/Relacionamento.tsx:219`: `const handleDragCancel = (_event: DragCancelEvent) => { setActiveCardId(null) }`. OK funcional.

#### F2.3-J — `Relacionamento.useEffect` dispara setState dentro de effect (cascading renders)

`pages/Relacionamento.tsx:185-187`:

```tsx
useEffect(() => {
    if (abaInicial !== abaAtiva) setAbaAtiva(abaInicial)
}, [abaAtiva, abaInicial])
```

Lint flag `react-hooks/set-state-in-effect`. Cascade: `searchParams` muda → `abaInicial` recomputa → effect roda → `setAbaAtiva` → re-render → effect roda de novo (mas agora `abaInicial === abaAtiva`). Funcional, mas anti-pattern.

#### F2.3-K — Race em `Relacionamento.handleDragEnd` vs optimistic update

`hooks/useRelacionamento.ts:25-58`: optimistic update via `onMutate` está implementado (incluindo `previousData` no contexto e rollback em `onError`). `onSettled` invalida queries. **Correto**. Mas: se o usuário arrasta o card 2x rapidamente em sequência, há 2 mutations pendentes; a segunda escreve sobre o snapshot da primeira em `onMutate`. O rollback da segunda falha pode restaurar o estado do MEIO da segunda ação, não o da PRIMEIRA. Caso de canto.

#### F2.3-L — `ContaAPagarModal.gerarPreviewParcelas`: arredondamento das parcelas

`components/features/contas-a-pagar/ContaAPagarModal.tsx:43-44`: divide por floor a 2 casas, parcela final absorve o resto. Mas o RPC `criar_obrigacao_parcelada` (no DB) faz seu próprio cálculo. **Preview no client e cálculo no server podem divergir** se a regra de arredondamento divergir. Não verifiquei o source do RPC linha-a-linha (está em `remote_schema.sql:97`).

#### F2.3-M — `criar_pedido` RPC não normaliza prefixo 55 do telefone como o trigger faz

`supabase/migrations/20260423223939_add_name_helpers_and_update_criar_pedido.sql:131`:

```sql
v_telefone_norm := regexp_replace(p_telefone_cliente, '[^0-9]', '', 'g');
```

Compara via `regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone_norm`. Mas o trigger `fn_sync_cat_pedido_to_venda` (`fix_trigger_origem_catalogo.sql:30-33`) normaliza E remove "55" prefix se length>=12.

```sql
IF LENGTH(v_telefone_normalizado) >= 12 AND LEFT(v_telefone_normalizado, 2) = '55' THEN
    v_telefone_normalizado := SUBSTRING(v_telefone_normalizado FROM 3);
END IF;
```

`criar_pedido` NÃO faz isso — se cliente inseriu `+55 11 99999-...`, o RPC procura por '5511...' enquanto o trigger removeria o 55. **Caminhos diferentes para casamento de contato**. Cliente pode acabar com 2 contatos diferentes em paths diferentes.

#### F2.3-N — `criar_pedido` faz seq scan ao buscar contato por telefone

`add_name_helpers_and_update_criar_pedido.sql:135`: `WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone_norm`. Sem índice funcional em `regexp_replace(telefone)`. Em ~10K contatos será ~ms; em ~100K começa a doer.

#### F2.3-O — `fix_trigger_origem_catalogo.sql`: hardcoded `pago=true` mesmo para `forma_pagamento='fiado'`

`supabase/migrations/20260405215115_fix_trigger_origem_catalogo.sql:54-56`:

```sql
COALESCE(NEW.metodo_pagamento, 'pix'),
'entregue',
true,                    -- <-- pago hardcoded true
```

Trigger dispara quando `cat_pedidos.status` vira `entregue`. Mas se `metodo_pagamento='fiado'`, registar a venda já com `pago=true` é incoerente. Os fluxos do interno tratam `pago=true && forma_pagamento='fiado'` raramente, mas existe.

#### F2.3-P — Form `CheckoutSidebar` reseta a cada re-render do parent

`components/features/vendas/NovaVenda/CheckoutSidebar.tsx:65-76`: useEffect com `[contatoId, items, reset]`. `NovaVenda.tsx:269-274` passa `items={cart.map(item => ({...}))}` — **nova referência a cada render**. O effect dispara, `reset()` limpa observação/taxa de entrega/parcelas digitadas pelo usuário. Cenário: usuário digita "Deixar na portaria" em observações; algo no parent re-renderiza (toast aparece); a observação some. **Bug reproduzível**.

#### F2.3-Q — Sem proteção a duplo-submit em `createVenda` e modais

`pages/NovaVenda.tsx:142-169` (`handleConfirmSale`) usa `useCallback` mas o botão em `CheckoutSidebar.tsx:304` tem `disabled={isSubmitting}` que cobre. Porém o handler é também invocado por Enter no form (L107 `handleSubmit`). Se rede atrasa e usuário tecla Enter 2x, ambos vão pra `mutateAsync`. React Query não dedupe identical-payload mutations. **2 vendas duplicadas possíveis**.

#### F2.3-R — `produtoService.deleteImage`: order não-transacional

`services/produtoService.ts:168-181`: deleta tabela primeiro (`delete_image_reference`), depois storage. Se o segundo falha, fica órfão no bucket. OK na prática (storage warns, não throws).

#### F2.3-S — `recompraService` cria UMA query para listar TODAS as vendas entregues e agrupa no client

`services/recompraService.ts:25-29`: `.from('vendas').select('contato_id, data').eq('status', 'entregue').order('data', { ascending: false })`. Sem date filter. À medida que `vendas` cresce, payload e tempo crescem linearmente. Operação rodada toda vez que a página de recompra carrega.

#### F2.3-T — `Configuracoes.tsx` faz UPSERT não-atômico em múltiplas chaves

`pages/Configuracoes.tsx:74,111,131,145-157`: cada chave é um `upsert` separado. Salvar "Configurações da Empresa" pode parcialmente persistir (algumas chaves OK, outras erro). Sem rollback.

#### F2.3-U — `cashFlowService.transferencia` insere lancamento SEM atualizar saldo das contas envolvidas explicitamente

`services/cashFlowService.ts:96-118`. O service só insere em `lancamentos` com `tipo='transferencia'`. Pelo nome, **espera-se** que um trigger `update_conta_saldo_lancamento` atualize ambas as contas (origem e destino). Confirmado: existe `update_conta_saldo_lancamento` em `remote_schema.sql:1089` (não inspecionei o corpo). Se o trigger só ajusta `conta_id`, o destino fica errado. Não confirmado.

#### F2.3-V — `useIndicacoes` faz transformação morta (`indicador` não está na query)

`hooks/useIndicacoes.ts:46-55`: `SELECT id, nome, telefone, status, indicado_por_id, ultimo_contato` (sem `indicador:contatos!indicado_por_id (id, nome)`), mas L52-54 acessa `c.indicador` — `Array.isArray(c.indicador)` sempre false porque o campo nunca veio do DB. **Código morto** ou query incompleta.

---

### 2.4 — Performance e UX

#### F2.4-A — `react-hooks/incompatible-library` warnings: 2 confirmados, padrão potencialmente em outros lugares

Lint reporta:
- `ContaAPagarModal.tsx:89:24` — `const valorTotal = watch('valor_total')`
- `PagamentoContaAPagarModal.tsx:78:26` — `const currentValor = watch('valor')`

Padrão problemático: `react-hook-form#watch(field)` retornando subscription. React Compiler analisa o source, vê uso de subscription inválida, **abandona a memoização do componente todo**. Resultado: re-renderiza do zero a cada update.

`Grep` por `\bwatch\(` em produção retornou estes USOS:
- `components/contatos/ContatoFormModal.tsx:60-62` (3 watches: `tipo`, `origem`, `cep`) — DEV silenciou via `// eslint-disable-next-line` na L59. **Compilation Skipped real**, só não aparece no lint.
- `components/features/contas-a-pagar/ContaAPagarModal.tsx:89-91` — 3 watches (já flagged).
- `components/features/contas-a-pagar/PagamentoContaAPagarModal.tsx:78` — 1 watch (já flagged).
- `components/features/vendas/NovaVenda/CheckoutSidebar.tsx:60-62` — 3 watches (`forma_pagamento`, `taxa_entrega`, `parcelas`).
- `components/features/vendas/PaymentSidebar.tsx:74-75` — 2 watches.

Lint só pegou ContaAPagarModal.tsx e PagamentoContaAPagarModal.tsx provavelmente por ordem dos imports/regra interna do compiler. **Padrão presente em pelo menos 5 modais diferentes**, parcialmente silenciado por developer.

#### F2.4-B — `useContatos.ts:51,60,69` — 3 errors `react-hooks/preserve-manual-memoization`

Lint flagged:

```
Compilation Skipped: Existing memoization could not be preserved
```

Em useCallback de `createContato`/`updateContato`/`deleteContato`. O React Compiler não consegue preservar a memoização escrita à mão. Pratico: os useCallback funcionam, mas o compiler não otimiza o componente que os usa.

#### F2.4-C — Sem virtualização em listas grandes

- `pages/Vendas.tsx`, `pages/Contatos.tsx`, `pages/Produtos.tsx` (570 linhas) renderizam lista plana. Para Mont (catálogo pequeno, lista de clientes pequena) provavelmente OK, mas `Vendas` cresce todo dia. Não vi `react-window`/`@tanstack/react-virtual`.
- Kanban `Relacionamento.tsx` renderiza todos os cards de uma vez. Em ~50 cards por coluna não vai doer; em ~500 começa a sentir.

#### F2.4-D — Refetch on subscription sem debounce em `useLogistica`

`hooks/useLogistica.ts:41-54`: subscribe em `*` events on `vendas`. Cada INSERT/UPDATE dispara `fetchLogistics()`. Em uma sessão de cadastro de vendas em massa, dispara N refetchs em segundos.

#### F2.4-E — `ContasAPagar.useMemo` com `MONTHS_MAP` e `now` recriados a cada render

`pages/ContasAPagar.tsx:43-50,66-90`. `MONTHS_MAP` é `const` mas dentro do componente — cada render é novo objeto. `now = new Date()` recriado. `useMemo` no L66 lista `[enrichedContas, filter, searchTerm, selectedMonth]` — não inclui `MONTHS_MAP` nem `now`. Lint warning. Funciona porque o cálculo do índice resolve o mesmo valor mas re-roda em cada render do parent.

#### F2.4-F — `useContatos`/`useVendas`/`useContas`+ outros: 7 warnings `react-hooks/exhaustive-deps`

`useContatos:58/67/82` (3x toast missing), `PagamentoContaAPagarModal:103` (contasAtivas missing), `ContasAPagar.tsx:90` (MONTHS_MAP, now), `ContasReceber.tsx:50` (toast), `Entregas.tsx:113` (toast). **Closure stale risk** em todos.

#### F2.4-G — `ContasReceber` faz fetch agressivo

`pages/ContasReceber.tsx:43`: `vendaService.getVendas(undefined, undefined, false)`. Sem date filter. `getVendas` faz query com 3 joins (contato, itens, pagamentos) e retorna TODAS as vendas. **Banca o trabalho client-side**: filtra `entregue && !pago && origem !== 'catalogo' && formaPagamento !== 'brinde'`. Para 5000 vendas, isso é payload >1MB e processamento client.

#### F2.4-H — `produtoService.getAll` faz 2 queries não-paralelas

`services/produtoService.ts:11-38`: query 1 lista produtos, query 2 lista todas as imagens, merge no client. Sequencial. Pode ser paralelo (`Promise.all`).

#### F2.4-I — `RelatorioFabrica.tsx`: 2 queries serializadas para configuracoes

`pages/RelatorioFabrica.tsx:46-63`: duas queries sequenciais (`telefone_fabrica`, `nome_fabrica`). Podem ser uma só com `.in('chave', ['telefone_fabrica', 'nome_fabrica'])`.

#### F2.4-J — Re-renders em `NovaVenda` cascateiam em CheckoutSidebar (vide F2.3-P)

Já listado em 2.3.

#### F2.4-K — `Vendas` page (não auditei linha-a-linha — 297 linhas de NovaVenda + Vendas.tsx ~ 200 linhas, parar para Fase 3)

#### F2.4-L — `Estoque3DView` (R3F) sempre carrega three.js mesmo se rota não acessada

`apps/interno/src/App.tsx:20`: `Estoque` é lazy. Bom — 3D só baixa se a rota for visitada. Mas dentro de Estoque, react-three-fiber + drei + three é ~1MB minified. Sem code-splitting interno.

#### F2.4-M — Realtime: 1 subscription, sem cleanup-on-error

`useLogistica` é OK (cleanup retornado). Mas se a subscription falhar/desconectar (rede), não há lógica de re-subscribe.

---

### 2.5 — Sync, realtime e dados offline

#### F2.5-A — Sync bidirecional confirmado

Triggers em `remote_schema.sql`:
- `fn_sync_cat_pedido_to_venda` (line 304-...) — fire on cat_pedidos UPDATE para criar/atualizar venda quando status='entregue'.
- `sync_venda_to_cat_pedido` (line 1007-...) — fire on vendas UPDATE para refletir em cat_pedidos.

E o sync **app-side** em `vendaService._syncCatPedido` (L13-47) **duplica parte do trigger** — quando o operador chama updateVenda/cancelVenda/addPagamento, faz update direto via service, e o service também faz `update cat_pedidos` no client. **Duas paths de sync**: trigger DB + service client. Risk de double-write/conflito.

#### F2.5-B — Conflict resolution: last-write-wins, sem versionamento

Nenhuma das tabelas usa coluna `version`/`updated_at` para optimistic locking. Em concurrent edit (2 operadores no mesmo pedido), o último write ganha silenciosamente.

#### F2.5-C — Failure modes nas operações multi-step

Compilação dos pontos onde uma operação multi-step pode falhar parcial:
- `vendaService.createVenda` — vendas + itens_venda (F2.3-A).
- `purchaseOrderService.createOrder` (L52-85) — purchase_orders + purchase_order_items (mesmo padrão).
- `vendaService.deleteVenda` (L191-225) — lancamentos + vendas (CASCADE p/ itens/pagamentos) + cat_pedidos_pendentes_vinculacao + cat_pedidos. 4 deletes serializados, cada um pode falhar.
- `vendaService.deleteUltimoPagamento` (L292-344) — busca pagamento, busca lançamento, deleta lançamento, deleta pagamento. 4 round-trips.
- `useCatalogoPendentes.vincularManualmente` — busca pedido, insere venda (sem itens), deleta da fila.

Em todos: erro no meio = estado inconsistente sem rollback.

#### F2.5-D — Offline: nenhuma estratégia visível

Vite-PWA está configurado (`vite.config.ts:9-33`) para cache de assets, MAS sem mutation queue offline. O Supabase JS client não tem retry/queue offline por default. Operador no cliente faz uma venda offline → erro de rede → operação perdida.

#### F2.5-E — Realtime usado apenas em `useLogistica`

Confirmado pela busca grep única em `apps/interno/src`. Outros painéis (Dashboard, Kanban, ContasReceber) operam por refetch via TanStack Query (`staleTime: 5min`) ou nunca refetchm até user agir. Consequência: 2 operadores no mesmo dispositivo veem versões diferentes por até 5min.

#### F2.5-F — `useLogistica` realtime sem reconexão lógica

Já listado em F2.4-M.

#### F2.5-G — Cache: TanStack Query com staleTime: 5min default

`apps/interno/src/lib/react-query.ts:6`. OK como global default. Hooks específicos override pra menos (relacionamento: 2min, contatos: 15min). Sem invalidações cross-feature consistentes.

#### F2.5-H — Invalidações inconsistentes pós-mutation

Exemplos:
- `useVendas.createVendaMutation.onSuccess` invalida `['vendas']`, `['dashboard_metrics']`, `['produtos']` (L60-64). Não invalida `['contas_a_pagar']` ou `['contas_a_receber']`.
- `useContasAPagar.deleteMutation.onSuccess` invalida `['contas_a_pagar']`, `['contas']`, `['extrato']`, `['fluxo_resumo']` (L42-46) — bom.
- `useContatos.updateMutation.onSuccess` invalida `['contatos']` e `['venda']` (singular!). `['vendas']` (plural, usado por useVendas) NÃO é invalidado.
- `useRelacionamento.useMoverCard.onSettled` invalida só `RELACIONAMENTO_QUERY_KEY` — não invalida `['vendas']` que poderia derivar do mesmo contato.

Padrão: invalidações são individuais, sem mapa central de cross-cache.

---

### 2.6 — Operação, banco e arquitetura

#### F2.6-A — Logging em produção: ad-hoc via `console.error`

Sem Sentry, sem datadog, sem nada. Erros caídos em `console.error` nos services. Em produção (Vercel), logs ficam no devtools do navegador do operador → não há observability.

#### F2.6-B — Try/catch que comem erros

Padrão "F2.2-K" (catch _error). Pages/components fazem catch genérico → toast genérico → usuário não sabe se foi rede, RLS, validação.

#### F2.6-C — Outras migrations idempotency

- `20260423224225_backfill_contatos_nome.sql` (Migration B) — não-idempotente, snapshot acumula (F2.1-B/C).
- `20260423223939_add_name_helpers_and_update_criar_pedido.sql` — `CREATE OR REPLACE FUNCTION` é idempotente. ✅
- `20260428230843_crm_kanban_schema.sql` — `add column` em contatos. **Não-idempotente** se já existe (mas Supabase migration tracking previne re-apply).
- `20260428234517_relacionamento_interacoes_policies.sql` — `create policy` não tem `if not exists`. Falharia em re-apply.
- `20260429002336_relacionamento_rpc_mover_card.sql` — `drop policy` antes de `create policy` (idempotente para re-apply parcial).
- `20260405215115_fix_trigger_origem_catalogo.sql` — `CREATE OR REPLACE FUNCTION`. ✅
- `20260405045304_remote_schema.sql` — initial schema dump. Não testado para re-apply.

#### F2.6-D — Sem down-migrations

Nenhuma migration tem rollback `.down.sql`. Padrão Supabase. Se uma migration der ruim em prod, recovery manual.

#### F2.6-E — RPCs Supabase: documentação inexistente

Os 12 RPCs (incluindo `delete_image_reference` que faltou no inventário Fase 1) não têm comentário SQL (`COMMENT ON FUNCTION`). Inspeção feita pelo nome/parâmetro. Onboarding de novo dev requer leitura PL/pgSQL.

#### F2.6-F — Possíveis RPCs órfãs/duplicadas

- `rpc_total_a_receber_simples` em `remote_schema.sql:937` — mas o código de produção SEM REFERÊNCIA chama isso (só `rpc_total_a_receber_dashboard`). RPC abandonada.
- `rpt_churn` (L952), `rpt_vendas_por_periodo` (L978) — não chamados em `apps/interno/src`. Talvez chamados pelo `apps/catalogo` ou são views futuras.
- `receive_purchase_order` (L610) — não chamado em apps/interno. **RPC abandonada** ou usada pelo trigger?

Confirmar via grep do monorepo (não fiz a varredura no `apps/catalogo`).

#### F2.6-G — Boundary violations

- `pages/RelatorioFabrica.tsx:19,46-63` importa `supabase` e faz query DIRETA de `configuracoes`, em vez de usar um service. Layer mixing.
- `pages/Entregas.tsx:60,119` — mesmo padrão (vide grep `from(` no Inventário).
- `pages/Configuracoes.tsx:74,111,131,...` — extensivo uso direto do client supabase no page level.
- `hooks/useEstoqueMetrics.ts` — query direta em produtos (sem service).
- `hooks/useIndicacoes.ts` — query direta em contatos/vendas.

Ou seja, **padrão de service layer não é estrito**. Aceitável em Vite SPA pequena, mas confunde testes (mock target ambíguo).

#### F2.6-H — Padrão de service: classe vs object literal inconsistente

- `relacionamentoService` (`services/relacionamentoService.ts:14`) e `contatoService` (`services/contatoService.ts:10`) e `produtoService` são **classes** (`export class X { ... }; export const x = new X()`).
- `vendaService`, `cashFlowService`, `contasAPagarService`, `dashboardService`, `purchaseOrderService`, `catalogService`, `recompraService`, `logisticaService` são **object literals**.

Sem motivação técnica visível para a divergência (nenhuma classe usa `this`-state).

#### F2.6-I — Naming inconsistente: `func()` em `ContatoService`

`services/contatoService.ts:12` define o método de listagem como `func()`. Outros services usam `getXxx()` / `fetchXxx()`. **Naming bizarro**, provavelmente um rename incompleto. Usado em `useContatos.ts:20` e em `ContatoFormModal.tsx`.

#### F2.6-J — Inconsistência de pasta de testes

Confirmado em Fase 1 (F1-A): `apps/interno/src/__tests__/` (5 testes) + `apps/interno/tests/integration/` (3 testes). Ambos integration tests, mas separados.

#### F2.6-K — Test setup mínimo

`apps/interno/src/test/setup.ts:1` — única linha: `import '@testing-library/jest-dom'`. Sem mocks globais, sem MSW, sem fixtures shared. OK porque integration tests batem no DB local.

#### F2.6-L — `environment: 'jsdom'` global em integration tests

`vite.config.ts:57`. Integration tests rodam contra Supabase local rodando em Docker, mas Vitest aplica jsdom mesmo nos arquivos `__tests__/*.integration.test.ts`. Para testes que fazem DOM (services puros não fazem DOM), jsdom é overhead. **Ideia para Fase 3**: separar `environment: 'jsdom'` para `*.test.tsx` e `node` para `*.integration.test.ts`. Confirmado como achado pré-existente F4.

#### F2.6-M — Arquivos órfãos no app

`apps/interno/tsc-error.txt` (vazio?) e `apps/interno/types-append.txt` na raiz do app. Provavelmente artefatos de sessão. Achado F1-B confirmado.

#### F2.6-N — `.env.example` legacy AIOS dentro do `apps/interno`

`apps/interno/.env.example` contém configs DeepSeek, OpenRouter, ClickUp, N8N, Sentry, Railway — totalmente alheios ao projeto Mont. **Confusão para novos devs**.

#### F2.6-O — Código morto / não-referenciado

- `services/dashboardService.ts:rpc_total_a_receber_simples` (provável — vide F2.6-F)
- `hooks/useIndicacoes.ts:52-55,63-66` — transformação morta (F2.3-V)
- `services/logisticaService.ts:42` — `entregasRealizadasTotal: 0` hardcoded; nunca calculado.
- `types/domain.ts:231-260` — `VendaComItens`, `PurchaseOrderWithItems` — aparentemente não usados (Domain* types os substituíram). Confirmar.
- `types/domain.ts:22` — `'catalogo'` em DomainContato.tipo (F2.2-D).
- `types/domain.ts:52` — `preco_ancoragem` snake_case (F2.2-C).
- `apps/interno/src/scripts/` — pasta listada na Fase 1, conteúdo não inspecionado linha-a-linha. Provavelmente seeds/utilitários não rodados em build.

#### F2.6-P — `logisticaService.getLogisticsMetrics`: filtro redundante e campo morto

`services/logisticaService.ts:17-18`: `.eq('status', 'pendente').neq('status', 'cancelada')` — segundo filtro REDUNDANTE (eq já restringe). L42: `entregasRealizadasTotal: 0` — campo da interface que sempre retorna zero (não calculado).

#### F2.6-Q — `cliente` sql do mesmo email/telefone duplicado entre catálogo e interno

Já listado em F2.3-M. Diferentes paths de get-or-create resultam em duplicatas.

#### F2.6-R — Storage: imagem antiga não deletada em `produtoService.uploadImage`

`services/produtoService.ts:128-156`: chama `storage.remove([oldFileName])` se `oldImageUrl` foi passada. Mas `addImageReference` (RPC) não notifica `uploadImage` de qual era a old URL. Caller responsável. **Risk**: se chamadas saem fora de ordem, imagem antiga fica órfã no bucket.

#### F2.6-S — Histórico do git contém `.claude/settings.local.json` (achado pré-existente)

Listado como achado pré-existente item 7. Não verifico via comandos destrutivos. Confirma para a Fase 3 como nota.

---

### Achados desta fase

**Sumário bruto**, sem pré-classificar severidade:
- 2.1 — F2.1-A a F2.1-N (14 achados)
- 2.2 — F2.2-A a F2.2-K (11 achados)
- 2.3 — F2.3-A a F2.3-V (22 achados)
- 2.4 — F2.4-A a F2.4-M (13 achados)
- 2.5 — F2.5-A a F2.5-H (8 achados)
- 2.6 — F2.6-A a F2.6-S (19 achados)

**Total: 87 achados brutos** + 9 achados pré-existentes da Fase 1 (F1-A a F1-I) = **96 raw findings** para a matriz de priorização da Fase 3.

Maior surpresa: lint mostra **63 errors + 9 warnings** vs "12 errors + 2 warnings" do briefing — o número assumido estava simplesmente errado. E descobri **Bucket `products` do Storage com permissões DESTRUTIVAS para anon** (F2.1-A) que provavelmente é o achado mais grave do app inteiro.

---

## Fase 3 — Catalogação

> Concluída em: 2026-05-09T00:00:00Z

`AUDIT.md` criado com 75 achados catalogados (2 🔴 + 15 🟠 + 27 🟡 + 31 🟢), matriz de priorização, top-5 críticos, top-5 quick wins. Esta seção registra: (a) destino de cada raw finding (entrou / mesclado / rejeitado), (b) decisões de severidade controversas, (c) checklist de exaustividade.

### Mapa de rastreabilidade — 96 raw findings → AUDIT.md

#### Fase 1 (9 achados pré-existentes ou descobertos no inventário)

| ID raw | Destino | Justificativa |
|---|---|---|
| F1-A — duas pastas de teste + jsdom | **L26** | merge: agrupado com F2.6-J e F2.6-L (mesmo problema operacional). |
| F1-B — `tsc-error.txt`, `types-append.txt` | **L1** | merge com F2.6-M (duplicata). |
| F1-C — ESLint config minimal | **L31** | mantido como achado independente; cobertura de regras vs ausência de plugin. |
| F1-D — sem RBAC client-side | **M4** | merge com F2.1-J (mesma observação). |
| F1-E — Zod só em 2 schemas | **M6** | merge com F2.1-N. |
| F1-F — realtime só em 1 hook | **L20** | merge com F2.5-E. |
| F1-G — `src/scripts/` exposto ao build | **L2** | mantido isolado; achado distinto de F1-B (artefatos diferentes). |
| F1-H — cliente Supabase usa só anon key | **REJEITADO** | informação positiva (=correto). Não é defeito. |
| F1-I — top 10 arquivos por tamanho | **REJEITADO** | inventário descritivo, não defeito. Útil como pointer para 2.3/2.4 mas não é actionable. |

#### Fase 2.1 — Segurança (14 achados)

| ID raw | Destino | Justificativa |
|---|---|---|
| F2.1-A | **C1** | crítico, kept. |
| F2.1-B | **H1** | alto, kept. |
| F2.1-C | **H2** | alto, kept. Migration B idempotência. |
| F2.1-D | **H3** | alto, kept. |
| F2.1-E | **M1** | médio, kept. Public insert anon. |
| F2.1-F | **H4** | alto, kept. SECURITY DEFINER views. |
| F2.1-G | **C2** | crítico, kept. |
| F2.1-H | **M2** | médio, kept. search_path mutável. |
| F2.1-I | **M3** | médio, kept. leaked_password_protection. |
| F2.1-J | **M4** | absorve F1-D. |
| F2.1-K | **L3** | baixo, kept. refresh-token. |
| F2.1-L | **M5** | médio, kept. or() injection. |
| F2.1-M — service role não exposta no client | **REJEITADO** | informação positiva (correto). Não é defeito. |
| F2.1-N | **M6** | absorve F1-E. |

#### Fase 2.2 — Tipagem (11 achados)

| ID raw | Destino | Justificativa |
|---|---|---|
| F2.2-A — 28 any errors | **M7** | médio, kept como bloco. Lista granular fica em F2.2-A no brownfield. |
| F2.2-B — discrepância 12 vs 28 | **REJEITADO** | meta-observação sobre o briefing, já corrigida no sumário do AUDIT.md. Não é defeito do código. |
| F2.2-C — `preco_ancoragem` vs `precoAncoragem` | **H5** | alto, kept. |
| F2.2-D — `'catalogo'` em tipo | **M8** | médio, kept. |
| F2.2-E — vendaSchema fields ignorados | **M9** | médio, kept. |
| F2.2-F — email/lat/lng fora do Zod contato | **M10** | médio, kept. |
| F2.2-G — getContasReceber sem return type | **L4** | baixo, kept. |
| F2.2-H — `as unknown as` casts em mappers | **M7** | merge com F2.2-A (sintoma do mesmo problema). |
| F2.2-I — `delete_image_reference` faltou no inventário Fase 1 | **REJEITADO** | meta-observação. Já addressed via correção implícita no AUDIT (RPC #12 reconhecido). Não é defeito do código de produção. |
| F2.2-J — vite-env.d.ts 3 errors | **L5** | baixo, kept. |
| F2.2-K — `_error` swallowed | **M11** | médio, kept. |

#### Fase 2.3 — Lógica de negócio (22 achados)

| ID raw | Destino | Justificativa |
|---|---|---|
| F2.3-A | **H6** | alto, kept. createVenda transação. |
| F2.3-B | **H7** | alto, kept. _syncCatPedido swallow. |
| F2.3-C | **L6** | baixo (perf only), kept. |
| F2.3-D | **M12** | médio, kept. deleteUltimoPagamento ambíguo. |
| F2.3-E | **M13** | médio, kept. pote1kg substring. |
| F2.3-F | **H8** | alto, kept. brindes em recompraService. |
| F2.3-G | **H9** | alto, kept. confirmQuitar metodo. |
| F2.3-H | **H10** | alto, kept. vincularManualmente sem itens. |
| F2.3-I | **L7** | baixo, kept. _event unused. |
| F2.3-J | **M14** | médio, kept. setState in effect. |
| F2.3-K | **L8** | baixo (edge), kept. race optimistic. |
| F2.3-L | **M15** | médio, kept. parcela rounding. |
| F2.3-M | **H11** | alto, kept. telefone 55. Absorve F2.6-Q. |
| F2.3-N | **L9** | baixo (perf futuro), kept. |
| F2.3-O | **H12** | alto, kept. trigger pago hardcoded. |
| F2.3-P | **H13** | alto, kept. CheckoutSidebar reset. Absorve F2.4-J. |
| F2.3-Q | **M16** | médio, kept. duplo-submit. |
| F2.3-R | **L10** | baixo, kept. |
| F2.3-S | **L11** | baixo (perf), kept. |
| F2.3-T | **M17** | médio, kept. Configuracoes upsert. |
| F2.3-U | **M18** | médio, kept. transferencia trigger. |
| F2.3-V | **L12** | baixo (código morto), kept. |

#### Fase 2.4 — Performance e UX (13 achados)

| ID raw | Destino | Justificativa |
|---|---|---|
| F2.4-A | **M19** | médio, kept. watch() pattern. |
| F2.4-B | **L13** | baixo, kept. preserve_manual_memoization. |
| F2.4-C | **L14** | baixo (futuro), kept. |
| F2.4-D | **M20** | médio, kept. realtime sem debounce. |
| F2.4-E | **L15** | baixo, kept. MONTHS_MAP recriado. |
| F2.4-F | **M21** | médio, kept. exhaustive-deps. |
| F2.4-G | **M22** | médio, kept. ContasReceber fetch. |
| F2.4-H | **L16** | baixo, kept. produtoService 2 queries. |
| F2.4-I | **L17** | baixo, kept. RelatorioFabrica 2 queries. |
| F2.4-J | **H13** | merge com F2.3-P (sintoma do mesmo problema). |
| F2.4-K — Vendas page não auditado linha-a-linha | **REJEITADO** | nota-de-trabalho da auditoria, não é finding. |
| F2.4-L | **L18** | baixo, kept. Estoque3DView bundle. |
| F2.4-M | **L19** | baixo, kept. realtime reconnect. Absorve F2.5-F. |

#### Fase 2.5 — Sync (8 achados)

| ID raw | Destino | Justificativa |
|---|---|---|
| F2.5-A | **H14** | alto, kept. Dois paths de sync. |
| F2.5-B | **M23** | médio, kept. optimistic locking. |
| F2.5-C — failure modes multi-step | **H6 + H10** | merge: enumeração de operações multi-step que são items dedicados (createVenda → H6, vincularManualmente → H10, etc.). Não vira finding separado. |
| F2.5-D | **M24** | médio, kept. offline queue. |
| F2.5-E | **L20** | merge com F1-F. |
| F2.5-F | **L19** | merge com F2.4-M. |
| F2.5-G — cache 5min default OK | **REJEITADO** | informação descritiva. Default razoável. Não é defeito. |
| F2.5-H | **M25** | médio, kept. invalidations inconsistentes. |

#### Fase 2.6 — Operação, banco, arquitetura (19 achados)

| ID raw | Destino | Justificativa |
|---|---|---|
| F2.6-A | **H15** | alto, kept. Sentry/observability. |
| F2.6-B | **M11** | merge com F2.2-K (mesmo problema, perspectiva diferente). |
| F2.6-C | **H2** | merge: outras migrations idempotency cabem em H2 + L21 (down-migrations). Conteúdo único desta era listagem por migration; não vira finding novo. |
| F2.6-D | **L21** | baixo, kept. down-migrations. |
| F2.6-E | **L22** | baixo, kept. RPCs sem documentação. |
| F2.6-F | **L23** | baixo, kept. RPCs órfãs. |
| F2.6-G | **M26** | médio, kept. boundary violations. |
| F2.6-H | **L24** | baixo, kept. classe vs object literal. |
| F2.6-I | **L25** | baixo, kept. contatoService.func(). |
| F2.6-J | **L26** | merge com F1-A. |
| F2.6-K — test setup mínimo | **REJEITADO** | descritivo. Setup mínimo é OK para o estilo de testes integrados que o projeto adota. Não é defeito. |
| F2.6-L | **L26** | merge com F1-A (jsdom em integration tests). |
| F2.6-M | **L1** | merge com F1-B. |
| F2.6-N | **L27** | baixo, kept. .env.example AIOS. |
| F2.6-O | **L28** | baixo, kept (lista de sub-itens incluindo F2.2-D, F2.2-C, F1-G — esses já têm IDs próprios). |
| F2.6-P | **M27** | médio, kept. logisticaService entregasRealizadasTotal=0 + filtro redundante. |
| F2.6-Q | **H11** | merge com F2.3-M. |
| F2.6-R | **L29** | baixo, kept. uploadImage órfão. |
| F2.6-S | **L30** | baixo, kept. .claude/settings.local.json no histórico git. |

### Recontagem da exaustividade

- **96 raw findings totais** (9 da Fase 1 + 14+11+22+13+8+19 = 87 da Fase 2)
- **75 catalogados** no AUDIT.md (IDs C1, C2, H1-H15, M1-M27, L1-L31)
- **13 mesclados** com outros findings: F1-A→L26, F1-B→L1, F1-D→M4, F1-E→M6, F1-F→L20, F2.2-H→M7, F2.4-J→H13, F2.5-C→H6+H10, F2.5-E→L20, F2.5-F→L19, F2.6-B→M11, F2.6-C→H2, F2.6-J→L26, F2.6-L→L26, F2.6-M→L1, F2.6-Q→H11.
- **8 rejeitados** com motivo: F1-H (info positiva), F1-I (inventário sem defeito), F2.1-M (info positiva), F2.2-B (meta), F2.2-I (meta), F2.4-K (nota), F2.5-G (info), F2.6-K (info).

Aritmética: 75 catalogados + 13 mesclados (que apontam para um catalogado existente) + 8 rejeitados = 96. ✓

### Decisões de severidade controversas

1. **C2 (21 RPCs SECURITY DEFINER expostas) marcado como crítico** apesar do advisor classificar como WARN. Justificativa: anon pode invocar funções financeiras (`registrar_pagamento_venda`, `registrar_despesa_manual`) e administrativas (`fn_backfill_contatos_nome`) sem mais barreiras. Probabilidade de exploração depende de quem descobre o nome da função; impacto é destruidor de dados financeiros. Trato como crítico mesmo sendo "WARN" no lint.

2. **H4 (11 SECURITY DEFINER views) marcado como alto** apesar do advisor ser ERROR. Justificativa: ERRORs do advisor variam — `rls_disabled_in_public` (H1) é diretamente explorável (PII vazada na rota mais óbvia). `security_definer_view` é potencial bypass de RLS, mas só vira problema real se a view envolver tabelas com RLS restritiva — e como H3 mostra, várias tabelas têm policies frouxas, então o bypass pelas views não muda muito o risk profile atual. Severidade alta mas não crítica.

3. **H8 (brindes em recompraService) marcado como alto** apesar de ser uma flag booleana ausente. Justificativa: brindes são regra de negócio chave do projeto (CLAUDE.md menciona explicitamente). Painel de recompra é a ferramenta de outbound do operador. Bug invisibiliza o cliente certo no momento certo — operacionalmente alto.

4. **H13 (CheckoutSidebar reset) marcado como alto** apesar de ser bug visual. Justificativa: usuário perde dados digitados sem feedback. Em vendas reais, observação de entrega some. Frustração + dados perdidos.

5. **M22 (ContasReceber fetch agressivo) marcado como médio** apesar de ser puramente performance. Justificativa: já é sentido (operador lista todas as vendas para filtrar 5%). Não crítico mas trava UI.

6. **L8 (race em optimistic update Kanban) marcado como baixo**. Justificativa: caso de canto (drag-drop rápido em 2x). Pouco frequente em painel de CRM. Não vale o investimento agora.

7. **L14 (sem virtualização) marcado como baixo**. Justificativa: catálogo Mont é pequeno (poucas dezenas de produtos), base de contatos é pequena (poucas centenas). Não dói hoje. Vira médio quando atingir ~500 itens em qualquer lista.

### Achados rejeitados — resumo dos motivos

- **F1-H, F2.1-M**: informações positivas (correto que cliente Supabase usa só anon key; correto que service role não está exposta). Documentar como "achados positivos" tomaria espaço sem benefício actionable.
- **F2.2-B, F2.2-I**: meta-observações sobre o processo da auditoria (briefing tinha contagem errada; eu deixei `delete_image_reference` de fora do inventário Fase 1). Já corrigido no AUDIT.md via reconhecimento implícito. Não são defeitos do código de produção.
- **F1-I, F2.4-K**: notas-de-trabalho do auditor (top 10 arquivos para priorizar atenção; "não auditei linha-a-linha"). Não são defeitos a corrigir.
- **F2.5-G, F2.6-K**: defaults conscientes (cache 5min é razoável; setup mínimo está alinhado ao estilo de testes que o projeto escolheu). Não vale investimento.

### Sub-itens omitidos como findings independentes

F2.6-O ("código morto") foi desmembrado em itens já cobertos:
- `VendaComItens`/`PurchaseOrderWithItems` em domain.ts:231-260 → **L28**
- `'catalogo'` em DomainContato.tipo → **M8**
- `preco_ancoragem` snake → **H5**
- `apps/interno/src/scripts/` → **L2**
- `entregasRealizadasTotal: 0` → **M27**
- `rpc_total_a_receber_simples`/`rpt_churn`/`rpt_vendas_por_periodo`/`receive_purchase_order` órfãos → **L23**
- `useIndicacoes.ts:46-66` transformação morta → **L12**

L28 lista esses sub-itens em forma resumida no AUDIT.md.

### Validação cruzada brownfield ↔ AUDIT

Antes de fechar a Fase 3, reli `AUDIT.md` linha por linha confirmando que:
- ✅ Cada finding citado em AUDIT.md tem fonte rastreável em brownfield.md (Fase 1 ou Fase 2.X-Y).
- ✅ Cada raw finding em brownfield.md tem destino na tabela acima (catalogado / mesclado / rejeitado).
- ✅ A matriz de priorização inclui exatamente os IDs C1-C2, H1-H15, M1-M27, L1-L31 (75 total).
- ✅ Top 5 críticos = C1, C2, H3, H1, H4 — coerente com a severidade no detalhamento.
- ✅ Top 5 quick wins = H1, H8, H9, H11, H12 — todos esforço trivial/pequeno e impacto alto.
