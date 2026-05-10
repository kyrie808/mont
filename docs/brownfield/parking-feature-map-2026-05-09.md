# Mapa de Acoplamento — Parking de Features
Data: 2026-05-09
Versão do schema: `20260509120200_restrict_rpc_execute_grants.sql` (último migration aplicado)

---

## 1. Sumário Executivo

| Métrica | Total |
|---------|-------|
| Arquivos exclusivos de features parqueadas | ~22 |
| Imports cross-feature (ativo → parqueado) | 0 imports de código; 8 navegações de rota |
| Tabelas exclusivamente parqueadas | 2 (`contas_a_pagar`, `pagamentos_conta_a_pagar`) |
| Tabelas compartilhadas (ativas + parqueadas) | 5 (`lancamentos`, `plano_de_contas`, `contas`, `vendas`, `contatos`) |
| Tabela exclusivamente parqueada de outra feature | 1 (`interacoes` → Relacionamento) |

### Riscos críticos

> ⚠️ **RISCO 1 — Dashboard linka e lê dados de features parqueadas**
> `Dashboard.tsx` navega para `/contas-a-receber`, `/contas-a-pagar`, `/relacionamento` via `navigate()`. Além disso, lê dados de `contas_a_pagar` via `view_contas_a_pagar_dashboard` (KPIs "A Pagar" e "Vencido"). Essas 6 ligações precisam ser desacopladas antes do parking.

> ⚠️ **RISCO 2 — `plano_de_contas` e `contas` são tabelas COMPARTILHADAS — NÃO arquivar**
> As tabelas `plano_de_contas` e `contas` têm UI parqueada (Plano de Contas, Fluxo de Caixa), mas são **lidas por triggers ativos** (`handle_stock_on_status_change`, `registrar_pagamento_venda`). Parquear a UI é seguro; arquivar a tabela (Fase 6) exige refatoração das triggers.

> ⚠️ **RISCO 3 — Relacionamento adicionou colunas na tabela `contatos` (ativa)**
> A migration `20260428230843_crm_kanban_schema.sql` adicionou `arquivado_em` e `status_relacionamento` à tabela `contatos`. Essas colunas permanecem mesmo após parking do código. A RPC `fn_mover_card_relacionamento` ainda escreve em `contatos.status_relacionamento` mesmo após parquear.

> ⚠️ **RISCO 4 — `AlertasFinanceiroWidget` e `AlertasRecompraWidget` no Dashboard navegam para `/relacionamento`**
> Dois widgets do Dashboard ativo apontam para a feature Relacionamento. Ao parquear, esses botões precisam ser desabilitados ou redirecionados.

> ℹ️ **INFO — Não existe tabela `entregas` no schema**
> A feature Entregas/Rotas é uma UI sobre `vendas.status='pendente'`. Nenhuma tabela exclusiva precisa ser arquivada.

> ℹ️ **INFO — Não existe tabela `contas_a_receber` no schema**
> Contas a Receber é uma UI sobre `vendas` filtradas. A mesma informação existe no filtro de fiados da página Vendas.

---

## 2. Frontend — Inventário por Feature

### 2.1 Entregas / Rotas Inteligentes

**Página:** `apps/interno/src/pages/Entregas.tsx`

**Arquivos exclusivos:**
- `src/pages/Entregas.tsx`
- `src/components/features/entregas/OriginSelector.tsx`
- `src/components/features/entregas/DeliveryCard.tsx`
- `src/components/features/entregas/DeliveryList.tsx`
- `src/components/features/entregas/OptimizationButton.tsx`
- `src/components/features/entregas/RouteTimeline.tsx`
- `src/components/features/entregas/index.ts`
- `src/hooks/useLogistica.ts`

**Arquivo atualmente sem consumidor ativo:**
- `src/components/dashboard/LogisticsWidget.tsx` — Componente no diretório `dashboard/` mas **não importado** em nenhuma página ativa. Pode ser parqueado junto com a feature.

**Imports cross-feature de fora pra dentro (ativo → entregas):**
- Nenhum import direto de código.

**Navegação de fora pra dentro:**
| Arquivo de origem (ativo) | Rota apontada | Contexto |
|--------------------------|---------------|---------|
| `components/dashboard/LogisticsWidget.tsx` | `/entregas` | Botão "Ver Rota" — widget **não renderizado** em nenhuma página ativa atualmente |

**Tabelas consultadas por Entregas.tsx:**
- `vendas` (SELECT `id, total, data, contato_id` WHERE `status='pendente'`) — tabela ATIVA
- `configuracoes` (SELECT WHERE `chave='locais_partida'`) — tabela ATIVA

Não escreve em nenhuma tabela.

**Recomendação preliminar:** **Parking total OK** — sem bloqueios. Nenhuma tabela exclusiva.

---

### 2.2 Ranking

**Página:** `apps/interno/src/pages/Ranking.tsx`

**Arquivos exclusivos:**
- `src/pages/Ranking.tsx`
- `src/hooks/useRankingCompras.ts`
- `src/hooks/useIndicacoes.ts`
- `src/hooks/useTopIndicadores.ts`

**Arquivos compartilhados (também usados pelo Dashboard ativo):**
- `src/components/dashboard/RankingComprasWidget.tsx` — usado por `Ranking.tsx` E importado de `Dashboard.tsx` via `TopIndicadoresWidget`
- `src/components/dashboard/TopIndicadoresWidget.tsx` — importado em `Dashboard.tsx` linha 30 e usado na seção "Indicações"

**Imports cross-feature de fora pra dentro (ativo → ranking):**

| Arquivo de origem (ativo) | Importa | Como é usado |
|--------------------------|---------|-------------|
| `pages/Dashboard.tsx` | `TopIndicadoresWidget` | Widget de ranking de indicações no grid inferior do Dashboard |

> ⚠️ `TopIndicadoresWidget` é compartilhado entre a página Ranking (parqueada) e o Dashboard (ativo). Parquear `Ranking.tsx` não resolve o problema — o `TopIndicadoresWidget` deve permanecer em `components/dashboard/` ou ser copiado/extraído.

**Navegação de fora pra dentro:** Nenhuma.

**Tabelas/Views consultadas:**
- `ranking_compras` (view sobre `vendas`/`contatos`) — view parqueável
- `ranking_indicacoes` (view sobre `vendas`/`contatos`) — view parqueável, mas também usada por `view_home_operacional` que alimenta o Dashboard

**Recomendação preliminar:** **Parking parcial** — `TopIndicadoresWidget` não pode ser parqueado (usado pelo Dashboard). A página `Ranking.tsx` e hooks exclusivos podem ser parqueados.

---

### 2.3 Relacionamento

**Página:** `apps/interno/src/pages/Relacionamento.tsx`

