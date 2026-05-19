# Phase 3 — TIPOS & CONSISTÊNCIA
# apps/interno | Data: 2026-05-17
# Metodologia: mapeamento only — zero remediação durante discovery

---

## S0 — Validação database.ts

**database.ts** (`packages/shared/src/database.ts`, commit `b0c7e86`) — **🟢 CURRENT**

Comparação com output fresco do MCP `generate_typescript_types`:
- Delta único: bloco `graphql_public` presente em arquivo commitado, ausente no output fresco
- Causa: artifact de versão anterior do Supabase CLI (versão nova não gera `graphql_public`)
- Impacto nos tipos: **nenhum** — nenhum código em `apps/interno` importa `graphql_public`
- Resolução: auto-eliminado no próximo `supabase gen types typescript`

Todos os 21 tabelas, 26 views e 29 funções em produção têm representação correta em database.ts.
Objetos dropados (rpc_total_a_receber_simples, rpt_churn, rpt_vendas_por_periodo,
fn_backfill_contatos_nome) ausentes corretamente — sem falso-positivo de tipo.

→ **P3-T08** [🟢] database.ts tem `graphql_public` (CLI artifact)

---

## S1 — Header de contexto

| Dimensão | Valor |
|---|---|
| **Zod** | 4.3.6 — uniforme (interno e catalogo, sem mixing v3/v4) |
| **TypeScript** | `strict: true` em `@mont/config/typescript/base.json` (noImplicitAny, strictNullChecks, strictFunctionTypes, etc.) |
| **Flags adicionais (interno)** | noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch |
| **Build status** | `tsc --noEmit` passando limpo em produção |

### Critério de "inconsistência" (4 tipos canônicos)

| Código | Definição | Severidade |
|---|---|---|
| **(a)** | Campo presente em A (DB), ausente em B (frontend/tipo) | 🟢 |
| **(b)** | Campo presente em ambos, tipos diferentes | 🟡 |
| **(c)** | Campo em A (DB) existente mas nunca consumido por B | 🟢 |
| **(d)** | Campo consumido por B (frontend) mas inexistente em A (DB) | 🔴 sempre |

**Resultado desta fase: ZERO findings tipo (d)** — nenhum campo consumido no frontend sem correspondente no DB.

---

## S2 — Inventário de tipos (database.ts vs types.ts)

### Cobertura de aliases nomeados

| Categoria | Total DB | Com alias em types.ts | Sem alias (só Tables<T>) |
|---|---|---|---|
| Tabelas | 21 | 16 (76%) | 5 |
| Views | 26 | 3 (12%) | 23 |
| Funções DB | 29 | N/A (não são Row types) | — |

Tabelas **sem** alias nomeado: `admin_users`, `cat_pedidos_pendentes_vinculacao`, `configuracoes`, `interacoes`, `sis_imagens_produto`

Views **com** alias: `ExtratoItem` (view_extrato_mensal), `FluxoResumo` (view_fluxo_resumo), `ProdutoCatalogo` (vw_catalogo_produtos)

As 23 views sem alias são acessíveis via `Tables<'view_nome'>` — helper correto. O problema não é
ausência de alias, mas o padrão `type Foo = any` nos services que ignora o helper disponível.

### Helpers exportados

`Tables<T>`, `Insert<T>`, `Update<T>`, `TablesInsert<T>` (alias de Insert<T>), `TablesUpdate<T>` (alias de Update<T>), `Enums<T>` — todos exportados de `@mont/shared`.

---

## S3 — Análise as any (26 não-aceitos)

**Aceitos (3):** `zodResolver` / `react-hook-form` — incompatibilidade de tipos conhecida (CLAUDE.md excepção)
`ContatoFormModal.tsx:92` / `CheckoutSidebar.tsx:47` / `PaymentSidebar.tsx:65`

### Tabela completa — 26 instâncias não-aceitas

