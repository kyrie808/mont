# Analise para Merge — Monorepo Mont

> Gerado em: 2026-04-01
> Status: DIAGNOSTICO — nenhuma alteracao foi feita

---

## 1. Inventario Estrutural

### 1.1 Arvore Resumida — catalogo-mont (Next.js 14)

```
catalogo-mont/
├── public/
│   ├── hero/                    # Imagens hero (desktop/mobile)
│   ├── hero-cheese/             # Assets animacao pao de queijo
│   ├── images/                  # benefits, ingredients, products
│   └── mont-distribuidora-sem-bg.png
├── scripts/
│   ├── optimize-hero.mjs
│   └── wsl-chrome-bridge.sh
├── src/
│   ├── app/
│   │   ├── (public)/            # Rotas publicas (/, /produtos, /carrinho, /sobre)
│   │   │   └── _components/     # HeroSection, FeaturedProducts, BrandStory, etc.
│   │   ├── admin/               # Login + painel admin protegido
│   │   ├── api/                 # API Routes (pedidos, admin/produtos, admin/pedidos)
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── admin/               # AdminHeader, AdminNav, DashboardCard, OrderCard, etc.
│   │   ├── catalog/             # Footer, Navbar, ProductCard
│   │   ├── ui/                  # Button, Badge, Input, ToastContainer
│   │   └── visual/             # FloatingCheeseBread, GrainTexture, ParticleField
│   ├── hooks/                   # useCep, useScrollAnimation, useToast
│   ├── lib/
│   │   ├── cart/store.ts        # Zustand cart store
│   │   ├── constants/delivery.ts
│   │   ├── gsap/animations.ts
│   │   ├── supabase/            # client.ts, server.ts, admin.ts, mappers.ts
│   │   ├── utils/               # cn.ts, format.ts, validators.ts
│   │   └── whatsapp/checkout.ts
│   ├── middleware.ts            # Auth middleware (Supabase SSR)
│   └── types/                   # cart.ts, order.ts, product.ts
├── supabase/migrations/         # 3 migrations (001-003)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
└── package.json
```

### 1.2 Arvore Resumida — distribuidora (Vite + React 19)