**Arquivos exclusivos:**
- `src/pages/Relacionamento.tsx`
- `src/hooks/useRelacionamento.ts`

**Sem diretório `components/features/relacionamento/`** — componentes kanban estão provavelmente na página ou em componentes inline.

**Imports cross-feature de fora pra dentro (ativo → relacionamento):**
Nenhum import direto de código. Mas existem **navegações críticas**:

| Arquivo de origem (ativo) | Navega para | Contexto |
|--------------------------|-------------|---------|
| `components/dashboard/AlertasFinanceiroWidget.tsx` L67, L85 | `/relacionamento?aba=cobranca` | Botões "Ver Todos" / "Cobrar" nos alertas financeiros do Dashboard |
| `components/dashboard/AlertasRecompraWidget.tsx` L60, L78, L99 | `/relacionamento?aba=reativacao` | Botões "Ver Todos" / "Contatar" nos alertas de recompra do Dashboard |

> ⚠️ CRÍTICO: Dois widgets do Dashboard ativo chamam `navigate('/relacionamento?aba=...')`. Quando Relacionamento for parqueado, esses botões precisam ser desabilitados, removidos ou redirecionados para um fluxo alternativo (ex.: WhatsApp direto).

**Tabelas/Views consultadas:**
- `view_relacionamento_kanban` (view sobre `contatos`/`vendas`/`configuracoes`)
- `interacoes` (tabela **exclusiva** do Relacionamento)

**Colunas adicionadas à tabela `contatos` (tabela ATIVA):**
- `contatos.arquivado_em timestamptz` — adicionada pela migration de Relacionamento
- `contatos.status_relacionamento enum_relacionamento_status` — adicionada pela migration de Relacionamento

**RPC que escreve em `contatos` (tabela ativa):**
- `fn_mover_card_relacionamento(p_contato_id, p_novo_status, p_observacao)`:
  - UPDATE `contatos` SET `status_relacionamento = p_novo_status`
  - INSERT `interacoes` (canal, tipo, resultado, observacao)

**Recomendação preliminar:** **Parking parcial com ação prévia necessária** — os dois widgets do Dashboard devem ser desacoplados primeiro. As colunas adicionadas a `contatos` permanecem no schema mas inativas.

---

### 2.4 Fluxo de Caixa

**Página:** `apps/interno/src/pages/FluxoCaixa.tsx`

**Arquivos exclusivos da feature:**
- `src/pages/FluxoCaixa.tsx`
- `src/hooks/useFluxoCaixa.ts`
- `src/hooks/useExtrato.ts`
- `src/hooks/useExtratoDeSaldo.ts`

**Arquivos COMPARTILHADOS (também usados por Plano de Contas e pelo flow de Quitar):**
- `src/hooks/useLancamentos.ts` — usado apenas por FluxoCaixa, mas `cashFlowService.registrarDespesaManual/Entrada` são RPCs que também escrevem em `lancamentos`
- `src/hooks/useContas.ts` — a tabela `contas` é lida pelo `PaymentSidebar.tsx` (feature ativa de Quitar)
- `src/hooks/usePlanoDeContas.ts` — compartilhado com PlanoDeContas
- `src/components/features/financeiro/FinanceiroResumo.tsx` — exclusivo FluxoCaixa
- `src/components/features/financeiro/ExtratoMensal.tsx` — exclusivo FluxoCaixa
- `src/components/features/financeiro/ExtratoSaldoAcumulado.tsx` — exclusivo FluxoCaixa
- `src/components/features/financeiro/FinanceiroConfig.tsx` — exclusivo FluxoCaixa
- `src/components/features/financeiro/FinanceiroFab.tsx` — exclusivo FluxoCaixa (lança lançamentos)
- `src/components/features/financeiro/LancamentoModal.tsx` — usado pelo FinanceiroFab
- `src/components/features/financeiro/TransferenciaModal.tsx` — usado pelo FinanceiroFab
- `src/components/features/financeiro/ContaModal.tsx` — gerencia `contas`

**Tabelas consultadas:**
- `lancamentos` — COMPARTILHADA (escrita por triggers ativos)
- `contas` — COMPARTILHADA (lida por PaymentSidebar via `cashFlowService.getContas()`)
- Views: `view_extrato_mensal`, `view_fluxo_resumo`, `view_extrato_saldo`, `view_lucro_liquido_mensal`

**Imports cross-feature:** Nenhum import de código. Sem links de fora para Fluxo de Caixa.

**Recomendação preliminar:** **Parking total de UI OK** — a tabela `lancamentos` e `contas` permanecem ativas; apenas a UI vai para `_parked/`. `PlanoContaModal` é compartilhado com PlanoDeContas — decidir quem fica com o arquivo.

---

### 2.5 Contas a Receber

**Página:** `apps/interno/src/pages/ContasReceber.tsx`

**Arquivos exclusivos:**
- `src/pages/ContasReceber.tsx`
- `src/hooks/useContasReceber.ts`

**Tabelas consultadas:**
- `vendas` — ATIVA (filtra WHERE `status='entregue' AND pago=false AND origem<>'catalogo'`)
- `contas` — compartilhada (para selector de conta no quitar inline)
- `pagamentos_venda` — ATIVA (escrita ao quitar pela página)

> ℹ️ NÃO existe tabela `contas_a_receber` no schema. Esta feature é apenas uma UI alternativa de fiados sobre `vendas`.

**Imports cross-feature de fora pra dentro:**

| Arquivo de origem (ativo) | Navega para | Contexto |
|--------------------------|-------------|---------|
| `pages/Dashboard.tsx` L224 | `/contas-a-receber` | KpiCard "A Receber" `onClick={() => navigate('/contas-a-receber')}` |

**Recomendação preliminar:** **Parking total OK** — sem tabela exclusiva. O Dashboard precisa remover/desabilitar o link no KpiCard "A Receber".

---

### 2.6 Contas a Pagar

**Página:** `apps/interno/src/pages/ContasAPagar.tsx`

**Arquivos exclusivos:**
- `src/pages/ContasAPagar.tsx`
- `src/hooks/useContasAPagar.ts`
- `src/components/features/contas-a-pagar/ContaAPagarModal.tsx`
- `src/components/features/contas-a-pagar/PagamentoContaAPagarModal.tsx`

**Tabelas exclusivas:**
- `contas_a_pagar` — EXCLUSIVA desta feature
- `pagamentos_conta_a_pagar` — EXCLUSIVA desta feature

**Imports cross-feature de fora pra dentro (ativo → parqueado):**

