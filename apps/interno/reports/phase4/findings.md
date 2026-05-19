# Phase 4 — DEAD CODE & UNUSED CAPABILITIES
# Findings Report
# Data: 2026-05-17
# Scope: apps/interno/ + packages/shared/
# Seeds: P2-DB04 (7 FKs), P2-DB06 (14 índices), P3-T05 (2 RPCs SECDEF sem guarda)

---

## Executive Summary

| ID | Severidade | Descrição | Ação |
|---|---|---|---|
| P4-DC01 | 🟡 | _parked/contas-a-pagar: tabelas + view vivas em prod, sem UI | Avaliar DROP ou manter (depende de reativação) |
| P4-DC02 | 🟡 | AlertasRecompraWidget (ativo) navega para /relacionamento (parqueada) → dead-end silencioso | Remover/substituir navigate |
| P4-DC03 | 🟡 | 2 widgets mortos em src/: AlertasContasAPagarWidget + LogisticsWidget | Mover para _parked/ ou deletar |
| P4-DC04 | 🟢 | Teste órfão: backfill_contatos_nome.integration.test.ts chama RPC+tabela DROPADOS | Deletar teste |
| P4-DC05 | 🟢 | Feature flags ENABLE_GELADEIRA=false + ENABLE_RECOMPRA=false — Vite DCE confirmado: zero no bundle | Remover flags e código associado quando decidir |
| P4-DC06 | 🟢 | .env.example é template AIOS genérico — não documenta VITE_SUPABASE_* | Substituir por .env.example real |
| P4-DC07 | 🟢 | vite.config.ts: proxy /api → localhost:5000 sem referência em src/ | Remover proxy |
| P4-DC08 | 🟢 | 3 type aliases órfãos em @mont/shared: PedidoCatalogo, ItemPedidoCatalogo, ImagemProdutoCatalogo | Remover ou adicionar consumidor |
| P4-DC09 | 🟢 | 6 npm deps não usadas: @dnd-kit/*, clsx, dotenv, tailwind-merge | Remover de package.json |
| P4-DC10 | 🟢 | Arquivos órfãos em src/: utils duplicados, barrel files vazios, widgets experimentais | Remover ou consolidar |

**Contagem:** 0 🔴 · 3 🟡 · 7 🟢

Nota: RPCs SECDEF sem guarda (P3-T05) foram reportados na Phase 3 — não duplicados aqui. O feature cross-reference (Ângulo A) contextualiza o conjunto de remanescentes.

---

## P4-DC01 — contas-a-pagar: remanescentes DB vivos sem UI

**Severidade:** 🟡 (feature parked com remanescentes vivos em DB)

**Contexto:** Feature contas-a-pagar parqueada em commit 67ab163 (2026-05-14). O _parked/README.md declara explicitamente: "schema DB, RPCs e views permanecem em produção". O DB tem objetos vivos sem consumidor ativo de UI.

**Remanescentes identificados:**

| Objeto DB | Tipo | Status |
|---|---|---|
| `contas_a_pagar` | Tabela | Ativa, sem UI ativa |
| `pagamentos_conta_a_pagar` | Tabela | Ativa, sem UI ativa |
| `view_contas_a_pagar_dashboard` | View | Ativa, sem consumidor ativo |
| `criar_obrigacao_parcelada` | RPC SECURITY DEFINER | **UNGUARDED — P3-T05** |
| `registrar_pagamento_conta_a_pagar` | RPC SECURITY DEFINER | **UNGUARDED — P3-T05** |
| 7 FKs não indexadas | Index gaps | **P2-DB04** |

**Observação:** Os RPCs já são 🔴 P3-T05. As tabelas/view têm custo de schema mas zero risco adicional enquanto RLS estiver correta. Manter os dados históricos pode ser desejável se a feature for reativada.

**Arquivo fonte:** `_parked/contas-a-pagar/` (ContasAPagar.tsx, useContasAPagar.ts, contas-a-pagar.service.ts, ContaAPagarModal.tsx, PagamentoContaAPagarModal.tsx)

---

## P4-DC02 — AlertasRecompraWidget: live navigation para rota parqueada

**Severidade:** 🟡 (código ativo com dead-end funcional)

**Localização:** `apps/interno/src/components/dashboard/AlertasRecompraWidget.tsx:77`

```typescript
onViewAll={() => navigate('/relacionamento?aba=reativacao')}
```

**Contexto:** AlertasRecompraWidget é importado e renderizado em `pages/Dashboard.tsx:26,302`. O widget exibe alertas de recompra (clientes sem compra recente). O botão "Ver Todos" chama `navigate('/relacionamento?aba=reativacao')`. A rota `/relacionamento` existe em App.tsx mas usa `ParkedRoute → return null`. O usuário clica, a URL muda, a tela fica em branco.

**Fluxo com problema:**
```
Dashboard renderiza → AlertasRecompraWidget → usuário clica "Ver Todos"
→ navigate('/relacionamento?aba=reativacao')
→ App.tsx: <Route path="/relacionamento" element={<ParkedRoute />} />
→ ParkedRoute() { return null }
→ tela em branco, sem feedback
```

**Ação:** Substituir `navigate('/relacionamento?aba=reativacao')` por ação alternativa (ex.: link WhatsApp direto — `parking-feature-map-2026-05-09.md` sugere exatamente isso) ou remover o botão.

---

## P4-DC03 — Widgets mortos não movidos para _parked/

**Severidade:** 🟡 (código morto em src/ com navigate para rota parqueada)

**Arquivos:**

| Arquivo | Feature relacionada | Importers | Navigate calls |
|---|---|---|---|
| `components/dashboard/AlertasContasAPagarWidget.tsx` | contas-a-pagar | 0 | `navigate('/contas-a-pagar')` × 3 linhas |
| `components/dashboard/LogisticsWidget.tsx` | entregas | 0 | `navigate('/entregas')` × 2 linhas |

Ambos os widgets ficaram em `src/components/dashboard/` quando as features foram parqueadas. Não são renderizados em nenhuma página ativa (zero importers confirmados via knip + grep).

**Ação:** Mover para `_parked/contas-a-pagar/` e `_parked/entregas/` respectivamente, ou deletar. São código morto em src/.

**Widgets adicionais experimentais (sem feature):**
- `components/dashboard/WarRoomWidget.tsx` — zero importers; nunca integrado
- `components/dashboard/TacticalActionCard.tsx` — usado somente por WarRoomWidget (também morto)

→ WarRoomWidget e TacticalActionCard: 🟢 (ver P4-DC10)

---

## P4-DC04 — Teste órfão: fn_backfill_contatos_nome DROPADO

**Severidade:** 🟢 (clean orphan — DB artifact dropado, sem feature parqueada ativa)

**Arquivo:** `apps/interno/tests/integration/backfill_contatos_nome.integration.test.ts`

**Problema:** O teste chama:
- `supabase.rpc('fn_backfill_contatos_nome')` — RPC **DROPADA** em Phase 2
- Queries em `backfill_contatos_nome_log` — tabela **DROPADA** em Phase 2

**Migration de drop:** `supabase/migrations/20260515070100_drop_backfill_contatos_artifacts.sql`

O teste não foi removido quando a migration foi aplicada. Ao rodar `pnpm test`, este teste falha com erro de RPC não encontrada (ou silenciosamente dependendo do error handling do Supabase client).

**Ação:** Deletar `tests/integration/backfill_contatos_nome.integration.test.ts`.

**Observação:** `__tests__/relacionamento-prioridade.integration.test.ts` foi verificado e NÃO é órfão — testa `view_relacionamento_kanban` que ainda existe em prod DB.

---

## P4-DC05 — Feature flags hardcoded com dead code (tree-shake confirmado)

**Severidade:** 🟢 (clean orphan — Vite DCE eliminou o código do bundle)

**Arquivo:** `apps/interno/src/constants/flags.ts`

```typescript
export const ENABLE_GELADEIRA = false  // EstoqueWidget + Menu
export const ENABLE_RECOMPRA = false   // Menu
```

**Verificação tree-shake (2026-05-17):**
```
grep -c "EstoqueWidget\|recompraService" dist/assets/*.js
→ 0 ocorrências em todos os 68 chunks
```

EstoqueWidget.tsx e recompraService.ts não têm importers ativos → Vite os elimina estaticamente no build, antes mesmo de avaliar a flag. O código nunca entra no bundle.

**Dead code associado (presente em src/, ausente no bundle):**

| Flag | Código em src/ | No bundle? |
|---|---|---|
| `ENABLE_GELADEIRA=false` | EstoqueWidget.tsx, hooks/useEstoqueMetrics.ts | ❌ eliminado |
| `ENABLE_RECOMPRA=false` | recompraService.ts, hooks/useRecompra.ts | ❌ eliminado |

**Ação:** Operacionalmente sem urgência (não polui o bundle). Decisão de cleanup: (a) ativar flags se features estão prontas, ou (b) mover para _parked/ e remover condicionais. Não bloqueia nenhuma outra fase.

---

## P4-DC06 — .env.example genérico (não documenta variáveis reais)

**Severidade:** 🟢 (problema operacional, sem risco de segurança)

**Arquivo:** `apps/interno/.env.example`

O arquivo é um template genérico do sistema AIOS. Contém `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, etc. — não relacionadas ao projeto. NÃO documenta `VITE_SUPABASE_URL` nem `VITE_SUPABASE_ANON_KEY`.

Um desenvolvedor novo clonando o repo não sabe quais vars configurar para apps/interno.

**Vars reais necessárias (de turbo.json):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Ação:** Substituir `apps/interno/.env.example` por:
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## P4-DC07 — Proxy vite.config.ts sem referência em src/

**Severidade:** 🟢 (configuração órfã, sem impacto funcional)

**Arquivo:** `apps/interno/vite.config.ts`

```typescript
proxy: {
  '/api': 'http://127.0.0.1:5000'
}
```

Zero referências a `/api` em `apps/interno/src/`. Provavelmente foi configurado para um backend Express local que nunca foi implementado ou foi removido. O proxy é declarado mas nunca invocado.

**Ação:** Remover o bloco `proxy` de vite.config.ts.

---

## P4-DC08 — Type aliases órfãos em @mont/shared

**Severidade:** 🟢 (clean orphan — zero impact funcional)

**Arquivo:** `packages/shared/src/types.ts:41-43`

```typescript
export type PedidoCatalogo = Table<'cat_pedidos'>        // zero importers
export type ItemPedidoCatalogo = Table<'cat_itens_pedido'> // zero importers
export type ImagemProdutoCatalogo = Table<'cat_imagens_produto'> // zero importers
```

Verificação: grep em todo monorepo (apps/interno, apps/catalogo, packages/, tests/, supabase/) — apenas as definições em types.ts e re-export em index.ts. Zero consumidores.

`apps/catalogo` usa os objetos DB correspondentes via `Tables<T>` direto, não via estes aliases.

**Ação:** Remover os 3 aliases de `packages/shared/src/types.ts` e de `packages/shared/src/index.ts:55-57`.

---

## P4-DC09 — 6 npm dependencies não usadas

**Severidade:** 🟢 (clean orphan — apenas peso no install/bundle)

**Fonte:** knip — `apps/interno/package.json`

| Dependência | Motivo de estar presente | Por que não usada |
|---|---|---|
| `@dnd-kit/core` | Feature Relacionamento (Kanban DnD) | Feature parqueada |
| `@dnd-kit/sortable` | idem | Feature parqueada |
| `@dnd-kit/utilities` | idem | Feature parqueada |
| `clsx` | Importado por cn() | @mont/shared/cn já inclui clsx internamente |
| `dotenv` | Scripts legacy ou config | Zero uso em src/ ativo |
| `tailwind-merge` | Importado por cn() | @mont/shared/cn já inclui tailwind-merge |

**Ação:** Remover de `apps/interno/package.json`. Os 3 dnd-kit só voltam se Relacionamento for reativado.

---

## P4-DC10 — Arquivos órfãos em src/ (knip)

**Severidade:** 🟢 (clean orphan — dead weight sem attack surface)

### Utilidades duplicadas
| Arquivo | Duplicata de |
|---|---|
| `src/utils/cn.ts` | `cn()` de `@mont/shared` |
| `src/utils/formatters.ts` | `formatCurrency`, `formatDate`, etc. de `@mont/shared` |
| `src/lib/utils.ts` | idem |

### Barrel files sem consumidores ativos
| Arquivo | Conteúdo |
|---|---|
| `src/hooks/index.ts` | Re-exports de hooks; knip não encontrou importer do barrel |
| `src/pages/index.ts` | Re-exports de páginas; não usado (App.tsx usa imports diretos lazy) |
| `src/schemas/index.ts` | Re-exports de schemas; não usado (imports diretos nos forms) |
| `src/components/layout/index.ts` | Re-exports de layout; não usado |

### Componentes experimentais sem feature
| Arquivo | Observação |
|---|---|
| `src/components/dashboard/WarRoomWidget.tsx` | Zero importers; nunca integrado ao Dashboard |
| `src/components/dashboard/TacticalActionCard.tsx` | Usado somente por WarRoomWidget (morto) |

### Outros
| Arquivo | Observação |
|---|---|
| `src/App.css` | Estilos sem referência em componente |
| `useProduto` (fn em `hooks/useProdutos.ts:60`) | Função exportada sem consumer — a plural `useProdutos` tem consumers, a singular não |
| `usePurchaseOrder` (fn em `hooks/usePurchaseOrders.ts:65`) | Idem — `usePurchaseOrders` (plural) tem consumer em PedidosCompra.tsx; a singular não |

**Ação:** Avaliar remoção em lote. Os barrel files podem estar sendo usados via `@/hooks` etc. — verificar imports path no build antes de remover.

---

---

## Saldo de hooks e services (Ângulo E — completo)

### Hooks — 29 total (18 src/ + 11 _parked/)

**src/ (18 arquivos):**

| Hook | Consumers ativos | Status |
|---|---|---|
| `useDashboardFilter` | Dashboard.tsx, Vendas.tsx, UltimasVendasWidget.tsx | ✅ ativo |
| `useAuth` | AuthGuard.tsx | ✅ ativo |
| `useDashboardMetrics` | Dashboard.tsx | ✅ ativo |
| `useDebounce` | Vendas.tsx, Contatos.tsx | ✅ ativo |
| `useProdutos` | Estoque.tsx, Produtos.tsx, NovaVenda.tsx, PurchaseOrderForm.tsx, ProductNicknamesModal.tsx | ✅ ativo |
| `useProduto` (fn em useProdutos.ts:60) | zero consumers | 🟢 P4-DC10 |
| `useCatalogOrders` | CatalogOrdersHistory.tsx | ✅ ativo |
| `useTopIndicadores` | Ranking.tsx, TopIndicadoresWidget.tsx | ✅ ativo |
| `useCep` | Configuracoes.tsx, ContatoFormModal.tsx | ✅ ativo |
| `useContatos` | Contatos.tsx, CatalogoPendentes.tsx, ContatoDetalhe.tsx, NovaVenda.tsx, ContatoFormModal.tsx, PurchaseOrderForm.tsx, ClientSelector.tsx | ✅ ativo |
| `useContato` (fn em useContatos.ts) | ContatoDetalhe.tsx | ✅ ativo |
| `usePurchaseOrders` | PedidosCompra.tsx | ✅ ativo |
| `usePurchaseOrder` (fn em usePurchaseOrders.ts:65) | zero consumers | 🟢 P4-DC10 |
| `useVendas` | Vendas.tsx, NovaVenda.tsx, ContatoDetalhe.tsx, UltimasVendasWidget.tsx, LoyaltyJourney.tsx, VendasHistory.tsx | ✅ ativo |
| `useVenda` (fn em useVendas.ts) | VendaDetalhe.tsx | ✅ ativo |
| `useConfiguracoes` | Configuracoes.tsx, useRecompra.ts | ✅ ativo |
| `useIndicacoes` | ContatoDetalhe.tsx, Ranking.tsx, LoyaltyJourney.tsx | ✅ ativo |
| `useAlertasFinanceiros` | AlertasFinanceiroWidget.tsx | ✅ ativo |
| `useRankingCompras` | Ranking.tsx, RankingComprasWidget.tsx | ✅ ativo |
| `useCatalogoPendentes` | CatalogoPendentes.tsx | ✅ ativo |
| `useEstoqueMetrics` | EstoqueWidget.tsx (zero importers — tree-shaked) | 🟢 P4-DC05 |
| `useRecompra` | hooks/index.ts barrel apenas (tree-shaked) | 🟢 P4-DC05 |

**Resumo src/:**
- 16 hooks ativos com consumers confirmados
- 2 orphans DCE'd: useEstoqueMetrics, useRecompra → P4-DC05 (🟢)
- 2 funções exportadas sem consumer: useProduto, usePurchaseOrder → P4-DC10 (🟢)

**_parked/ (11 hooks — todos parqueados):**
useContasAPagar, useContasReceber, useLogistica, useContas, useExtrato, useExtratoDeSaldo, useFluxoCaixa, useLancamentos, usePlanoDeContas, useRelacionamento, useRelatorioFabrica

---

### Services — 12 total (9 src/ + 3 _parked/)

**src/ (9 arquivos):**

| Service | Consumers | Status |
|---|---|---|
| `vendaService` | Vendas.tsx, VendaDetalhe.tsx, NovaVenda.tsx | ✅ ativo |
| `contatoService` | Contatos.tsx, ContatoDetalhe.tsx | ✅ ativo |
| `produtoService` | Produtos.tsx, NovaVenda.tsx | ✅ ativo |
| `dashboardService` | useDashboardMetrics | ✅ ativo |
| `cashFlowService` | PaymentSidebar, PurchaseOrderPaymentModal, AlertasFinanceiroWidget | ✅ ativo |
| `purchaseOrderService` | PedidosCompra.tsx | ✅ ativo |
| `catalogService` | CatalogoPendentes.tsx | ✅ ativo |
| `contatoService` (class) | instância usada; classe em si não importada diretamente (knip false positive) | ✅ ativo |
| `mappers` | vendaService, purchaseOrderService, catalogService (indireto) | ✅ ativo |
| `recompraService` | zero consumers, tree-shaked | 🟢 P4-DC05 |

**_parked/ (3 services — parqueados):**
contasAPagarService.ts, logisticaService.ts, relacionamentoService.ts

**Resumo services:**
- 8 services ativos com consumers
- 1 orphan DCE'd: recompraService → P4-DC05 (🟢)

---

## _parked/ universo (confirmação Ângulo B)

```
apps/interno/_parked/
├── contas-a-pagar/   (ContasAPagar.tsx, contasAPagarService.ts, useContasAPagar.ts + components/)
├── contas-receber/   (ContasReceber.tsx, useContasReceber.ts)
├── entregas/         (Entregas.tsx, logisticaService.ts, useLogistica.ts + components/)
├── fluxo-caixa/      (FluxoCaixa.tsx, useContas.ts, useExtrato.ts, useExtratoDeSaldo.ts, useFluxoCaixa.ts, useLancamentos.ts)
├── plano-de-contas/  (PlanoDeContas.tsx, usePlanoDeContas.ts)
├── relacionamento/   (Relacionamento.tsx, relacionamentoService.ts, useRelacionamento.ts)
├── relatorio-fabrica/(RelatorioFabrica.tsx, useRelatorioFabrica.ts)
└── README.md
```

**Confirmado:** 7 subdirs + README.md. Sem arquivos soltos na raiz de _parked/. Sem subdirs ocultos. Estrutura limpa.

---

## Inventário de dependências parqueadas (Ângulo B summary)

| Feature | Parqueada em | DB limpo? | Frontend limpo? | Remanescentes |
|---|---|---|---|---|
| contas-a-pagar | 67ab163 (2026-05-14) | Não — tabelas/RPCs vivos | Parcial — 2 widgets em src/ | P4-DC01, P4-DC03, P3-T05 |
| contas-a-receber | 67ab163 (2026-05-14) | N/A — sem DB exclusivo | Sim | — |
| relacionamento | 67ab163 (2026-05-14) | Não — view+RPC+colunas vivos | Parcial — AlertasRecompraWidget navega para /relacionamento | P4-DC02 |
| fluxo-caixa | 67ab163 (2026-05-14) | N/A — cashFlowService ativo | Sim (cashFlowService intencional) | — |
| entregas | 67ab163 (2026-05-14) | N/A — sem DB exclusivo | Parcial — LogisticsWidget em src/ | P4-DC03 |
| relatorio-fabrica | 67ab163 (2026-05-14) | N/A | Sim | — |
| plano-de-contas | 67ab163 (2026-05-14) | N/A — tabela ativa (dependência) | Sim | — |

---

## Log files desta fase

| Arquivo | Conteúdo |
|---|---|
| `features.log` | Ângulo A: env vars + cruzamento de features × DB |
| `parked.log` | Ângulo B + B-bis: _parked/ inventory + testes órfãos |
| `knip.log` | Ângulo C + C-bis: knip output + aliases @mont/shared |
| `routes.log` | Ângulo D: rotas parqueadas + navegações vivas/mortas |
| `consumers.log` | Ângulo E: hooks/services sem consumer |