```
distribuidora/
├── public/                      # PWA icons, favicon
├── src/
│   ├── components/
│   │   ├── auth/                # AuthGuard
│   │   ├── common/              # Componentes reutilizaveis
│   │   ├── contatos/            # Componentes de contato
│   │   ├── dashboard/           # Widgets do dashboard
│   │   ├── features/            # vendas, entregas, purchase-orders, estoque,
│   │   │                          financeiro, configuracoes, contatos
│   │   ├── layout/              # AppLayout, Header, BottomNav, NavigationDrawer
│   │   └── ui/                  # Button, Badge, Card, Modal, Input, Select,
│   │                              Toast, Spinner, Skeleton, Drawer, Tabs, etc. (19 componentes)
│   ├── contexts/                # ThemeContext
│   ├── hooks/                   # 28 hooks (useVendas, useContatos, useProdutos, etc.)
│   ├── lib/
│   │   ├── supabase.ts          # Client singleton
│   │   └── utils.ts             # cn()
│   ├── pages/                   # 21 paginas (Dashboard, Vendas, Contatos, etc.)
│   ├── schemas/                 # Zod (contato, venda)
│   ├── services/                # 11 service files (vendaService, contatoService, etc.)
│   ├── stores/                  # useCartStore, useNavigationStore
│   ├── types/                   # database.ts (auto-gen), domain.ts
│   ├── utils/                   # formatters.ts, cn.ts, calculations.ts, geocoding.ts
│   ├── constants/               # flags.ts
│   ├── test/                    # Setup files
│   ├── App.tsx                  # HashRouter com 22 rotas
│   └── main.tsx
├── supabase/migrations/         # 68 migrations
├── vite.config.ts
├── vercel.json
├── tailwind.config.js
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

### 1.3 Tabela de Sobreposicao

#### Arquivos/Modulos Identicos ou Quase Identicos

| Modulo | catalogo-mont | distribuidora | Notas |
|--------|---------------|---------------|-------|
| `cn()` utility | `src/lib/utils/cn.ts` | `src/utils/cn.ts` + `src/lib/utils.ts` | **Identico** — `twMerge(clsx(...inputs))` |
| Zustand cart store | `src/lib/cart/store.ts` | `src/stores/useCartStore.ts` | Mesma estrutura Zustand+persist, tipos diferentes |
| `formatPhone()` | `src/lib/utils/format.ts` | `src/utils/formatters.ts` | Mesma logica de mascara, implementacao levemente diferente |
| `isValidPhone()` | `src/lib/utils/format.ts` | `src/utils/formatters.ts` | catalogo: so 11 digitos; distribuidora: 10 ou 11 |

#### Arquivos/Modulos Divergentes (mesmo proposito, implementacao diferente)

| Proposito | catalogo-mont | distribuidora | Divergencia |
|-----------|---------------|---------------|-------------|
| **Button** | `src/components/ui/Button.tsx` | `src/components/ui/Button.tsx` | catalogo: manual CSS classes, 3 variants (primary/secondary/ghost). distribuidora: CVA + Radix Slot, 11 variants, leftIcon/rightIcon |
| **Badge** | `src/components/ui/Badge.tsx` | `src/components/ui/Badge.tsx` | catalogo: variants de produto (congelado/refrigerado/combo). distribuidora: CVA, variants semanticos (success/warning/destructive) |
| **formatCurrency()** | `src/lib/utils/format.ts` | `src/utils/formatters.ts` | catalogo: recebe centavos (`cents/100`). distribuidora: recebe valor real |
| **Supabase client** | `src/lib/supabase/` (3 arquivos: client/server/admin) | `src/lib/supabase.ts` (singleton) | catalogo: SSR com cookies + admin com service role. distribuidora: browser-only |
| **Types de produto** | `src/types/product.ts` (Product, ProductImage) | `src/types/domain.ts` (DomainProduto) | Campos diferentes, mapeamento diferente |
| **Mappers** | `src/lib/supabase/mappers.ts` | `src/services/mappers.ts` | catalogo: ProdutoDatabase→Product. distribuidora: snake→camelCase completo |
| **Design tokens** | `tailwind.config.ts` (cores `mont-*`) | `tailwind.config.js` (CSS vars HSL, design system completo) | Totalmente incompativeis |
| **Toast** | `src/hooks/useToast.ts` + `src/components/ui/ToastContainer.tsx` | `src/components/ui/Toast.tsx` (useToastStore) | Ambos custom, APIs diferentes |

#### Arquivos/Modulos Exclusivos

| Exclusivo catalogo-mont | Exclusivo distribuidora |
|--------------------------|-------------------------|
| GSAP animations (`src/lib/gsap/`) | TanStack React Query (28 hooks) |
| Visual components (FloatingCheeseBread, GrainTexture, ParticleField, MountainSilhouette) | 11 services (vendaService, cashFlowService, etc.) |
| WhatsApp checkout (`src/lib/whatsapp/checkout.ts`) | 21 paginas CRM (Dashboard, Vendas, etc.) |
| SSR/Server Components (middleware.ts, server.ts) | Zod schemas (`src/schemas/`) |
| API Routes (`src/app/api/`) | Three.js 3D components |
| CEP hook (`useCep.ts`) | PWA (vite-plugin-pwa) |
| Next.js Image optimization | Framer Motion animations |
| `@supabase/ssr` (SSR auth) | `date-fns` date library |
| | Vitest test setup |
| | Feature flags (`constants/flags.ts`) |
| | Geocoding utility |

### 1.4 Dependencias (package.json)

#### Pacotes em Comum — Mesma Versao

| Pacote | Versao |
|--------|--------|
| `@supabase/supabase-js` | `^2.95.3` |
| `clsx` | `^2.1.1` |

#### Pacotes em Comum — Versao Diferente (atencao)

| Pacote | catalogo-mont | distribuidora | Risco |
|--------|---------------|---------------|-------|
| `react` | `^18.3.0` | `^19.2.0` | **ALTO** — React 18 vs 19. Catalogo precisa migrar |
| `react-dom` | `^18.3.0` | `^19.2.0` | **ALTO** — Mesmo |
| `react-hook-form` | `^7.71.1` | `^7.68.0` | Baixo — minor diff |
| `@hookform/resolvers` | `^3.10.0` | `^5.2.2` | **MEDIO** — major diff (3→5) |
| `zod` | `^3.25.76` | `^4.1.13` | **ALTO** — major diff (3→4) |
| `zustand` | `^4.5.0` | `^5.0.9` | **MEDIO** — major diff (4→5) |
| `lucide-react` | `^0.447.0` | `^0.556.0` | Baixo — minor |
| `tailwind-merge` | `^2.6.1` | `^3.4.0` | **MEDIO** — major diff |
| `typescript` | `^5.6.0` | `~5.9.3` | Baixo — minor |
| `autoprefixer` | `^10.4.20` | `^10.4.22` | Baixo |
| `eslint` | `^8.57.0` | `^9.39.1` | **MEDIO** — major diff (8→9) |
| `tailwindcss` | `^3.4.0` | `^3.4.18` | Baixo — patch |
| `postcss` | `^8.4.47` | `^8.5.6` | Baixo |

#### Pacotes Exclusivos

| Exclusivo catalogo-mont | Exclusivo distribuidora |
|--------------------------|-------------------------|
| `next` ^14.2.0 | `vite` ^7.2.4 |
| `@supabase/ssr` ^0.5.2 | `@vitejs/plugin-react` ^5.1.1 |
| `gsap` ^3.14.2 | `@tanstack/react-query` ^5.90.20 |
| `sharp` ^0.34.5 | `framer-motion` ^12.23.26 |
| `eslint-config-next` ^14.2.0 | `react-router-dom` ^7.10.1 |
| | `class-variance-authority` ^0.7.1 |
| | `date-fns` ^4.1.0 |
| | `three` ^0.182.0 / `@react-three/fiber` / `@react-three/drei` |
| | `vite-plugin-pwa` ^1.2.0 |
| | `vitest` ^4.0.18 |
| | `@testing-library/react` ^16.3.2 |
| | `leva` ^0.10.1 |
| | `dotenv` ^17.2.4 |

### 1.5 Supabase Client — Comparacao

| Aspecto | catalogo-mont | distribuidora |
|---------|---------------|---------------|
| **Framework** | Next.js (SSR + client) | Vite (client-only SPA) |
| **Arquivos** | 3: `client.ts`, `server.ts`, `admin.ts` | 1: `supabase.ts` |
| **Browser client** | `createBrowserClient()` via `@supabase/ssr` | `createClient<Database>()` via `@supabase/supabase-js` |
| **Server client** | `createServerClient()` com cookies | N/A |
| **Admin client** | `createClient()` com `SUPABASE_SERVICE_ROLE_KEY` | N/A |
| **Env vars** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_APP_URL` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Typing** | Sem generics (untyped) | `Database` generic do database.ts |
| **Duplicacao** | Varias instancias ad-hoc criadas inline em API routes e pages (nao centralizado) | Singleton centralizado |

### 1.6 Types/Interfaces Compartilhados

| Conceito | catalogo-mont | distribuidora | Compativel? |
|----------|---------------|---------------|-------------|
| **Produto** | `Product` (English fields: name, price_cents, is_featured) | `DomainProduto` (PT fields: nome, preco, destaque) | Nao — nomenclatura e estrutura diferentes |
| **Pedido/Venda** | `Order` (English: customer_name, total_cents) | `DomainVenda` (PT: contato_id, total) | Nao — catalogo usa centavos, distribuidora usa reais |
| **Item** | `OrderItem` (English) | `DomainItemVenda` (PT) | Nao |
| **Carrinho** | `CartItem` (product + quantity) | `CartItem` (extends ItemVendaFormData + produto) | Nao — tipos base diferentes |
| **Imagem** | `ProductImage` | `sis_imagens_produto` (DB type) | Parcial |
| **Database types** | Nao tem (untyped) | `database.ts` auto-gerado completo | catalogo nao usa |