| # | Arquivo:linha | Contexto | Motivo do any | Tipo proposto | Ação |
|---|---|---|---|---|---|
| 1 | `services/mappers.ts:28` | `type PurchaseOrderRow = any` | Tipos de tabela não importados | `Tables<'purchase_orders'>` | criar import, usar Tables<T> |
| 2 | `services/mappers.ts:29` | `type PurchaseOrderItemRow = any` | idem | `Tables<'purchase_order_items'>` | criar import, usar Tables<T> |
| 3 | `services/mappers.ts:30` | `type PurchaseOrderPaymentRow = any` | idem | `Tables<'purchase_order_payments'>` | criar import, usar Tables<T> |
| 4 | `services/mappers.ts:31` | `type CatalogOrderRow = any` | idem | `Tables<'cat_pedidos'>` | criar import, usar Tables<T> |
| 5 | `services/mappers.ts:32` | `type CatalogOrderItemRow = any` | idem | `Tables<'cat_itens_pedido'>` | criar import, usar Tables<T> |
| 6 | `services/mappers.ts:215` | `(i: any) => toDomainPurchaseOrderItem(i)` | cascade de #2 | `PurchaseOrderItemRow` (após fix #1-5) | resolve automaticamente com #1-5 |
| 7 | `services/mappers.ts:257` | `(i: any) => toDomainCatalogOrderItem(i)` | cascade de #4-5 | `CatalogOrderItemRow` (após fix #1-5) | resolve automaticamente com #1-5 |
| 8 | `services/dashboardService.ts:3` | `type HomeFinanceiroRow = any` | view type não importado | `Tables<'view_home_financeiro'>` | usar Tables<T> (view aceita) |
| 9 | `services/dashboardService.ts:4` | `type HomeOperacionalRow = any` | idem | `Tables<'view_home_operacional'>` | usar Tables<T> |
| 10 | `services/dashboardService.ts:5` | `type HomeAlertasRow = any` | idem | `Tables<'view_home_alertas'>` | usar Tables<T> |
| 11 | `services/cashFlowService.ts:28` | `export type VendaAlerta = any` | tipo de retorno da query fiado | `Tables<'vendas'>` ou Pick relevante | criar tipo ou importar Venda |
| 12 | `services/catalogService.ts:26` | `(v: any)` em map de vendas | query vendas sem tipo | `Tables<'vendas'>` (Pick com cat_pedido_id) | tipar callback com Pick ou inline |
| 13 | `services/catalogService.ts:29` | `(order: any)` em map de cat_pedidos | query cat_pedidos sem tipo | `Tables<'cat_pedidos'>` | tipar callback com Tables<T> |
| 14 | `services/produtoService.ts:32` | `(p: any)` em map de produtos | query produtos sem tipo | `Tables<'produtos'> & { sis_imagens_produto?: ... }` | tipar callback ou usar ProdutoRowWithImages |
| 15 | `services/purchaseOrderService.ts:28` | `(item: any)` em map de purchase_orders | query com join sem tipo | `PurchaseOrderRowWithRelations` (de mappers.ts) | importar e usar tipo do mapper |
| 16 | `services/recompraService.ts:34` | `(v: any)` em forEach de vendas | query vendas sem tipo | `Pick<Tables<'vendas'>, 'contato_id' \| 'data'>` | tipar callback inline |
| 17 | `services/recompraService.ts:43` | `(cliente: any)` em forEach de contatos | query contatos sem tipo | `Tables<'contatos'>` ou Pick | tipar callback |
| 18 | `services/vendaService.ts:87` | `(v: any)` em map de vendas | query com join sem tipo | `VendaRowWithRelations` (de mappers.ts) | importar e usar tipo do mapper |
| 19 | `services/vendaService.ts:115` | `(p: any)` em map de produtos | query select('id, custo') sem tipo | `Pick<Tables<'produtos'>, 'id' \| 'custo'>` | tipar callback inline |
| 20 | `services/vendaService.ts:267` | `acc: any` em reduce de DomainVenda[] | acumulador não tipado | `{ total: number; pote1kg: number; pote4kg: number }` | extrair tipo inline ou local |
| 21 | `services/vendaService.ts:268` | `(item: any)` em forEach de v.itens | v.itens é DomainItemVenda[] | `DomainItemVenda` | tipar callback |
| 22 | `hooks/useCatalogoPendentes.ts:56` | `const vendaInsert: any = { ... }` | objeto insert não tipado | `Insert<'vendas'>` | usar Insert<'vendas'> |
| 23 | `hooks/useConfiguracoes.ts:56` | `(item: any)` em forEach | query configuracoes sem tipo | `Tables<'configuracoes'>` | tipar callback |
| 24 | `hooks/useEstoqueMetrics.ts:42` | `(p: any)` em filter de produtos | query select parcial sem tipo | `Pick<Tables<'produtos'>, 'estoque_atual' \| 'estoque_minimo'>` | tipar callback inline |
| 25 | `hooks/useIndicacoes.ts:78` | `(v: any)` em forEach de vendas | query vendas sem tipo | `Pick<Tables<'vendas'>, 'contato_id'>` | tipar callback inline |
| 26 | `components/.../ProductNicknamesModal.tsx:61` | `(update: any)` em map | array de updates inline não tipado | `{ id: string; apelido: string \| null }` | extrair tipo local ou inline |