| Arquivo de origem (ativo) | Acesso | Contexto |
|--------------------------|--------|---------|
| `pages/Dashboard.tsx` L246 | `navigate('/contas-a-pagar')` | KpiCard "A Pagar" `onClick` |
| `pages/Dashboard.tsx` L263 | `navigate('/contas-a-pagar')` | KpiCard "Vencido" `onClick` |
| `components/dashboard/AlertasContasAPagarWidget.tsx` L63, L81, L91 | `navigate('/contas-a-pagar')` | Botões do widget de vencimentos |

> ⚠️ CRÍTICO: O Dashboard **lê dados** de `contas_a_pagar` via `dashboardService.getContasAPagarDashboard()` (que consulta `view_contas_a_pagar_dashboard`) e `dashboardService.getProximosVencimentos()`. Parquear Contas a Pagar sem desacoplar esses dados quebra os KPIs do Dashboard.

**Recomendação preliminar:** **Parking parcial com ação prévia necessária** — Dashboard deve parar de ler `contas_a_pagar` ou manter a leitura mas desabilitar os links. `AlertasContasAPagarWidget` pode ser removido do Dashboard.

---

### 2.7 Relatório Fábrica

**Página:** `apps/interno/src/pages/RelatorioFabrica.tsx`

**Arquivos exclusivos:**
- `src/pages/RelatorioFabrica.tsx`
- `src/hooks/useRelatorioFabrica.ts`

**Tabelas/Views consultadas** (inferidas — o hook usa cashFlowService e vendaService):
- `vendas` — ATIVA
- `purchase_orders`, `purchase_order_items`, `purchase_order_payments` — ATIVAS (Pedidos de Compra)
- Views: `rpt_vendas_por_periodo`, `rpt_margem_por_sku`, `rpt_giro_estoque`, `rpt_break_even_mensal`, `rpt_distribuicao_forma_pagamento`, `rpt_faturamento_comparativo`, `view_lucro_liquido_mensal`

**Imports cross-feature de fora pra dentro:**

| Arquivo de origem (ativo) | Navega para | Contexto |
|--------------------------|-------------|---------|
| `components/features/configuracoes/ConfiguracaoLinks.tsx` L33 | `/relatorio-fabrica` | Botão "Relatório Fábrica" nas Configurações |

**Recomendação preliminar:** **Parking total OK** — as views permanecem no banco (não custam nada). Configurações precisam remover o link.

---

### 2.8 Plano de Contas

**Página:** `apps/interno/src/pages/PlanoDeContas.tsx`

**Arquivos exclusivos:**
- `src/pages/PlanoDeContas.tsx`
- `src/hooks/usePlanoDeContas.ts`

**Arquivo compartilhado com FluxoCaixa:**
- `src/components/features/financeiro/PlanoContaModal.tsx` — usado tanto por `PlanoDeContas.tsx` quanto por `FinanceiroConfig.tsx` (que é filho de `FluxoCaixa.tsx`)

**Tabela `plano_de_contas`:** COMPARTILHADA — não arquivável. Usada por:
- Trigger `handle_stock_on_status_change`: lê `plano_de_contas WHERE codigo='DESPESA_BRINDE'`
- RPC `registrar_pagamento_venda`: lê `plano_de_contas WHERE codigo='RECEBIMENTO_VENDA'`
- FK de `lancamentos.plano_conta_id → plano_de_contas.id`
- FK de `contas_a_pagar.plano_conta_id → plano_de_contas.id`

**Imports cross-feature:** Nenhum link de páginas ativas para Plano de Contas.

**Recomendação preliminar:** **Parking de UI OK, tabela NÃO arquivável** — a página vai para `_parked/` mas `plano_de_contas` permanece no schema forever.

---

## 3. Frontend — Dashboard (Início)

**Página:** `apps/interno/src/pages/Dashboard.tsx`

### Widgets e dependências

| Widget / KPI | Fonte de dado | Tabelas lidas | Depende de feature parqueada? |
|---|---|---|---|
| KpiCard "Faturamento" | `useDashboardMetrics` → `view_home_financeiro` | `vendas` | Não |
| KpiCard "Lucro Bruto" | `dashboardService.getLucroLiquido()` → `view_lucro_liquido_mensal` | `vendas`, `lancamentos`, `purchase_order_payments` | ⚠️ Sim — lê `lancamentos` (FluxoCaixa) |
| KpiCard "Lucro Líquido" | Idem | `vendas`, `lancamentos`, `purchase_order_payments` | ⚠️ Sim — lê `lancamentos` |
| KpiCard "Ticket Médio" | `view_home_financeiro` | `vendas` | Não |
| KpiCard "A Receber" | `dashboardService.getTotalAReceber()` → `rpc_total_a_receber_dashboard` | `vendas` | ⚠️ Sim — onClick navega para `/contas-a-receber` |
| KpiCard "Liquidado no Mês" | `dashboardService.getLiquidadoMes()` | `vendas`, `pagamentos_venda` | Não |
| KpiCard "A Pagar" | `dashboardService.getContasAPagarDashboard()` → `view_contas_a_pagar_dashboard` | `contas_a_pagar` | ⚠️ Sim — lê tabela parqueada E navega para `/contas-a-pagar` |
| KpiCard "Vencido" | Idem | `contas_a_pagar` | ⚠️ Sim — lê tabela parqueada E navega para `/contas-a-pagar` |
| KpiCard "Vendas" | `view_home_operacional` | `vendas` | Não |
| KpiCard "Itens" | `view_home_operacional` | `itens_venda` | Não |
| KpiCard "Pendentes" | `view_home_operacional` | `vendas` | Não (dado de entregas pendentes, mas lê `vendas`) |
| KpiCard "Entregues" | `view_home_operacional` | `vendas` | Não |
| `AlertasFinanceiroWidget` | `useAlertasFinanceiros` → `view_home_financeiro` | `vendas`, `contatos` | ⚠️ Sim — botões navegam para `/relacionamento?aba=cobranca` |
| `AlertasContasAPagarWidget` | `dashboardService.getProximosVencimentos()` | `contas_a_pagar`, `plano_de_contas` | ⚠️ Sim — lê `contas_a_pagar` e navega para `/contas-a-pagar` |
| `AlertasRecompraWidget` | `useDashboardMetrics` → `view_home_alertas` | `vendas`, `contatos` | ⚠️ Sim — botões navegam para `/relacionamento?aba=reativacao` |
| `TopIndicadoresWidget` | `view_home_operacional` → `ranking_indicacoes` | `contatos`, `vendas` | ⚠️ Sim — usa view da feature Ranking |
| `UltimasVendasWidget` | `view_home_operacional` | `vendas`, `contatos` | Não |

### Recomendação de desacoplamento para o Dashboard

Para a **Fase 2 (Desacoplamento)**, antes do parking:

1. **KpiCards "A Pagar" e "Vencido":** Remover `onClick` (navegação para `/contas-a-pagar`) OU manter os KPIs mas deixar o card não clicável.
2. **KpiCard "A Receber":** Remover `onClick` (navegação para `/contas-a-receber`).
3. **`AlertasContasAPagarWidget`:** Remover do Dashboard OU desabilitar os botões de navegação.
4. **`AlertasFinanceiroWidget`:** Substituir navegação para `/relacionamento?aba=cobranca` por envio direto de WhatsApp (o dado de telefone já está disponível no widget).
5. **`AlertasRecompraWidget`:** Substituir navegação para `/relacionamento?aba=reativacao` por envio direto de WhatsApp.
6. **`TopIndicadoresWidget`:** Pode permanecer — lê dados de `ranking_indicacoes` (view sobre `vendas`/`contatos`, tabelas ativas).

---

## 4. Banco — Inventário de Tabelas

| Tabela | Classificação | Lida por (ativas) | Escrita por (ativas) | Lida por (parqueadas) | Escrita por (parqueadas) | FKs de entrada |
|--------|---------------|-------------------|----------------------|-----------------------|--------------------------|----------------|
| `admin_users` | Sistema | AuthGuard | — | — | — | auth.users |
| `cat_imagens_produto` | Catálogo | CatalogoPendentes, Produtos | add/delete_image_reference | — | — | produtos |
| `cat_itens_pedido` | Catálogo + Nova Venda | CatalogoPendentes | criar_pedido | — | — | cat_pedidos, produtos |
| `cat_pedidos` | Catálogo + CatalogoPendentes | CatalogoPendentes | criar_pedido, sync | — | — | contatos |
| `cat_pedidos_pendentes_vinculacao` | Utilitário catálogo | CatalogoPendentes | criar_pedido (falha) | — | — | cat_pedidos |
| `configuracoes` | ATIVA | Configurações, Entregas | Configurações | Relacionamento (via view) | — | — |
| `contas` | **COMPARTILHADA** | PaymentSidebar (Quitar), PedidosCompra | PedidosCompra (payments) | FluxoCaixa | FluxoCaixa (ContaModal) | auth.users |
| `contas_a_pagar` | **EXCLUSIVA Contas a Pagar** | Dashboard (A Pagar/Vencido) ⚠️ | — | ContasAPagar | ContasAPagar | plano_de_contas |
| `contatos` | **ATIVA** | Contatos, Vendas, NovaVenda, Dashboard | Contatos, criar_pedido | Relacionamento, Ranking (views) | fn_mover_card ⚠️ | auth.users, contatos (self) |
| `interacoes` | **EXCLUSIVA Relacionamento** | — | — | Relacionamento | fn_mover_card_relacionamento | contatos |
| `itens_venda` | ATIVA | Vendas, VendaDetalhe | NovaVenda, criar_pedido | — | — | vendas, produtos |
| `lancamentos` | **COMPARTILHADA** | FluxoCaixa | FluxoCaixa (FAB) | FluxoCaixa | registrar_pagamento_venda ⚠️, handle_stock_on_status_change ⚠️ | contas, plano_de_contas |
| `pagamentos_conta_a_pagar` | **EXCLUSIVA Contas a Pagar** | — | — | ContasAPagar | ContasAPagar | contas_a_pagar, contas |
| `pagamentos_venda` | ATIVA | VendaDetalhe, ContasReceber | Quitar (registrar_pagamento_venda) | ContasReceber | — | vendas |
| `plano_de_contas` | **COMPARTILHADA** | — | — | FluxoCaixa, PlanoDeContas | PlanoDeContas | — |
| `produtos` | ATIVA | Produtos, NovaVenda, Estoque | Produtos, receive_purchase_order | RelatorioFabrica (views) | — | — |
| `purchase_order_items` | ATIVA (Pedidos de Compra) | PedidosCompra | PedidosCompra | RelatorioFabrica (views) | — | purchase_orders, produtos |
| `purchase_order_payments` | ATIVA (Pedidos de Compra) | PedidosCompra | PedidosCompra | RelatorioFabrica (views) | — | purchase_orders, contas |
| `purchase_orders` | ATIVA (Pedidos de Compra) | PedidosCompra | PedidosCompra | RelatorioFabrica (views) | — | contatos (fornecedor) |
| `sis_imagens_produto` | ATIVA | Produtos | add/delete_image_reference | — | — | produtos |
| `vendas` | ATIVA | Vendas, VendaDetalhe, Dashboard, Contatos | NovaVenda, criar_pedido, triggers | Entregas, Ranking (views), ContasReceber, Relacionamento (views) | — | contatos, cat_pedidos |

---

## 5. Banco — RPCs e Funções