### 1.7 Componentes UI — Sobreposicao

| Componente | catalogo-mont | distribuidora | Compartilhavel? |
|------------|---------------|---------------|-----------------|
| **Button** | Manual CSS, 3 variants, mont-* colors | CVA + Radix Slot, 11 variants, HSL tokens | Nao sem refactor |
| **Badge** | Variants de categoria de produto | CVA, variants semanticos | Nao — propositos diferentes |
| **Input** | `src/components/ui/Input.tsx` | `src/components/ui/Input.tsx` | Provavelmente nao |
| **Card** | Nao tem | Sim (Card, CardHeader, etc.) | Exclusivo distribuidora |
| **Modal** | Nao tem | Sim (Modal + ModalActions) | Exclusivo distribuidora |
| **Toast** | Custom (useToast + ToastContainer) | Custom (useToastStore + Toast) | Nao — APIs diferentes |
| **Spinner** | Nao tem | Sim (Spinner + LoadingScreen) | Exclusivo distribuidora |
| **Select** | Nao tem | Sim | Exclusivo distribuidora |
| **Skeleton** | Nao tem | Sim (Skeleton, PageSkeleton, WidgetSkeleton) | Exclusivo distribuidora |

---

## 2. Mapeamento de Dependencia Supabase

### 2.1 Tabelas Consumidas por Cada Repo

| Tabela | catalogo-mont (Le) | catalogo-mont (Escreve) | distribuidora (Le) | distribuidora (Escreve) |
|--------|:---:|:---:|:---:|:---:|
| **contatos** | Le (via API admin) | Insere (checkout publico) | Le | Le/Escreve (CRUD) |
| **produtos** | Le (via view `vw_catalogo_produtos`) | Atualiza (admin) | Le | Le/Escreve (CRUD) |
| **vendas** | Le (admin pedidos) | Insere (via trigger sync) | Le | Le/Escreve (CRUD) |
| **itens_venda** | Le (admin pedidos) | Insere (via trigger sync) | Le | Le/Escreve (CRUD) |
| **pagamentos_venda** | Le (admin pedidos) | Deleta (admin cancel) | Le | Le/Escreve (CRUD + RPC) |
| **lancamentos** | — | Deleta (admin cancel) | Le | Le/Escreve (via RPCs) |
| **contas** | — | — | Le | Le/Escreve |
| **plano_de_contas** | — | — | Le | Le/Escreve |
| **contas_a_pagar** | — | — | Le | Le/Escreve (RPC) |
| **pagamentos_conta_a_pagar** | — | — | Le | Le/Escreve (RPC) |
| **purchase_orders** | — | — | Le | Le/Escreve (RPC) |
| **purchase_order_items** | — | — | Le | Le/Escreve (RPC) |
| **purchase_order_payments** | — | — | Le | Le/Escreve |
| **configuracoes** | — | — | Le | Le/Escreve |
| **cat_pedidos** | Le (admin) | Insere (checkout publico) | Le | Le/Escreve (sync) |
| **cat_itens_pedido** | Le (admin) | Insere (checkout publico) | — | — |
| **cat_imagens_produto** | Le (catalogo publico) | Gerencia (admin) | — | — |
| **cat_pedidos_pendentes_vinculacao** | — | — | Le | — |
| **sis_imagens_produto** | Le (admin) | Gerencia (admin, via RPC) | Le | Le/Escreve (via RPC) |
| **admin_users** | — | — | — | — (usado internamente por `is_admin()`) |
| **vw_catalogo_produtos** | Le (paginas publicas) | — | — | — |
| **vw_admin_dashboard** | Le (admin dashboard) | — | — | — |
| **view_home_financeiro** | — | — | Le | — |
| **view_home_operacional** | — | — | Le | — |
| **view_home_alertas** | — | — | Le | — |
| **view_lucro_liquido_mensal** | — | — | Le | — |
| **view_extrato_mensal** | — | — | Le | — |
| **view_extrato_saldo** | — | — | Le | — |
| **view_liquidado_mensal** | — | — | Le | — |
| **view_fluxo_resumo** | — | — | Le | — |
| **view_contas_a_pagar_dashboard** | — | — | Le | — |
| **ranking_indicacoes** | — | — | Le | — |
| **ranking_compras** | — | — | Le | — |
| **rpt_projecao_pagamentos** | — | — | Le | — |

### 2.2 RPCs Utilizadas

| RPC | catalogo-mont | distribuidora | Security |
|-----|:---:|:---:|----------|
| `criar_pedido` (2 overloads) | Sim (checkout publico) | — | SECURITY DEFINER |
| `delete_image_reference` | Sim (admin imagens) | Sim (produtoService) | SECURITY DEFINER |
| `add_image_reference` | — | Sim (produtoService) | SECURITY DEFINER |
| `registrar_pagamento_venda` | — | Sim (vendaService) | SECURITY DEFINER |
| `rpc_total_a_receber_simples` | — | Sim (vendaService) | SECURITY DEFINER |
| `rpc_total_a_receber_dashboard` | — | Sim (dashboardService) | SECURITY DEFINER |
| `get_areceber_breakdown` | — | Sim (dashboardService) | SECURITY INVOKER |
| `registrar_despesa_manual` | — | Sim (cashFlowService) | SECURITY DEFINER |
| `registrar_entrada_manual` | — | Sim (cashFlowService) | SECURITY DEFINER |
| `criar_obrigacao_parcelada` | — | Sim (contasAPagarService) | SECURITY DEFINER |
| `registrar_pagamento_conta_a_pagar` | — | Sim (contasAPagarService) | SECURITY DEFINER |
| `update_purchase_order_with_items` | — | Sim (purchaseOrderService) | SECURITY DEFINER |
| `is_admin` | — | — (usado internamente por RLS) | SECURITY DEFINER |
| `receive_purchase_order` | — | — (definida mas nao chamada no codigo) | SECURITY INVOKER |
| `rpt_churn` | — | — (definida mas nao chamada no codigo) | SECURITY DEFINER |
| `rpt_vendas_por_periodo` | — | — (definida mas nao chamada no codigo) | SECURITY DEFINER |