**Nota técnica:** `tsc` passa limpo porque `strict: true` inclui `noImplicitAny` (captura `any` inferido) mas NÃO `noExplicitAny` (não existe no TypeScript). `(x: any)` explícito é instrução do programador — compilador obedece. Resultado: 26 buracos de type safety invisíveis ao build pipeline.

**Cascata automática:** #6 e #7 (mappers.ts:215,257) resolvem sem intervenção quando #1–5 forem corrigidos.

### Clusters por tipo (resumo)

#### P3-T01 [🟡] — mappers.ts: 5 aliases raiz + 2 cascade (#1–7)

5 linhas em mappers.ts:28-32 (`PurchaseOrderRow`, `PurchaseOrderItemRow`, `PurchaseOrderPaymentRow`, `CatalogOrderRow`, `CatalogOrderItemRow`). Tipos corretos existem via `Tables<T>`. As linhas 215 e 257 são cascade — resolvem automaticamente com as 5 raízes.

#### P3-T02 [🟡] — dashboardService.ts: 3 aliases de view (#8–10)

`HomeFinanceiroRow`, `HomeOperacionalRow`, `HomeAlertasRow` — as 3 views existem em `database.ts`. `Tables<T>` aceita views.

#### P3-T03 [🟢] — cashFlowService.ts: VendaAlerta (#11)

Alias local isolado. Fix sem cascade.

#### P3-T04 [🟡] — 14 callbacks (x: any) em queries (#12–21, #23–26)

Padrão: queries Supabase sem tipagem explícita no callback. Tipo correto existe mas não importado.

#### P3-T09 [🟢] — declaração local (#22)

`useCatalogoPendentes.ts:56` — `const vendaInsert: any`. Fix direto com `Insert<'vendas'>`.

---

## S4 — RPC params ↔ frontend (cross-reference)

Fonte: `phase3/rpc.log` (tabela completa)

**Resultado: ZERO param drift** em todas as 9 RPCs ativas verificadas.

Todos os objetos passados em `supabase.rpc('<nome>', {...})` correspondem exatamente à assinatura
do DB (incluindo `p_observacao DEFAULT NULL` em `registrar_pagamento_venda` — frontend pode omitir).

### P3-T05 [🔴] — RPCs financeiras UNGUARDED ativas no DB com UI parked

| RPC | Risk Phase 2 | Status frontend | Ação proposta |
|---|---|---|---|
| `registrar_pagamento_conta_a_pagar` | 🔴 financeira (UNGUARDED) | `_parked/contas-a-pagar/` apenas | **DROP** |
| `criar_obrigacao_parcelada` | 🔴 financeira (UNGUARDED) | `_parked/contas-a-pagar/` apenas | **DROP** |

Feature "contas a pagar" tem DB completo (tabelas, RPCs, políticas RLS) mas frontend parked.

**Por que 🔴 e não 🟡:** "UI parked" não reduz a superfície de ataque. Qualquer usuário autenticado
pode invocar estas RPCs diretamente via Supabase client (PostgREST), Supabase Studio ou `curl`.
Não há guarda de role (`is_admin()`) nem validação adicional — apenas `SECURITY DEFINER` com
`authenticated` como executor. Dead code no frontend ≠ dead RPC no banco.