| Função | Descrição | Lê | Escreve | Classificação |
|--------|-----------|-----|---------|---------------|
| `add_image_reference` | Gerencia imagens de produto | — | `sis_imagens_produto`, `cat_imagens_produto` | ATIVA |
| `criar_obrigacao_parcelada` | Cria parcelas em contas_a_pagar | `plano_de_contas` | `contas_a_pagar` | PARQUEADA |
| `criar_pedido` | Checkout do catálogo | `contatos`, `produtos` | `cat_pedidos`, `cat_itens_pedido`, `contatos`, `vendas`, `itens_venda`, `cat_pedidos_pendentes_vinculacao` | ATIVA |
| `delete_image_reference` | Remove imagens de produto | — | `sis_imagens_produto`, `cat_imagens_produto` | ATIVA |
| `fn_cat_pedidos_link_contato` | Trigger: vincula pedido ao contato | `contatos` | — | ATIVA (trigger) |
| `fn_capitalize_name` | Utilitária: capitaliza nomes | — | — | UTILITÁRIA |
| `fn_count_words` | Utilitária: conta palavras | — | — | UTILITÁRIA |
| `fn_mover_card_relacionamento` | Move card do kanban de Relacionamento | — | `contatos.status_relacionamento`, `interacoes` | PARQUEADA ⚠️ (escreve em contatos) |
| `fn_sync_cat_pedido_to_venda` | Trigger: sync catálogo → venda | `contatos`, `cat_itens_pedido`, `produtos` | `contatos`, `vendas`, `itens_venda`, `cat_pedidos_pendentes_vinculacao` | ATIVA (trigger) |
| `get_areceber_breakdown` | Totais de a receber por prazo | `vendas` | — | PARQUEADA (ContasReceber) |
| `handle_audit_fields` | Trigger: campos de auditoria | — | campos `created_by`, `updated_by`, `criado_em`, `atualizado_em` | UTILITÁRIA (trigger) |
| `handle_brinde_before_insert` | Trigger: normaliza brinde antes de INSERT | — | NEW row | ATIVA (trigger) |
| `handle_stock_on_status_change` | Trigger: debita/credita estoque + lança brinde | `itens_venda`, `plano_de_contas`, `contas`, `contatos` | `produtos.estoque_atual`, `lancamentos` | ATIVA ⚠️ (lê shared tables) |
| `is_admin` | Auth check | `admin_users` | — | SISTEMA |
| `prevent_delete_automatic_plan` | Trigger: impede remoção de categorias automáticas | `plano_de_contas` | — | COMPARTILHADA (trigger) |
| `receive_purchase_order` | Recebe pedido de compra | `purchase_orders`, `purchase_order_items` | `produtos`, `purchase_orders` | ATIVA |
| `registrar_despesa_manual` | Lança despesa no fluxo | `contas`, `plano_de_contas` | `lancamentos` | PARQUEADA |
| `registrar_entrada_manual` | Lança entrada no fluxo | `contas`, `plano_de_contas` | `lancamentos` | PARQUEADA |
| `registrar_pagamento_conta_a_pagar` | Paga uma conta a pagar | `contas_a_pagar` | `pagamentos_conta_a_pagar`, `lancamentos` | PARQUEADA |
| `registrar_pagamento_venda` | **Quitar**: registra pagamento de venda | `plano_de_contas`, `pagamentos_venda` | `pagamentos_venda`, `lancamentos` | ATIVA ⚠️ (lê/escreve shared tables) |
| `rpc_total_a_receber_dashboard` | Total a receber para Dashboard | `vendas` | — | ATIVA |
| `rpc_total_a_receber_simples` | Soma simples a receber | `vendas` | — | ATIVA/PARQUEADA (ContasReceber) |
| `rpt_churn` | Relatório de clientes inativos | `contatos`, `vendas` | — | PARQUEADA (Relacionamento/Ranking) |
| `rpt_vendas_por_periodo` | Relatório de vendas por período | `vendas`, `itens_venda` | — | PARQUEADA (RelatorioFabrica) |
| `sync_venda_to_cat_pedido` | Trigger: sync venda → catálogo | — | `cat_pedidos` | ATIVA (trigger) |
| `update_atualizado_em` | Trigger: atualiza timestamp | — | `atualizado_em` | UTILITÁRIA (trigger) |
| `update_conta_a_pagar_status` | Trigger: recalcula status CAP | `contas_a_pagar`, `pagamentos_conta_a_pagar` | `contas_a_pagar` | PARQUEADA (trigger) |
| `update_conta_saldo_lancamento` | Trigger: atualiza saldo da conta | `lancamentos` | `contas.saldo_atual` | COMPARTILHADA (trigger) |
| `update_conta_saldo_po_payment` | Trigger: debita conta ao pagar PO | `purchase_order_payments` | `contas.saldo_atual` | ATIVA (trigger) |
| `update_purchase_order_payment_status` | Trigger: status de pagamento PO | `purchase_order_payments`, `purchase_orders` | `purchase_orders` | ATIVA (trigger) |
| `update_purchase_order_with_items` | Edita PO e seus itens | — | `purchase_orders`, `purchase_order_items` | ATIVA |
| `update_venda_pagamento_summary` | Trigger: recalcula valor_pago/pago | `pagamentos_venda` | `vendas.valor_pago`, `vendas.pago` | ATIVA (trigger) |

### 5.1 Análise detalhada: `criar_pedido`

A função existe em duas versões (migration original + update em 20260423223939). A versão atual (mais recente) faz:

```sql
-- PARTE 1: Pedido do catálogo (crítica, não tolera falha)
v_nome_novo_capitalizado := fn_capitalize_name(p_nome_cliente);

INSERT INTO cat_pedidos (nome_cliente, telefone_cliente, endereco_entrega,
  metodo_entrega, metodo_pagamento, subtotal, frete, total, observacoes,
  indicado_por, status, status_pagamento)
VALUES (..., 'pendente', 'pendente')
RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

-- Para cada item:
INSERT INTO cat_itens_pedido (pedido_id, produto_id, nome_produto,
  quantidade, preco_unitario, total)
VALUES (...);

-- PARTE 2: Sync com sistema interno (tolerante a falhas via BEGIN/EXCEPTION)
SELECT id, nome INTO v_contato_id, v_nome_atual
FROM contatos WHERE regexp_replace(telefone,...) = v_telefone_norm;

-- Se contato não existe: INSERT INTO contatos (...)
-- Se existe: UPDATE contatos SET endereco = COALESCE(...), atualizado_em = now()
-- Usa fn_count_words() para comparar nome e só atualiza se novo nome for mais completo

UPDATE cat_pedidos SET contato_id = v_contato_id WHERE id = v_pedido_id;

INSERT INTO vendas (contato_id, data, total, forma_pagamento, status,
  pago, valor_pago, taxa_entrega, origem, cat_pedido_id, observacoes)
VALUES (..., 'pendente', false, 0, ..., 'catalogo', v_pedido_id, ...);

-- Para cada item:
SELECT COALESCE(custo, 0) INTO v_custo_unitario FROM produtos WHERE id = ...;
INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario,
  subtotal, custo_unitario)
VALUES (...);

UPDATE vendas SET custo_total = v_custo_total WHERE id = v_venda_id;

-- Em caso de falha na Parte 2:
INSERT INTO cat_pedidos_pendentes_vinculacao (cat_pedido_id, motivo_falha)
VALUES (v_pedido_id, SQLERRM);
```

**Conclusão:** `criar_pedido` escreve APENAS em tabelas ATIVAS e de catálogo. **Não escreve em nenhuma tabela de feature parqueada.** Nenhuma ação necessária na Fase 2. ✅

---

## 6. Banco — Triggers