### 2.3 Views

| View | Consumidor | Proposito |
|------|------------|-----------|
| `vw_catalogo_produtos` | **catalogo-mont** (paginas publicas + produto slug) | Produtos formatados para catalogo publico (price_cents, images, stock_status) |
| `vw_admin_dashboard` | **catalogo-mont** (admin dashboard) | KPIs admin: produtos, pedidos online pendentes, faturamento |
| `vw_marketing_pedidos` | Nenhum (nao referenciado no codigo) | Analytics: pedidos por dia/origem |
| `view_home_financeiro` | **distribuidora** (dashboardService) | KPIs financeiros mensais |
| `view_home_operacional` | **distribuidora** (dashboardService) | KPIs operacionais |
| `view_home_alertas` | **distribuidora** (dashboardService) | Alertas de churn (>45 dias) |
| `view_lucro_liquido_mensal` | **distribuidora** (dashboardService) | P&L mensal |
| `view_extrato_mensal` | **distribuidora** (cashFlowService) | Extrato unificado |
| `view_extrato_saldo` | **distribuidora** (cashFlowService) | Saldo mensal acumulado |
| `view_liquidado_mensal` | **distribuidora** (dashboardService) | Vendas liquidadas por mes |
| `view_fluxo_resumo` | **distribuidora** (cashFlowService) | Resumo fluxo de caixa |
| `view_contas_a_pagar_dashboard` | **distribuidora** (dashboardService) | Resumo contas a pagar |
| `ranking_indicacoes` | **distribuidora** (useTopIndicadores) | Leaderboard indicacoes |
| `ranking_compras` | **distribuidora** (useRankingCompras) | Leaderboard compras |
| `rpt_projecao_pagamentos` | **distribuidora** (dashboardService, contasAPagarService) | Projecao de pagamentos |
| `rpt_projecao_recebimentos` | Nenhum (nao referenciado) | Projecao de recebimentos |
| `rpt_ltv_por_cliente` | Nenhum (nao referenciado) | LTV por cliente |
| `rpt_margem_por_sku` | **distribuidora** (schema reference) | Margem por SKU |
| `rpt_giro_estoque` | **distribuidora** (schema reference) | Giro de estoque |
| Outras 5 views (break_even, distribuicao_pagamento, prazo_medio, faturamento_comparativo, crm_*) | Nenhum (nao referenciadas no codigo) | Relatorioas potenciais — nao utilizadas |

### 2.4 Triggers e Functions

#### Triggers Criticos para Sync Bidirecional (catalogo <-> interno)

| Trigger | Tabela | Evento | Funcao | Proposito |
|---------|--------|--------|--------|-----------|
| `tr_cat_pedidos_link_contato` | cat_pedidos | BEFORE INSERT | `fn_cat_pedidos_link_contato()` | Vincula pedido do catalogo a contato existente (por telefone) ou cria novo |
| `tr_sync_cat_pedido_to_venda` | cat_pedidos | AFTER UPDATE | `fn_sync_cat_pedido_to_venda()` | Sincroniza alteracoes de status do pedido catalogo -> venda interna |
| `tr_sync_venda_to_cat_pedido` | vendas | AFTER UPDATE | `sync_venda_to_cat_pedido()` | Sincroniza status da venda interna -> pedido catalogo (bidirecional) |

#### Triggers Financeiros (apenas distribuidora)

| Trigger | Tabela | Funcao | Proposito |
|---------|--------|--------|-----------|
| `trigger_update_venda_pagamento` | pagamentos_venda | `update_venda_pagamento_summary()` | Atualiza valor_pago e pago em vendas |
| `tr_lancamentos_saldo` | lancamentos | `update_conta_saldo_lancamento()` | Atualiza saldo das contas |
| `tr_po_payments_saldo` | purchase_order_payments | `update_conta_saldo_po_payment()` | Atualiza saldo (sem lancamento — tech debt!) |
| `tr_update_conta_a_pagar_status` | pagamentos_conta_a_pagar | `update_conta_a_pagar_status()` | Recalcula status da conta a pagar |
| `trigger_stock_on_status_change` | vendas | `handle_stock_on_status_change()` | Decrementa estoque ao entregar |
| `trigger_brinde_before_insert` | vendas | `handle_brinde_before_insert()` | Tratamento especial vendas tipo brinde |

#### Triggers de Auditoria (ambos repos)

| Trigger | Tabelas | Funcao |
|---------|---------|--------|
| `tr_*_audit` | contatos, vendas, lancamentos, contas, contas_a_pagar, pagamentos_conta_a_pagar | `handle_audit_fields()` — seta `created_by`/`updated_by` com `auth.uid()` |
| `update_*_atualizado_em` | cat_pedidos, configuracoes, produtos | `update_atualizado_em()` — atualiza timestamp |

### 2.5 RLS Policies — Resumo

#### Acesso Publico (catalogo)

| Tabela | Operacao | Policy |
|--------|----------|--------|
| `produtos` | SELECT | Qualquer um pode ver produtos |
| `cat_imagens_produto` | SELECT | Qualquer um pode ver imagens |
| `sis_imagens_produto` | SELECT | Qualquer um pode ver imagens internas |
| `contatos` | INSERT | Checkout do catalogo cria contato |
| `cat_pedidos` | INSERT | Checkout do catalogo cria pedido |
| `cat_itens_pedido` | INSERT | Checkout do catalogo cria itens |