**Ação correta:** DROP das 2 RPCs (não "aguardar UI"). Se a feature "contas a pagar" for retomada,
as RPCs são recriadas via migration. Manter RPCs 🔴 UNGUARDED no DB porque "ninguém usa no frontend"
é risco ativo, não risco futuro.

**Mesmo padrão aplicado a P2-DB06:** índices órfãos de features parked devem ser removidos via
migration — não mantidos como "talvez úteis depois".

---

## S5 — Zod schemas

Fonte: `phase3/schemas.log`

### Cobertura (2/21 tabelas com schema Zod)

`contatoSchema` + `vendaSchema` — única presença intencional. Zod cobre form input;
demais entidades usam tipos TypeScript diretamente nos services.

**ZERO enum divergence** entre form schemas e DB enums:
- `forma_pagamento`: `['pix', 'dinheiro', 'cartao', 'fiado', 'brinde', 'pre_venda']` — match ✓
- `metodo` (pagamento): idem — match ✓
- `status` (contato): `['lead', 'cliente', 'inativo', 'fornecedor']` — match ✓

### P3-T07 [🟢] — contatoSchema.tipo exclui 'catalogo' (intencional)

`DomainContato.tipo` aceita `'catalogo'` (atribuído pelo sistema via `criar_pedido`).
`contatoSchema.tipo` enum = `['B2C', 'B2B', 'FORNECEDOR']` — exclui 'catalogo' por design.
Usuário nunca seleciona 'catalogo' num formulário; o campo é setado pela RPC do catálogo.
Não é drift — é boundary de input correto.

### P3-T10 [🟡] — Cobertura Zod: 2/21 entidades com validação runtime

| Entidade | Schema Zod | Observação |
|---|---|---|
| `contatos` | `contatoSchema` ✓ | Boundary de form completo |
| `vendas` / `pagamentos_venda` | `vendaSchema` / `pagamentoSchema` ✓ | Boundary de form completo |
| `produtos` | — | Insert/update via service direto |
| `purchase_orders` / `purchase_order_items` | — | Form com tipos diretos, sem Zod boundary |
| `cat_pedidos` / `cat_itens_pedido` | — | Inseridos via RPC — sem form Zod |
| `configuracoes` | — | CRUD simples sem validação formal |
| `interacoes` | — | Insert inline sem form Zod |
| `lancamentos` | — | Gerados por triggers e RPCs |
| `contas_a_pagar` / `pagamentos_conta_a_pagar` | — | Feature parked |

**Impacto real:** 19 das 21 entidades com acesso write no DB não têm validação Zod no boundary.
Isso é provável **causa raiz dos 26 `as any`**: sem schema Zod tipado para guiar o shape dos dados,
os services definiram aliases locais `= any` em vez de derivar o tipo do schema.