| Trigger | Tabela alvo | Evento | Função executada | Tabelas que a função toca | Classificação |
|---------|-------------|--------|-----------------|--------------------------|---------------|
| `tr_cat_pedidos_link_contato` | `cat_pedidos` | BEFORE INSERT | `fn_cat_pedidos_link_contato` | `contatos` (SELECT) | ATIVA |
| `tr_contas_a_pagar_audit` | `contas_a_pagar` | BEFORE INSERT/UPDATE | `handle_audit_fields` | — | PARQUEADA |
| `tr_contas_audit` | `contas` | BEFORE INSERT/UPDATE | `handle_audit_fields` | — | COMPARTILHADA |
| `tr_contatos_audit` | `contatos` | BEFORE INSERT/UPDATE | `handle_audit_fields` | — | ATIVA |
| `tr_lancamentos_audit` | `lancamentos` | BEFORE INSERT/UPDATE | `handle_audit_fields` | — | COMPARTILHADA |
| `tr_lancamentos_saldo` | `lancamentos` | AFTER INSERT/DELETE/UPDATE | `update_conta_saldo_lancamento` | `contas` (UPDATE) | COMPARTILHADA |
| `tr_pagamentos_cap_audit` | `pagamentos_conta_a_pagar` | BEFORE INSERT/UPDATE | `handle_audit_fields` | — | PARQUEADA |
| `tr_po_payments_saldo` | `purchase_order_payments` | AFTER INSERT/DELETE/UPDATE | `update_conta_saldo_po_payment` | `contas` (UPDATE) | ATIVA |
| `tr_prevent_delete_automatic_plan` | `plano_de_contas` | BEFORE DELETE | `prevent_delete_automatic_plan` | `plano_de_contas` (SELECT) | COMPARTILHADA |
| `tr_sync_cat_pedido_to_venda` | `cat_pedidos` | AFTER UPDATE | `fn_sync_cat_pedido_to_venda` | `contatos`, `vendas`, `itens_venda`, `produtos`, `cat_pedidos_pendentes_vinculacao` | ATIVA |
| `tr_sync_venda_to_cat_pedido` | `vendas` | AFTER UPDATE (status/pago changes) | `sync_venda_to_cat_pedido` | `cat_pedidos` (UPDATE) | ATIVA |
| `tr_update_conta_a_pagar_status` | `pagamentos_conta_a_pagar` | AFTER INSERT/DELETE | `update_conta_a_pagar_status` | `contas_a_pagar` (UPDATE), `pagamentos_conta_a_pagar` (SELECT SUM) | PARQUEADA |
| `tr_update_purchase_order_payment_status` | `purchase_order_payments` | AFTER INSERT/DELETE/UPDATE | `update_purchase_order_payment_status` | `purchase_orders` (UPDATE) | ATIVA |
| `tr_vendas_audit` | `vendas` | BEFORE INSERT/UPDATE | `handle_audit_fields` | — | ATIVA |
| `trigger_brinde_before_insert` | `vendas` | BEFORE INSERT (forma_pagamento='brinde') | `handle_brinde_before_insert` | — | ATIVA |
| `trigger_configuracoes_atualizado_em` | `configuracoes` | BEFORE UPDATE | `update_atualizado_em` | — | ATIVA |
| `trigger_produtos_atualizado_em` | `produtos` | BEFORE UPDATE | `update_atualizado_em` | — | ATIVA |
| `trigger_stock_on_status_change` | `vendas` | AFTER UPDATE OF status | `handle_stock_on_status_change` | `itens_venda` (SELECT), `produtos` (UPDATE), `plano_de_contas` (SELECT), `contas` (SELECT), `contatos` (SELECT), `lancamentos` (INSERT/DELETE) | ATIVA ⚠️ |
| `trigger_update_venda_pagamento` | `pagamentos_venda` | AFTER INSERT/DELETE/UPDATE | `update_venda_pagamento_summary` | `pagamentos_venda` (SELECT SUM), `vendas` (UPDATE) | ATIVA |
| `update_cat_pedidos_atualizado_em` | `cat_pedidos` | BEFORE UPDATE | `update_atualizado_em` | — | ATIVA |

---

## 7. Banco — Views

| View | Tabelas dependentes | Usada por | Classificação |
|------|--------------------|-----------|----|
| `crm_view_monthly_sales` | `vendas` | Indeterminada | Indeterminada |
| `crm_view_operational_snapshot` | `vendas`, `contatos` | Indeterminada | Indeterminada |
| `ranking_compras` | `vendas`, `contatos` | Ranking, `view_home_operacional` | PARQUEÁVEL (mas usada por Dashboard via view cascateada) |
| `ranking_indicacoes` | `vendas`, `contatos` | Ranking, Dashboard (TopIndicadoresWidget) | COMPARTILHADA |
| `view_lucro_liquido_mensal` | `vendas`, `lancamentos`, `purchase_order_payments` | Dashboard (getLucroLiquido), FluxoCaixa, `rpt_break_even_mensal` | COMPARTILHADA |
| `rpt_break_even_mensal` | `view_lucro_liquido_mensal` | RelatorioFabrica | PARQUEADA |
| `rpt_distribuicao_forma_pagamento` | `vendas` | RelatorioFabrica | PARQUEADA |
| `view_home_financeiro` | `vendas`, `contatos` | Dashboard (`useDashboardMetrics`) | ATIVA |
| `rpt_faturamento_comparativo` | `view_home_financeiro` | RelatorioFabrica | PARQUEADA |
| `rpt_giro_estoque` | `produtos`, `itens_venda`, `vendas`, `purchase_order_items`, `purchase_orders` | RelatorioFabrica | PARQUEADA |
| `rpt_ltv_por_cliente` | `contatos`, `vendas` | RelatorioFabrica, Ranking | PARQUEADA |
| `rpt_margem_por_sku` | `itens_venda`, `vendas`, `produtos` | RelatorioFabrica | PARQUEADA |
| `rpt_prazo_medio_recebimento` | `vendas`, `pagamentos_venda` | RelatorioFabrica, ContasReceber | PARQUEADA |
| `rpt_projecao_pagamentos` | `contas_a_pagar`, `plano_de_contas` | ContasAPagar | PARQUEADA |
| `rpt_projecao_recebimentos` | `vendas`, `contatos` | ContasReceber | PARQUEADA |
| `view_contas_a_pagar_dashboard` | `contas_a_pagar` | **Dashboard** ⚠️ | PARQUEADA (mas lida por Dashboard) |
| `view_extrato_mensal` | `lancamentos`, `purchase_order_payments`, `purchase_orders`, `contatos`, `plano_de_contas` | FluxoCaixa, `view_extrato_saldo`, `view_fluxo_resumo` | PARQUEADA |
| `view_extrato_saldo` | `view_extrato_mensal` | FluxoCaixa | PARQUEADA |
| `view_fluxo_resumo` | `view_extrato_mensal`, `vendas` | FluxoCaixa | PARQUEADA |
| `view_home_alertas` | `vendas`, `contatos` | Dashboard (AlertasRecompraWidget) | ATIVA |
| `view_home_operacional` | `vendas`, `itens_venda`, `contatos`, `ranking_indicacoes` | Dashboard (`useDashboardMetrics`) | ATIVA |
| `view_liquidado_mensal` | `vendas`, `pagamentos_venda` | Dashboard (getLiquidadoMes) | ATIVA |
| `view_relacionamento_kanban` | `contatos`, `vendas`, `configuracoes` | Relacionamento | PARQUEADA |
| `vw_marketing_pedidos` | `cat_pedidos`, `vendas` | `vw_admin_dashboard` | CATÁLOGO |
| `vw_admin_dashboard` | `produtos`, `cat_pedidos`, `vw_marketing_pedidos` | apps/catalogo (admin) | CATÁLOGO |
| `vw_catalogo_produtos` | `produtos`, `cat_imagens_produto` | apps/catalogo | CATÁLOGO |