#### Acesso Autenticado (distribuidora CRM)

| Tabela | Policy | Condicao |
|--------|--------|----------|
| Maioria das tabelas | Admin full access (ALL) | `is_admin()` retorna true |
| contatos, vendas, itens_venda, pagamentos_venda, lancamentos, plano_de_contas, configuracoes | Authenticated read (SELECT) | Qualquer usuario autenticado |

#### Problemas Identificados

| Problema | Tabela | Descricao |
|----------|--------|-----------|
| **Role publica em policy ALL** | `contas_a_pagar`, `pagamentos_conta_a_pagar` | Policy "Admin manage" esta atribuida ao role `public` em vez de `authenticated`. `is_admin()` protege, mas o role grant e mais amplo que necessario |
| **Views sem RLS** | 24 views | Views nao tem RLS proprio — herdam da tabela base via SECURITY INVOKER |

### 2.6 Risco de Quebra

| Elemento | Risco | Justificativa |
|----------|-------|---------------|
| **Triggers de sync bidirecional** (`tr_sync_cat_pedido_to_venda`, `tr_sync_venda_to_cat_pedido`) | **CRITICO** | Qualquer alteracao na estrutura de `vendas` ou `cat_pedidos` pode quebrar o sync entre catalogo e sistema interno |
| **`fn_cat_pedidos_link_contato`** | **ALTO** | Vincula pedidos do catalogo a contatos. Se logica de matching por telefone mudar, pedidos ficam orfaos |
| **`vw_catalogo_produtos`** | **ALTO** | View usada pelo catalogo publico. Se colunas de `produtos` mudarem, a view quebra e o catalogo fica offline |
| **`criar_pedido` RPC** | **ALTO** | Unico ponto de entrada para checkout do catalogo. Alteracoes nos parametros afetam diretamente a receita |
| **Tabela `contatos`** | **ALTO** | Compartilhada com policy de INSERT publico. Mudancas no schema afetam ambos os repos |
| **Tabela `produtos`** | **MEDIO** | SELECT publico para catalogo. Mudancas em colunas impactam a view do catalogo |
| **`update_venda_pagamento_summary`** | **MEDIO** | Trigger financeiro complexo. Mudancas podem causar inconsistencias |
| **Policies RLS** | **MEDIO** | Mudancas nas policies de INSERT publico podem quebrar o checkout do catalogo |
| **Migrations** | **BAIXO** | catalogo-mont tem 3 migrations (obsoletas). distribuidora tem 68 que sao a fonte da verdade |

---

## 3. Configuracao de Deploy

### 3.1 Vercel Config

| Aspecto | catalogo-mont | distribuidora |
|---------|---------------|---------------|
| **vercel.json** | **Nao existe** | Sim |
| **Rewrites** | N/A (Next.js nativo) | `/(.*) -> /index.html` (SPA fallback), `/api/(.*) -> /api/index.py` |
| **Framework** | Next.js (detectado automaticamente pela Vercel) | Vite (SPA estatico) |
| **Output** | `standalone` (next.config.js `output: 'standalone'`) | Static files (dist/) |
| **API backend** | Next.js API Routes (serverless functions em `/api/`) | Python serverless (`/api/index.py`) |
| **SSR** | Sim — Server Components + Server Actions | Nao — SPA puro |

### 3.2 Variaveis de Ambiente

#### catalogo-mont

| Variavel | Contexto | Obrigatoria |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (admin client) | Sim |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Client (footer, navbar, checkout) | Nao (fallback: 5511934417085) |
| `NEXT_PUBLIC_APP_URL` | Client | Nao |

#### distribuidora

| Variavel | Contexto | Obrigatoria |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Client (build-time) | Sim |
| `VITE_SUPABASE_ANON_KEY` | Client (build-time) | Sim |

#### Comparacao