Entidades com risco financeiro direto sem validação de boundary: `purchase_orders` (P3-T01),
`configuracoes` (P3-T04 #23), `lancamentos` (gerados por RPCs 🔴 UNGUARDED).

**Nota:** ausência de Zod em si não é bug — TypeScript + RLS é defense-in-depth válido para
entidades sem form de usuário. O finding é que as **entidades com form de usuário que mutam dados
financeiros** (produtos com preço, purchase orders) não têm validação runtime de boundary.

### Form-only orchestration fields (design note)

`vendaSchema`: campos `parcelas` e `data_prevista_pagamento` existem no schema mas
não em `vendas` DB table. São campos orquestradores: `parcelas` determina quantas entradas
criar em `pagamentos_venda`; `data_prevista_pagamento` popula `pagamentos_venda.data` para fiado.
Padrão correto — schema de form, não de DB row.

---

## S6 — Consistência de tipos de domínio

### P3-T06 [🟢] — DomainProduto: campo duplicado snake + camel

`apps/interno/src/types/domain.ts:52-53`:
```typescript
preco_ancoragem?: number | null    // linha 52
precoAncoragem?: number | null     // linha 53
```

Mesmo conceito em duas grafias. DB tem `preco_ancoragem`. O campo camelCase é redundante —
critério (b): campo em ambos, formas diferentes. Impacto: qualquer consumidor que usa a
forma errada não recebe erro de compilação (ambas são opcionais).

---

## Sumário de findings Phase 3

| ID | Severidade | Arquivo(s) | Descrição | Critério |
|---|---|---|---|---|
| P3-T01 | 🟡 | mappers.ts:28-32, 215, 257 | 5 type aliases `= any` + 2 cascade | as any (tipo aliases) |
| P3-T02 | 🟡 | dashboardService.ts:3-5 | 3 type aliases `= any` (views) | as any (tipo aliases) |
| P3-T03 | 🟢 | cashFlowService.ts:28 | `VendaAlerta = any` (1 alias isolado) | as any (tipo alias) |
| P3-T04 | 🟡 | 9 arquivos (serviços + hooks) | 14 callbacks `(x: any)` em queries | as any (callbacks) |
| P3-T05 | 🔴 | DB: 2 RPCs UNGUARDED | 2 RPCs financeiras UNGUARDED ativas no DB, frontend parked — attack surface real | tipo (c) + security |
| P3-T06 | 🟢 | types/domain.ts:52-53 | DomainProduto campo duplicado snake+camel | tipo (b) — dual naming |
| P3-T07 | 🟢 | schemas/contato.ts:16 | `tipo` exclui `'catalogo'` do enum — intencional | tipo (a) — intencional |
| P3-T08 | 🟢 | packages/shared/src/database.ts | `graphql_public` schema (CLI artifact) | infra — CLI versão |
| P3-T09 | 🟢 | hooks/useCatalogoPendentes.ts:56 | `vendaInsert: any` (declaração local) | as any (declaração) |
| P3-T10 | 🟡 | schemas/ (2 de 21 entidades) | Cobertura Zod: 19/21 entidades write sem validação de boundary | coverage gap |

**Total as any não-aceitos:** 26 (tabela completa em S3 acima)
- 11 type aliases (#1–11: P3-T01×7, P3-T02×3, P3-T03×1)
- 14 callbacks (#12–21, #23–26: P3-T04)
- 1 declaração local (#22: P3-T09)

**Findings tipo (d):** ZERO — nenhum campo consumido no frontend sem correspondente no DB.

---

## Resumo executivo Phase 3

| Contagem | Categoria |
|---|---|
| 1 | 🔴 CRÍTICO (P3-T05) |
| 4 | 🟡 IMPORTANTE (P3-T01, P3-T02, P3-T04, P3-T10) |
| 5 | 🟢 BAIXO (P3-T03, P3-T06, P3-T07, P3-T08, P3-T09) |

**P3-T05 é 🔴 porque:** RPCs UNGUARDED com `SECURITY DEFINER` ativas no banco não são "dead code"
só porque a UI está parked — são attack surface acessível por qualquer usuário autenticado via
PostgREST/Supabase client direto. Ação: DROP das 2 RPCs via migration, não aguardar retomada da feature.

**Padrão dominante nos as any:** `type Foo = any` nos services quando `Tables<T>` existe — padrão de
desenvolvimento anterior à Item 7.5 (Supabase CLI + regeneração de tipos). O resultado é que
`tsc` passa limpo mas os services operam sem type safety real nos dados do banco.

**Causa raiz provável dos as any (P3-T10):** ausência de schema Zod para 19/21 entidades significa
que os services não têm um "shape canônico" para derivar tipos — então definiram aliases locais
`= any` como atalho.

**Maior impacto por esforço (as any):** P3-T01 (mappers.ts) — 5 linhas corrigidas eliminam 7 instâncias
(2 cascatas automáticas incluídas) e estabelecem tipo correto para toda a cadeia de POs e catálogo.

**ZERO drift RPC:** todos os 9 callers ativos no frontend correspondem à assinatura exata do DB.

**Contexto para execução:**
A tabela dos 26 as any (arquivo:linha, tipo proposto, ação) está em S3 acima — input direto para
a onda de execução Phase 3. Nenhuma instância exige migration de DB. Todas resolvem com imports
+ anotações de tipo no frontend. P3-T05 exige migration (DROP das 2 RPCs).