---

## 8. Banco — Foreign Keys Cruzadas (Bombas Relógio)

> Relevante para **Fase 6** (arquivamento de tabelas). Na Fase 3 (parking de código), as tabelas permanecem — não há explosão imediata.

| FK | De tabela (tipo) | Para tabela (tipo) | Risco Fase 6 |
|----|-----------------|-------------------|-------------|
| `contas_a_pagar.plano_conta_id → plano_de_contas.id` | PARQUEADA | COMPARTILHADA | Se archivar `contas_a_pagar`, FK deve ser removida primeiro |
| `pagamentos_conta_a_pagar.conta_a_pagar_id → contas_a_pagar.id` | PARQUEADA | PARQUEADA | Arquivo em conjunto |
| `pagamentos_conta_a_pagar.conta_id → contas.id` | PARQUEADA | COMPARTILHADA | Se archivar `pagamentos_conta_a_pagar`, FK deve ser removida |
| `interacoes.contato_id → contatos.id` (CASCADE DELETE) | PARQUEADA | ATIVA | Se archivar `interacoes`, apenas remover FK — sem risco para `contatos` |
| `lancamentos.plano_conta_id → plano_de_contas.id` | COMPARTILHADA | COMPARTILHADA | ⚠️ `plano_de_contas` NÃO pode ser arquivada enquanto `lancamentos` existir |
| `lancamentos.conta_id → contas.id` | COMPARTILHADA | COMPARTILHADA | ⚠️ `contas` NÃO pode ser arquivada enquanto `lancamentos` existir |
| `lancamentos.conta_destino_id → contas.id` | COMPARTILHADA | COMPARTILHADA | Idem |
| `pagamentos_conta_a_pagar.created_by → auth.users.id` | PARQUEADA | sistema | N/A |
| `contas_a_pagar.created_by → auth.users.id` | PARQUEADA | sistema | N/A |

**Conclusão:** Não há FK de tabela ATIVA apontando para tabela EXCLUSIVAMENTE parqueada. As tabelas "parqueáveis" (`contas_a_pagar`, `pagamentos_conta_a_pagar`, `interacoes`) podem ser arquivadas na Fase 6 sem quebrar nenhuma tabela ativa, desde que as FKs sejam removidas primeiro.

---

## 9. Pontos Críticos

### 9.1 RPC `criar_pedido` — escreve em tabela parqueada?

**Resposta: NÃO.** A `criar_pedido` não escreve em nenhuma tabela que será parqueada.

Tabelas escritas (versão atualizada em 20260423223939):
1. `cat_pedidos` — ATIVA (catálogo)
2. `cat_itens_pedido` — ATIVA (catálogo)
3. `contatos` — ATIVA (INSERT ou UPDATE)
4. `vendas` — ATIVA
5. `itens_venda` — ATIVA
6. `cat_pedidos_pendentes_vinculacao` — ATIVA (fallback de erro)

Lê apenas: `contatos`, `produtos`

**Ação necessária na Fase 2:** Nenhuma. ✅

---

### 9.2 Sidesheet de Quitar — onde escreve?

O fluxo de "Quitar" existe em duas UI distintas:

**Caminho A — VendaDetalhe.tsx** (via `VendaAcoesPrincipais.tsx` botão "Quitar")
- Abre `PaymentSidebar.tsx` (`components/features/vendas/PaymentSidebar.tsx`)
- `PaymentSidebar` lê `contas` (via `cashFlowService.getContas()`) para popular o select "Conta de Destino"
- Ao confirmar, chama `onConfirm(data)` → dispara RPC `registrar_pagamento_venda`

**Caminho B — ContasReceber.tsx** (inline, sem sidesheet separado)
- A própria página `ContasReceber.tsx` tem modal inline de quitar
- Também usa `contas` e chama `registrar_pagamento_venda`

**A RPC `registrar_pagamento_venda` escreve em:**
```sql
-- 1. Registra o pagamento
INSERT INTO pagamentos_venda (venda_id, valor, data, metodo, observacao)
VALUES (p_venda_id, p_valor, p_data::timestamptz, p_metodo, p_observacao);

-- 2. Lookup do plano de contas (leitura de tabela parqueada-UI, não arquivável)
SELECT id INTO v_plano_id FROM plano_de_contas
WHERE codigo = 'RECEBIMENTO_VENDA' LIMIT 1;

-- 3. Cria lançamento no fluxo de caixa
INSERT INTO lancamentos (data, descricao, valor, tipo, conta_id,
  plano_conta_id, venda_id, origem)
VALUES (..., 'entrada', p_conta_id, v_plano_id, p_venda_id, 'venda');
```

**Tabelas envolvidas e classificação:**
| Tabela | Ação | Classificação |
|--------|------|---------------|
| `pagamentos_venda` | INSERT | **ATIVA** — funciona sem alterações ✅ |
| `vendas` | UPDATE (via trigger `update_venda_pagamento_summary`) | **ATIVA** ✅ |
| `plano_de_contas` | SELECT (código `RECEBIMENTO_VENDA`) | **COMPARTILHADA** — tabela NÃO será arquivada ✅ |
| `lancamentos` | INSERT | **COMPARTILHADA** — tabela NÃO será arquivada ✅ |
| `contas` | Lida pelo frontend (PaymentSidebar) | **COMPARTILHADA** — tabela NÃO será arquivada ✅ |

**Conclusão:** O Quitar é **100% seguro para parking**. Não depende de nenhuma tabela que será arquivada. As tabelas `plano_de_contas` e `contas` permanecem no banco mesmo após o parking de suas UIs.

---

### 9.3 Trigger de criação automática de Entrega

**Resposta: Não existe tabela `entregas` no schema. Nenhum trigger cria registros em `entregas`.**

Investigação:
- Grep em todas as migrations por "entregas" como nome de tabela: não encontrado
- A migration base (20260405045304) não define `CREATE TABLE entregas`
- Nenhuma outra migration adiciona tal tabela

A feature "Entregas / Rotas Inteligentes" é uma UI sobre `vendas WHERE status='pendente'` — lê dados de contatos para geolocalização e monta uma rota manual. Não possui tabela própria.

O trigger `trigger_stock_on_status_change` (que dispara ao alterar `vendas.status`) não escreve em `entregas` — escreve apenas em `produtos.estoque_atual` e `lancamentos` (para brindes).

**Ação necessária na Fase 2:** Nenhuma. O parking da feature Entregas é simples — apenas mover arquivos de UI. ✅

---

### 9.4 Filtro de fiados em Vendas — query e dependências