| Tipo | catalogo-mont | distribuidora |
|------|---------------|---------------|
| **Vars compartilhadas (mesmo valor)** | `NEXT_PUBLIC_SUPABASE_URL` | `VITE_SUPABASE_URL` |
| | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` |
| **Vars exclusivas catalogo** | `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_APP_URL` | — |
| **Vars exclusivas distribuidora** | — | (Apenas as 2 VITE_*) |

**Nota:** Ambos apontam para o mesmo projeto Supabase (`herlvujykltxnwqmwmyx`), entao `SUPABASE_URL` e `ANON_KEY` tem o mesmo valor — so o prefixo difere (`NEXT_PUBLIC_` vs `VITE_`).

### 3.3 Dominios

| Projeto | Dominio provavel | Framework |
|---------|-----------------|-----------|
| catalogo-mont | Dominio publico do catalogo (ex: `catalogo.montdistribuidora.com.br`) | Next.js na Vercel |
| distribuidora | Dominio interno/PWA (ex: `app.montdistribuidora.com.br`) | Vite SPA na Vercel |

> **Nota:** Nao foi possivel verificar os dominios exatos sem acesso ao dashboard da Vercel.

### 3.4 Build Commands

| Aspecto | catalogo-mont | distribuidora |
|---------|---------------|---------------|
| **Build** | `next build` | `tsc -b && vite build` |
| **Dev** | `next dev` | `vite` (port 5173) |
| **Lint** | `next lint` | `eslint .` |
| **Test** | Nao configurado | `vitest run` |
| **Type check** | `tsc --noEmit` | Incluso no build (`tsc -b`) |

### 3.5 next.config.js vs vite.config.ts

| Aspecto | catalogo-mont (next.config.js) | distribuidora (vite.config.ts) |
|---------|-------------------------------|-------------------------------|
| **Output** | `standalone` | Static (default Vite) |
| **Images** | Remote patterns para `*.supabase.co`, formats avif/webp, cache 7 dias | N/A (sem otimizacao de imagem) |
| **Server Actions** | Body size limit 5mb | N/A |
| **Path alias** | `@/` -> `./src/*` (tsconfig) | `@` -> `./src` (Vite resolve.alias) |
| **PWA** | Nao | Sim (vite-plugin-pwa, manifest, workbox) |
| **Proxy** | N/A | `/api` -> `http://127.0.0.1:5000` (dev only) |
| **Dev server** | Port 3000 (default Next) | Port 5173, usePolling, host: true (WSL) |

### 3.6 Monorepo na Vercel — O que seria necessario

Para rodar dois apps de um mesmo monorepo na Vercel:

1. **Root Directory Config**: Cada "projeto" Vercel apontaria para um subdiretorio:
   - Projeto "catalogo": Root Directory = `apps/catalogo`
   - Projeto "interno": Root Directory = `apps/interno`

2. **Build Settings por Projeto**:
   - catalogo: `next build` (auto-detected)
   - interno: `tsc -b && vite build` + Output Directory: `dist`

3. **Ignore Build Step**: Configurar para cada projeto so rebuildar quando seus arquivos mudam:
   ```bash
   # Para apps/catalogo
   npx turbo-ignore catalogo
   # Para apps/interno
   npx turbo-ignore interno
   ```

4. **Shared packages**: Vercel suporta monorepos nativamente com npm/pnpm workspaces. Pacotes em `packages/` sao resolvidos automaticamente.

5. **Environment Variables**: Configuradas separadamente por projeto Vercel. Variaveis compartilhadas podem ser definidas via Vercel Environment Variables com scope por projeto.

---

## 4. Proposta de Estrutura do Monorepo

### 4.1 Arvore de Pastas Alvo

```
mont/
├── apps/
│   ├── catalogo/                    # Next.js 14 — catalogo publico
│   │   ├── public/                  # hero, images, assets
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router (public + admin)
│   │   │   ├── components/          # admin, catalog, visual (exclusivos)
│   │   │   ├── hooks/               # useScrollAnimation (exclusivo)
│   │   │   ├── lib/
│   │   │   │   ├── gsap/            # Animacoes GSAP (exclusivo)
│   │   │   │   ├── supabase/        # server.ts, admin.ts (SSR-specific)
│   │   │   │   └── whatsapp/        # checkout.ts (exclusivo)
│   │   │   ├── middleware.ts
│   │   │   └── types/               # order.ts (catalogo-specific)
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts       # Estende @mont/config/tailwind
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── interno/                     # Vite + React 19 — CRM/PWA
│       ├── public/                  # PWA icons
│       ├── src/
│       │   ├── components/          # auth, dashboard, features, layout
│       │   ├── contexts/            # ThemeContext
│       │   ├── hooks/               # 28 hooks (exclusivos)
│       │   ├── pages/               # 21 paginas
│       │   ├── schemas/             # Zod schemas
│       │   ├── services/            # 11 services (exclusivos)
│       │   ├── stores/              # useCartStore (CRM version), useNavigationStore
│       │   ├── constants/           # flags
│       │   ├── test/
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── vite.config.ts
│       ├── vercel.json
│       ├── tailwind.config.js       # Estende @mont/config/tailwind
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── shared/                      # Logica de negocio compartilhada
│   │   ├── src/
│   │   │   ├── supabase/
│   │   │   │   └── client.ts        # createClient<Database>(url, key) generico
│   │   │   ├── types/
│   │   │   │   ├── database.ts      # Auto-gerado Supabase (fonte unica)
│   │   │   │   ├── product.ts       # Tipo unificado de produto
│   │   │   │   └── contato.ts       # Tipo unificado de contato
│   │   │   ├── utils/
│   │   │   │   ├── cn.ts            # twMerge(clsx(...))
│   │   │   │   ├── formatters.ts    # formatCurrency, formatPhone, formatDate, etc.
│   │   │   │   └── validators.ts    # isValidPhone, etc.
│   │   │   └── index.ts             # Barrel exports
│   │   ├── tsconfig.json
│   │   └── package.json             # @mont/shared
│   │
│   ├── ui/                          # Componentes UI compartilhaveis
│   │   ├── src/
│   │   │   ├── Button.tsx           # Versao distribuidora (CVA) como base
│   │   │   ├── Badge.tsx            # Versao distribuidora (CVA) + variants catalogo
│   │   │   ├── Input.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json             # @mont/ui
│   │
│   └── config/                      # Configuracoes compartilhadas
│       ├── eslint/
│       │   └── index.js             # ESLint config base
│       ├── tailwind/
│       │   └── base.js              # Tailwind preset (tokens, fonts)
│       ├── typescript/
│       │   └── base.json            # tsconfig base
│       └── package.json             # @mont/config
│
├── supabase/
│   └── migrations/                  # 68 migrations (fonte unica — do distribuidora)
│
├── package.json                     # Workspace root
├── pnpm-workspace.yaml              # (se pnpm) ou workspaces em package.json
├── turbo.json                       # Turborepo config
├── .env.example                     # Template com todas as vars
└── CLAUDE.md                        # Instrucoes unificadas
```

### 4.2 Shared Packages — Conteudo Detalhado

#### `@mont/shared` — O que vai para la

| Arquivo no shared | Origem | Notas de Migracao |
|-------------------|--------|-------------------|
| `src/supabase/client.ts` | distribuidora `src/lib/supabase.ts` | Tornar generico: exportar factory `createSupabaseClient(url, key)` |
| `src/types/database.ts` | distribuidora `src/types/database.ts` | Fonte unica. Ambos os apps importam daqui |
| `src/types/product.ts` | **Novo** — unificacao de catalogo `Product` + distribuidora `DomainProduto` | Definir tipo base + mappers para cada app |
| `src/types/contato.ts` | **Novo** — tipo base de contato | Extrair campos comuns entre os dois repos |
| `src/utils/cn.ts` | Qualquer um (identico) | Copiar direto |
| `src/utils/formatters.ts` | distribuidora `src/utils/formatters.ts` | Mais completo. Adicionar `formatCurrency` com opcao centavos/reais |
| `src/utils/validators.ts` | Merge de catalogo `validators.ts` + distribuidora `formatters.ts` | `isValidPhone` com opcao 10 ou 11 digitos |

#### `@mont/ui` — O que vai para la

| Componente | Base | Notas |
|------------|------|-------|
| `Button.tsx` | distribuidora (CVA + Radix Slot) | Mais maduro. Catalogo vai precisar adaptar imports |
| `Badge.tsx` | distribuidora (CVA) | Adicionar variants de produto do catalogo |
| `Input.tsx` | distribuidora | Mais completo |
| `Toast.tsx` | distribuidora (useToastStore) | API mais robusta |
| `Spinner.tsx` | distribuidora | Catalogo nao tem |

**Nao vai para @mont/ui** (ficam em cada app):
- Card, Modal, Select, Skeleton, Drawer, Tabs → exclusivos do interno (CRM)
- ProductCard do catalogo → muito especifico do catalogo (GSAP, design mont-*)
- Visual components → exclusivos do catalogo (FloatingCheeseBread, etc.)

#### `@mont/config` — O que vai para la

| Arquivo | Conteudo |
|---------|----------|
| `eslint/index.js` | Config base ESLint 9 (shared rules) |
| `tailwind/base.js` | Preset Tailwind com: tokens de cor compartilhados, fontes, spacing. Cada app estende com seus tokens proprios |
| `typescript/base.json` | tsconfig base: target ES2020, strict, module ESNext, path alias |

### 4.3 Estrategia de Workspaces

**Recomendacao: pnpm workspaces + Turborepo**

| Criterio | npm workspaces | pnpm workspaces | Turborepo |
|----------|:-:|:-:|:-:|
| Disk efficiency (hoisting) | Flat node_modules | Symlinks, menor disco | N/A (build tool) |
| Strictness | Phantom deps possiveis | Strict por padrao | N/A |
| Performance | Lento | Rapido | Cache inteligente |
| Vercel support | Sim | Sim | Sim (nativo) |
| Learning curve | Baixa | Media | Media |

**Justificativa:**
1. **pnpm**: Os dois repos ja usam muitas deps em comum. pnpm evita duplicacao no disco e previne phantom dependencies (deps que funcionam por acidente via hoisting). Importante quando temos 2 frameworks diferentes (Next.js + Vite) com deps potencialmente conflitantes.
2. **Turborepo**: Cache de build inteligente. Quando mudar algo em `@mont/shared`, Turborepo sabe que precisa rebuildar ambos os apps. Quando mudar algo so em `apps/catalogo`, so rebuilda esse. Essencial para DX no dia a dia.
3. **Nao Nx**: Mais complexo que o necessario para 2 apps + 3 packages.

### 4.4 Plano de Migracao em Etapas

#### Etapa 0 — Pre-requisitos (ANTES de mover codigo)

| Tarefa | Risco | Descricao |
|--------|-------|-----------|
| Alinhar versao do React no catalogo-mont (18 -> 19) | **ALTO** | Testar todas as paginas apos upgrade. `gsap` e `@supabase/ssr` precisam ser compativeis com React 19 |
| Alinhar Zod (3 -> 4) no catalogo-mont | **ALTO** | Breaking changes no Zod 4 (`.parse()`, `.safeParse()`, schema composition). Catalogo tem poucos schemas, entao impacto deve ser baixo |
| Alinhar Zustand (4 -> 5) no catalogo-mont | **MEDIO** | API mudou em persist middleware e createStore |
| Alinhar @hookform/resolvers (3 -> 5) | **MEDIO** | Principalmente mudanca de zodResolver import |
| Alinhar tailwind-merge (2 -> 3) | **BAIXO** | Poucas breaking changes |
| Alinhar ESLint (8 -> 9) no catalogo-mont | **MEDIO** | Config format mudou completamente (flat config) |
| Criar testes basicos para catalogo-mont | **MEDIO** | Catalogo nao tem testes. Criar ao menos smoke tests para checkout e listagem de produtos antes de mover |
| Documentar estado atual dos deploys (Vercel) | **BAIXO** | Anotar configs, dominios, env vars de cada projeto |

#### Etapa 1 — Scaffolding do Monorepo

| Tarefa | Risco | Descricao |
|--------|-------|-----------|
| Criar repositorio `mont` com estrutura base | **BAIXO** | `package.json` root, `pnpm-workspace.yaml`, `turbo.json` |
| Configurar `@mont/config` (eslint, tsconfig, tailwind) | **BAIXO** | Extrair configs compartilhadas |
| Criar `@mont/shared` com `cn.ts`, `formatters.ts`, `validators.ts` | **BAIXO** | Copiar do distribuidora (mais completo) |
| Mover `database.ts` para `@mont/shared` | **BAIXO** | Fonte unica de tipos do banco |
| Setup CI/CD basico (lint + typecheck) | **BAIXO** | Validar que tudo compila |

#### Etapa 2 — Mover distribuidora (app mais estavel)

| Tarefa | Risco | Descricao |
|--------|-------|-----------|
| Copiar distribuidora para `apps/interno/` | **BAIXO** | Copiar todo o src/ |
| Atualizar imports para usar `@mont/shared` e `@mont/ui` | **MEDIO** | Substituir `src/utils/cn`, `src/utils/formatters`, `src/types/database` por imports do shared |
| Validar build (`tsc -b && vite build`) | **BAIXO** | Garantir que nada quebrou |
| Validar que o app funciona em dev | **BAIXO** | Testar as 22 rotas principais |
| Rodar testes existentes | **BAIXO** | `vitest run` deve passar |

#### Etapa 3 — Mover catalogo-mont

| Tarefa | Risco | Descricao |
|--------|-------|-----------|
| Copiar catalogo-mont para `apps/catalogo/` | **BAIXO** | Copiar todo o src/ |
| Atualizar imports para usar `@mont/shared` | **MEDIO** | `cn`, `formatCurrency`, `database.ts` |
| Adaptar Supabase client (manter server.ts e admin.ts local, importar types do shared) | **MEDIO** | SSR-specific code fica no app |
| Validar build (`next build`) | **MEDIO** | Next.js + monorepo pode ter issues com module resolution |
| Testar checkout publico end-to-end | **ALTO** | Fluxo critico de receita |
| Testar admin dashboard | **MEDIO** | Funcionalidade administrativa |

#### Etapa 4 — Configurar Deploy

| Tarefa | Risco | Descricao |
|--------|-------|-----------|
| Criar 2 projetos Vercel apontando para o monorepo | **MEDIO** | Root Directory = `apps/catalogo` e `apps/interno` |
| Configurar env vars por projeto | **BAIXO** | Mover vars existentes |
| Configurar Ignore Build Step (Turborepo) | **BAIXO** | Evitar builds desnecessarios |
| Deploy canario do catalogo | **MEDIO** | Deploy em preview URL, validar antes de apontar dominio |
| Deploy canario do interno | **MEDIO** | Mesmo processo |
| Switchover de dominio | **ALTO** | Apontar dominios para os novos deploys. **Ponto de no-return.** |

#### Etapa 5 — Consolidacao (pos-merge)

| Tarefa | Risco | Descricao |
|--------|-------|-----------|
| Unificar migrations em `supabase/` na raiz | **BAIXO** | Mover 68 migrations do distribuidora. Descartar as 3 do catalogo (ja aplicadas) |
| Extrair componentes UI compartilhaveis para `@mont/ui` | **MEDIO** | Refatorar Button/Badge/Input para serem framework-agnosticos |
| Unificar tipos de Produto | **MEDIO** | Criar tipo base + mappers |
| Centralizar Supabase client creation no catalogo | **BAIXO** | Eliminar instancias ad-hoc nos API routes |
| Arquivar repos antigos (read-only) | **BAIXO** | Manter como referencia |

### 4.5 Estimativa de Risco por Etapa

| Etapa | Risco | Justificativa |
|-------|-------|---------------|
| **Etapa 0 — Pre-requisitos** | **ALTO** | Upgrade de React 18->19 e Zod 3->4 no catalogo-mont sao as operacoes mais arriscadas. Podem introduzir bugs sutis. |
| **Etapa 1 — Scaffolding** | **BAIXO** | Criacao de estrutura nova, sem alterar codigo existente. |
| **Etapa 2 — Mover distribuidora** | **BAIXO-MEDIO** | App mais estavel, com testes. Risco principal: imports quebrados. |
| **Etapa 3 — Mover catalogo** | **MEDIO** | Next.js em monorepo pode ter issues de resolucao de modulos. Sem testes existentes. |
| **Etapa 4 — Deploy** | **MEDIO-ALTO** | Switchover de dominio e o momento critico. Qualquer falha afeta usuarios. |
| **Etapa 5 — Consolidacao** | **MEDIO** | Refatoracoes pos-merge. Podem ser feitas incrementalmente sem pressao. |

### 4.6 Downtime Estimado

**Cenario mais realista: Zero downtime**

A estrategia recomendada e:
1. Manter os repos antigos funcionando durante toda a migracao
2. Fazer deploy dos novos apps em URLs de preview na Vercel
3. Validar tudo nas URLs de preview
4. Fazer switchover de dominio (DNS) — isso e atomico e pode ser revertido em minutos
5. Manter repos antigos como fallback por 1-2 semanas

**Risco de downtime**: Se algo der errado no switchover de DNS, reverter o apontamento leva ~5 minutos (propagacao DNS com TTL baixo). Se houver problema no build, o deploy antigo continua servindo.

**Cenario pessimista**: Se houver bug no checkout do catalogo que so aparece em producao, o impacto seria limitado ao tempo de deteccao + rollback DNS (~15-30 minutos). Mitigacao: monitorar checkout metrics nos primeiros 30 min apos switchover.

---

## 5. Resumo Executivo

1. **Dois repos, um banco**: catalogo-mont (Next.js 14, catalogo publico) e distribuidora (Vite+React 19, CRM interno) compartilham o mesmo Supabase com 20 tabelas, 24 views, 30 RPCs e 35 triggers. A integracao principal e via triggers de sync bidirecional (`cat_pedidos` <-> `vendas`).

2. **Divergencia tecnica significativa**: React 18 vs 19, Zod 3 vs 4, Zustand 4 vs 5, ESLint 8 vs 9. O catalogo precisa ser atualizado antes do merge. Os componentes UI tem o mesmo proposito mas implementacoes incompativeis (manual CSS vs CVA).

3. **Sobreposicao real e pequena**: Apenas `cn()`, `formatPhone()`, e `formatCurrency()` sao verdadeiramente duplicados. O resto e codigo especifico de cada dominio. O pacote `@mont/shared` seria modesto (~7 arquivos).

4. **Risco principal**: Os 3 triggers de sync bidirecional e a view `vw_catalogo_produtos` sao o ponto critico. Qualquer alteracao no schema de `vendas`, `cat_pedidos` ou `produtos` durante a migracao pode quebrar ambos os sistemas simultaneamente.

5. **Migracao sem downtime e viavel**: Deploy em paralelo com switchover DNS permite zero downtime. A etapa mais arriscada e a Etapa 0 (alinhamento de versoes no catalogo-mont), nao a movimentacao de codigo em si.

6. **Recomendacao**: pnpm workspaces + Turborepo. Mover distribuidora primeiro (mais estavel, com testes), depois catalogo. Consolidar tipos e UI components incrementalmente apos o merge estar funcional.