O filtro de fiados na página `Vendas.tsx` é implementado **no frontend (cliente)**, não via RPC dedicada:

```typescript
// apps/interno/src/pages/Vendas.tsx — useMemo filteredVendas
if (pagamentoFilter === 'pendente' && !isPending) return false
// onde isPending = !venda.pago && venda.valorPago === 0
```

Os dados base vêm de `useVendas({ includePending: true })` que executa:
```typescript
// src/services/vendaService.ts (inferido)
supabase.from('vendas').select(...)
```

**Tabelas consultadas:**
- `vendas` — ATIVA ✅
- `contatos` (join via contato_id) — ATIVA ✅
- `itens_venda` (optional join) — ATIVA ✅

**NÃO consulta:**
- `contas_a_receber` — tabela não existe
- Nenhuma tabela parqueada

**Conclusão:** O filtro de fiados em Vendas é completamente independente de todas as features parqueadas, incluindo Contas a Receber. O parking de Contas a Receber não afeta em nada a funcionalidade de ver fiados em Vendas. ✅

---

## 10. Recomendação Preliminar (não vinculante — para discussão na Fase 2)

| Feature | Parking total OK? | Bloqueios | Ação prévia necessária (Fase 2) |
|---------|-------------------|-----------|--------------------------------|
| Entregas / Rotas | ✅ Sim | Nenhum | Mover `pages/Entregas.tsx`, `components/features/entregas/`, `hooks/useLogistica.ts`. `LogisticsWidget.tsx` já está sem consumidor ativo — pode ser parqueado junto. |
| Ranking | ⚠️ Parcial | `TopIndicadoresWidget` compartilhado com Dashboard | Parquear `pages/Ranking.tsx` e hooks. `TopIndicadoresWidget` permanece em `components/dashboard/`. `RankingComprasWidget` pode ser parqueado. |
| Relacionamento | ⚠️ Parcial + ação prévia | Dois widgets do Dashboard navegam para `/relacionamento` | 1) Substituir navegação em `AlertasFinanceiroWidget` e `AlertasRecompraWidget` por WhatsApp direto. 2) Parquear `pages/Relacionamento.tsx`, `hooks/useRelacionamento.ts`. 3) Colunas `contatos.arquivado_em` e `status_relacionamento` permanecem inativas. |
| Fluxo de Caixa | ✅ Sim (UI) | `contas` e `lancamentos` não arquiváveis | Parquear `pages/FluxoCaixa.tsx`, `hooks/useFluxoCaixa.ts`, `useExtrato.ts`, `useExtratoDeSaldo.ts`, `useLancamentos.ts`. Os componentes financeiros compartilhados com PlanoDeContas precisam ser reorganizados. |
| Contas a Receber | ✅ Sim | Dashboard linka para cá | 1) Remover `onClick` do KpiCard "A Receber" no Dashboard. 2) Parquear `pages/ContasReceber.tsx`, `hooks/useContasReceber.ts`. |
| Contas a Pagar | ⚠️ Parcial + ação prévia | Dashboard **lê e linka** para Contas a Pagar | 1) Remover `AlertasContasAPagarWidget` do Dashboard OU desabilitar botões. 2) Remover `onClick` dos KpiCards "A Pagar" e "Vencido". 3) Avaliar se manter KPIs de CAP no Dashboard (eles leem `contas_a_pagar`). 4) Parquear `pages/ContasAPagar.tsx`, `components/features/contas-a-pagar/`, `hooks/useContasAPagar.ts`. |
| Relatório Fábrica | ✅ Sim | Configurações tem link | 1) Remover botão em `ConfiguracaoLinks.tsx`. 2) Parquear `pages/RelatorioFabrica.tsx`, `hooks/useRelatorioFabrica.ts`. |
| Plano de Contas | ✅ Sim (UI) | `plano_de_contas` não arquivável | 1) `PlanoContaModal.tsx` compartilhado com FluxoCaixa — definir quem fica com o arquivo. 2) Parquear `pages/PlanoDeContas.tsx`, `hooks/usePlanoDeContas.ts` (se não usado por FluxoCaixa ativo). Tabela permanece. |

---

## 11. Anexo: Comandos executados

### Reads de arquivos
```
Read: supabase/migrations/20260405045304_remote_schema.sql (offsets 0–3199, em seções de 400-500 linhas)
Read: supabase/migrations/20260423223939_add_name_helpers_and_update_criar_pedido.sql
Read: supabase/migrations/20260428230843_crm_kanban_schema.sql
Read: supabase/migrations/20260429002336_relacionamento_rpc_mover_card.sql
Read: apps/interno/src/App.tsx
Read: apps/interno/src/pages/Dashboard.tsx
Read: apps/interno/src/pages/Entregas.tsx
Read: apps/interno/src/pages/Ranking.tsx
Read: apps/interno/src/pages/Vendas.tsx (linhas 1-80)
Read: apps/interno/src/pages/ContasReceber.tsx (linhas 1-60)
Read: apps/interno/src/pages/FluxoCaixa.tsx (linhas 1-40)
Read: apps/interno/src/pages/PlanoDeContas.tsx (linhas 1-40)
Read: apps/interno/src/components/layout/AppLayout.tsx
Read: apps/interno/src/components/features/vendas/PaymentSidebar.tsx
Read: apps/interno/src/components/features/vendas/VendaAcoesPrincipais.tsx
Read: apps/interno/src/components/features/financeiro/FinanceiroFab.tsx
Read: apps/interno/src/components/dashboard/AlertasFinanceiroWidget.tsx (linhas 1-35)
Read: apps/interno/src/hooks/useContasReceber.ts
Read: apps/interno/src/hooks/useFluxoCaixa.ts
Read: apps/interno/src/hooks/useLogistica.ts
Read: apps/interno/src/hooks/useLancamentos.ts
```

### Buscas com Grep/Glob
```
Glob: apps/interno/src/**  → estrutura de arquivos
Glob: apps/interno/src/pages/*.tsx  → lista de páginas
Glob: apps/interno/src/components/features/**/*.tsx  → componentes
Glob: apps/interno/src/hooks/use*.ts  → hooks
Glob: supabase/migrations/*.sql  → migrations

Grep: "quitar|Quitar|registrar_pagamento" path=apps/interno/src  glob=*.tsx
Grep: "entregas|fluxo.caixa|contas.a.receber|..." path=apps/interno/src/components  glob=*.tsx
Grep: "from.*features/entregas|from.*features/financeiro|from.*features/contas-a-pagar" path=apps/interno/src  glob=*.tsx
Grep: "LogisticsWidget|UltimasVendasWidget|AlertasFinanceiro|AlertasRecompra|AlertasContasAPagar" path=apps/interno/src  glob=*.tsx
```
