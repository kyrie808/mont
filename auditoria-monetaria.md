# Auditoria Monetária — Mont Distribuidora

> Gerado em: 2026-04-03 13:18 (America/Sao_Paulo)
> Status: **DIAGNÓSTICO — nenhuma alteração foi feita**
> Banco: `herlvujykltxnwqmwmyx` (Supabase)

---

## 1. Colunas Monetárias no Banco

### 1.1 Tabela Completa

| Tabela | Coluna | Tipo SQL | Unidade | Como determinou |
|--------|--------|----------|---------|-----------------|
| `produtos` | `preco` | `numeric` | **Reais** | Tipo `numeric` + dados reais: "Pão de Queijo 1kg" = `25.00` (R$ 25,00) |
| `produtos` | `custo` | `numeric` | **Reais** | Tipo `numeric` + dados reais: "Pão de Queijo 1kg" = `13.00` |
| `produtos` | `preco_ancoragem` | `numeric` | **Reais** | Tipo `numeric` + dado: "Massa 4kg" = `99` (R$ 99,00) |
| `cat_pedidos` | `subtotal_centavos` | `integer` | **Centavos** | Tipo `integer` + nome da coluna + dado: `6000` = R$ 60,00 |
| `cat_pedidos` | `frete_centavos` | `integer` | **Centavos** | Tipo `integer` + nome da coluna + dado: `0` |
| `cat_pedidos` | `total_centavos` | `integer` | **Centavos** | Tipo `integer` + nome da coluna + dado: `12500` = R$ 125,00 |
| `cat_itens_pedido` | `preco_unitario_centavos` | `integer` | **Centavos** | Tipo `integer` + nome + dado: "Massa 4kg" = `6500` = R$ 65,00 |
| `cat_itens_pedido` | `total_centavos` | `integer` | **Centavos** | Tipo `integer` + nome + dado: `6500` |
| `vendas` | `total` | `numeric` | **Reais** | Tipo `numeric` + dados: `25.00`, `65.00`, `100.00` |
| `vendas` | `taxa_entrega` | `numeric` | **Reais** | Tipo `numeric` + dados: `0` |
| `vendas` | `custo_total` | `numeric` | **Reais** | Tipo `numeric` + dados: `13.000`, `41`, `58` |
| `vendas` | `valor_pago` | `numeric` | **Reais** | Tipo `numeric` + dados: `25.00`, `100`, `65` |
| `itens_venda` | `preco_unitario` | `numeric` | **Reais** | Tipo `numeric` + dados: "Massa PdQ 1kg" = `25.00` (tabela diz preço=25.00) |
| `itens_venda` | `subtotal` | `numeric` | **Reais** | Tipo `numeric` + dados: `25.00`, `50.00`, `61.00` |
| `itens_venda` | `custo_unitario` | `numeric` | **Reais** | Tipo `numeric` + dados: `13`, `41` |
| `pagamentos_venda` | `valor` | `numeric` | **Reais** | Tipo `numeric` + dados: `25`, `50`, `65` (coerente com vendas.total) |
| `lancamentos` | `valor` | `numeric` | **Reais** | Tipo `numeric` + dados: `65.00`, `50`, `25.00` |
| `contas_a_pagar` | `valor_total` | `numeric` | **Reais** | Tipo `numeric` + dado: `1165.83` |
| `contas_a_pagar` | `valor_pago` | `numeric` | **Reais** | Tipo `numeric` + dado: `0.00` |
| `contas_a_pagar` | `saldo_devedor` | `numeric` (generated) | **Reais** | `valor_total - valor_pago` |
| `pagamentos_conta_a_pagar` | `valor` | `numeric` | **Reais** | Tipo `numeric` + check `valor > 0` |
| `contas` | `saldo_inicial` | `numeric` | **Reais** | Tipo `numeric` + dado: `0` |
| `contas` | `saldo_atual` | `numeric` | **Reais** | Tipo `numeric` + dado: `5921.00`, `1153.00` |
| `purchase_orders` | `total_amount` | `numeric` | **Reais** | Tipo `numeric` + dado: `4355.50`, `3660.00` |
| `purchase_orders` | `amount_paid` | `numeric` | **Reais** | Tipo `numeric` + dado: `3497.50` |
| `purchase_order_items` | `unit_cost` | `numeric` | **Reais** | Tipo `numeric` + dado: `13.00` (=custo pão queijo) |
| `purchase_order_items` | `total_cost` | `numeric` (generated) | **Reais** | `quantity * unit_cost` |
| `purchase_order_payments` | `amount` | `numeric` | **Reais** | Tipo `numeric` + dados: `150`, `1490`, `2508.00` |

### 1.2 Resumo

- **Total de colunas monetárias: 27**
- **Em centavos (integer): 5** — todas na família `cat_pedidos` / `cat_itens_pedido`
- **Em reais (numeric): 22** — todo o restante do sistema
- A tabela `produtos` armazena preços em **reais** (numeric). A view `vw_catalogo_produtos` **converte para centavos** na query: `((preco * 100))::integer AS price_cents`

---

## 2. Leitura e Escrita por App

### 2.1 Catálogo (`apps/catalogo`)

| Arquivo | Operação | Valor vem de onde | Formato recebido | Conversão aplicada | Formato enviado/exibido |
|---------|----------|-------------------|-------------------|--------------------|-------------------------|
| `src/lib/supabase/mappers.ts` | Lê produtos da view `vw_catalogo_produtos` | `price_cents` (integer) | **Centavos** | Nenhuma — passa direto como `price_cents` | Centavos no tipo `Product` |
| `src/lib/utils/format.ts` | `formatCurrency(cents)` | Parâmetro `cents` | **Centavos** | `cents / 100` antes de formatar | **R$ XX,XX** (correto) |
| `src/lib/cart/store.ts` | `getTotalPrice()` | `item.product.price_cents * item.quantity` | **Centavos** | Nenhuma — retorna centavos | Centavos (total) |
| `src/components/catalog/ProductCard.tsx` | Exibe preço | `price_cents` do Product | **Centavos** | `price_cents / 100` inline | **R$ XX,XX** (correto) |
| `src/components/catalog/ProductCard.tsx` | Exibe preço ancoragem | `anchor_price_cents` do Product | **Centavos** | `anchor_price_cents / 100` inline | **R$ XX,XX** (correto) |
| `src/app/(public)/produtos/[slug]/page.tsx` | Exibe preço do produto | `product.price_cents` | **Centavos** | `formatCurrency(product.price_cents)` → divide por 100 | **R$ XX,XX** (correto) |
| `src/app/(public)/carrinho/page.tsx` | Exibe totais do carrinho | `price_cents * quantity` | **Centavos** | `formatCurrency(subtotal)` → divide por 100 | **R$ XX,XX** (correto) |
| `src/app/api/pedidos/route.ts` | Cria pedido (API route) | `produtos.preco` do banco | **Reais (numeric)** | `Math.round(Number(produto.preco) * 100)` → centavos | Envia centavos na RPC `criar_pedido` |
| `src/components/admin/OrderCard.tsx` | Exibe pedidos | `order.total_centavos` | **Centavos** | `formatCurrency(val)` local (cents/100) | **R$ XX,XX** (correto) |
| `src/components/admin/ProductCard.tsx` | Exibe preço admin | `product.preco` direto do banco | **Reais** | `Number(product.preco).toFixed(2).replace('.', ',')` | **R$ XX,XX** (correto) — formata manual, não usa formatCurrency |
| `src/components/admin/ProductEditForm.tsx` | Exibe preço admin | `product.preco` direto do banco | **Reais** | `Number(product.preco).toFixed(2).replace('.', ',')` | **R$ XX,XX** (correto) |
| `src/lib/whatsapp/checkout.ts` | Gera msg WhatsApp | `subtotalCents`, `totalCents` | **Centavos** | `formatCurrency` local inline (cents/100) | **R$ XX,XX** (correto) |

**Conclusão catálogo:** O catálogo é **consistente internamente**. Toda a cadeia pública trabalha em centavos (via view `vw_catalogo_produtos`). A área admin acessa `produtos` diretamente e trata como reais. A API route converte reais→centavos corretamente (`preco * 100`). O catálogo **NÃO** usa `formatCurrency` do `@mont/shared` — sempre usa o local (`@/lib/utils/format`) que recebe centavos.

### 2.2 Interno (`apps/interno`)

| Arquivo | Operação | Valor vem de onde | Formato recebido | Conversão aplicada | Formato enviado/exibido |
|---------|----------|-------------------|-------------------|--------------------|-------------------------|
| `src/services/vendaService.ts` | `createVenda()` | `data.itens[].subtotal`, `data.taxaEntrega` | **Reais** | Nenhuma — insere direto | Reais no banco (`vendas.total`, `itens_venda.preco_unitario`) |
| `src/services/vendaService.ts` | `addPagamento()` | `valor` do formulário | **Reais** | Nenhuma — envia para RPC `registrar_pagamento_venda` | Reais |
| `src/services/vendaService.ts` | `calculateKPIs()` | `v.total`, `v.custoTotal` | **Reais** (do banco) | Nenhuma | Exibe em reais |
| `src/services/produtoService.ts` | CRUD produtos | `data.preco`, `data.custo` | **Reais** | Nenhuma — lê/escreve direto na tabela `produtos` | Reais |
| `src/services/purchaseOrderService.ts` | CRUD ordens de compra | `totalAmount`, `amountPaid` | **Reais** | Nenhuma | Reais |
| `src/components/features/vendas/NovaVenda/ProductList.tsx` | Exibe preço na lista de produtos | `produto.preco` | **Reais** | `formatCurrency(Number(produto.preco))` do `@mont/shared` | **R$ XX,XX** ✅ (shared default=reais) |
| `src/components/features/vendas/NovaVenda/CartSidebar.tsx` | Exibe items e total | `item.preco_unitario`, `item.subtotal`, `total` | **Reais** | `formatCurrency(valor)` do `@mont/shared` | **R$ XX,XX** ✅ |
| `src/components/features/vendas/PaymentSidebar.tsx` | Exibe pagamentos | `total`, `valorPago`, `pag.valor` | **Reais** | `formatCurrency(valor)` do `@mont/shared` | **R$ XX,XX** ✅ |
| `src/pages/ContasReceber.tsx` | Exibe contas a receber | `venda.total` | **Reais** | `formatCurrency(venda.total)` do `@mont/shared` | **R$ XX,XX** ✅ |
| `src/pages/ContasAPagar.tsx` | Exibe contas a pagar | `conta.valor_total`, `conta.valor_pago` | **Reais** | `formatCurrency(valor)` do `@mont/shared` | **R$ XX,XX** ✅ |
| `src/components/features/financeiro/ExtratoMensal.tsx` | Exibe extrato | `item.valor` | **Reais** | `formatCurrency(item.valor)` do `@mont/shared` | **R$ XX,XX** ✅ |
| `src/components/features/financeiro/ExtratoSaldoAcumulado.tsx` | Exibe saldos | `row.entradas`, `row.saidas` | **Reais** | `formatCurrency(Number(row.entradas))` | **R$ XX,XX** ✅ |
| `src/components/features/contatos/detalhe/CatalogOrdersHistory.tsx` | Exibe pedidos do catálogo | `pedido.totalCentavos` | **Centavos** | `formatCurrency(pedido.totalCentavos / 100)` do `@mont/shared` | **R$ XX,XX** ✅ (divide manualmente antes) |
| `src/components/features/purchase-orders/PurchaseOrderForm.tsx` | Exibe totais PO | `item.quantity * item.unit_cost`, `totalAmount` | **Reais** | `formatCurrency(valor)` do `@mont/shared` | **R$ XX,XX** ✅ |

**Conclusão interno:** O interno é **consistente internamente**. Toda a cadeia trabalha em reais. Usa `formatCurrency` do `@mont/shared` (que por padrão `fromCents=false`, ou seja, trata como reais). O único ponto onde lida com centavos é em `CatalogOrdersHistory.tsx`, onde faz a divisão manual (`totalCentavos / 100`) antes de passar ao `formatCurrency` — correto.

O interno **NÃO** usa o `formatCurrency` local de `src/utils/formatters.ts` em nenhum lugar — esse arquivo existe mas **não é importado por ninguém** para `formatCurrency`. Todo o interno importa de `@mont/shared`.

---

## 3. Triggers e Sync

### 3.1 Triggers de Sync Identificados

#### `tr_sync_cat_pedido_to_venda` (AFTER UPDATE em `cat_pedidos`)

- **Função:** `fn_sync_cat_pedido_to_venda()`
- **Direção:** `cat_pedidos` → `vendas` (unidirecional)
- **Quando dispara:** Quando `cat_pedidos.status` muda para `'entregue'` E não existe venda vinculada ainda
- **Conversão monetária:**
  - `vendas.total = NEW.total_centavos::numeric / 100` ✅ **FAZ CONVERSÃO centavos→reais**
  - `vendas.taxa_entrega = COALESCE(NEW.frete_centavos, 0)::numeric / 100` ✅ **FAZ CONVERSÃO**
- **⚠️ NÃO insere itens_venda** — apenas cria o header da venda (sem custo_total, sem itens)

#### `tr_sync_venda_to_cat_pedido` (AFTER UPDATE em `vendas`)

- **Função:** `sync_venda_to_cat_pedido()`
- **Direção:** `vendas` → `cat_pedidos` (unidirecional)
- **Quando dispara:** Quando `vendas.status` ou `vendas.pago` muda
- **Conversão monetária:** **NÃO copia valores monetários** — apenas sincroniza `status` e `status_pagamento`
- **Resultado:** ✅ Sem risco de conversão errada

#### Resumo da bidirecionalidade

A sincronização é **pseudo-bidirecional**:
- `cat_pedidos` → `vendas`: copia dados + **converte centavos→reais** (trigger `fn_sync_cat_pedido_to_venda`)
- `vendas` → `cat_pedidos`: copia apenas **status/pagamento** (trigger `sync_venda_to_cat_pedido`)

### 3.2 RPCs que envolvem valores monetários

#### `criar_pedido(...)` — **RPC PRINCIPAL**

- **Chamada por:** API route `apps/catalogo/src/app/api/pedidos/route.ts`
- **Recebe valores em:** **Centavos** (parâmetros `p_subtotal_centavos`, `p_frete_centavos`, `p_total_centavos`)
- **Conversão interna:**
  - Insere em `cat_pedidos` direto em centavos ✅
  - Insere em `vendas.total = p_total_centavos / 100.0` ✅ **CONVERTE**
  - Insere em `vendas.taxa_entrega = p_frete_centavos / 100.0` ✅ **CONVERTE**
  - Insere em `itens_venda.preco_unitario = unit_price_cents / 100.0` ✅ **CONVERTE**
  - Insere em `itens_venda.subtotal = total_centavos / 100.0` ✅ **CONVERTE**
  - `itens_venda.custo_unitario` = `produtos.custo` direto (já é reais) ✅

#### `registrar_pagamento_venda(...)` 

- **Chamada por:** `vendaService.addPagamento()` no interno
- **Recebe `p_valor` em:** **Reais** ✅
- **Insere em `pagamentos_venda.valor`:** reais ✅
- **Insere em `lancamentos.valor`:** reais ✅

#### `criar_obrigacao_parcelada(...)`

- **Recebe `p_valor_total` em:** **Reais** ✅
- **Insere em `contas_a_pagar.valor_total`:** reais ✅

#### `registrar_pagamento_conta_a_pagar(...)`

- **Recebe `p_valor` em:** **Reais** ✅
- **Insere em `pagamentos_conta_a_pagar` e `lancamentos`:** reais ✅

#### `rpt_vendas_por_periodo(...)`

- **Retorna:** `faturamento = SUM(vendas.total)` → **Reais** ✅

### 3.3 Views que agregam valores monetários

| View | Colunas monetárias | Fonte | Unidade | Status |
|------|--------------------|-------|---------|--------|
| `vw_catalogo_produtos` | `price_cents` | `(preco * 100)::integer` | **Centavos** | ✅ Converte reais→centavos corretamente |
| `vw_catalogo_produtos` | `anchor_price_cents` | `round(preco_ancoragem * 100)` | **Centavos** | ✅ |
| `vw_marketing_pedidos` | `total_cents`, `faturamento_cents` | UNION de `cat_pedidos.total_centavos` + `(vendas.total * 100)::integer` | **Centavos** | ✅ Normaliza tudo para centavos |
| `vw_admin_dashboard` | `faturamento_hoje_cents`, `faturamento_mes_cents` | Via `vw_marketing_pedidos` | **Centavos** | ✅ |
| `vw_admin_dashboard` | `total_formatted` (inline) | `cat_pedidos.total_centavos / 100.0` | **Reais** | ✅ Converte para exibição |
| `crm_view_monthly_sales` | `faturamento`, `custo_total`, `lucro` | `vendas.total`, `vendas.custo_total` | **Reais** | ✅ |
| `view_home_financeiro` | `faturamento`, `lucro_estimado`, etc. | `vendas.total`, `vendas.custo_total` | **Reais** | ✅ |
| `view_extrato_mensal` | `valor` | `lancamentos.valor` UNION `purchase_order_payments.amount` | **Reais** | ✅ Ambos em reais |
| `view_lucro_liquido_mensal` | `receita_bruta`, etc. | `vendas.total`, `purchase_order_payments.amount` | **Reais** | ✅ |
| `rpt_margem_por_sku` | `receita_total`, `custo_total` | `itens_venda.subtotal`, `itens_venda.custo_unitario` | **Reais** | ✅ |
| `rpt_projecao_recebimentos` | `total`, `valor_pago`, `saldo_aberto` | `vendas.total`, `vendas.valor_pago` | **Reais** | ✅ |
| `rpt_projecao_pagamentos` | `valor_total`, `valor_pago`, `saldo_devedor` | `contas_a_pagar.*` | **Reais** | ✅ |
| `ranking_compras` | `total_pontos` | `SUM(vendas.total)` | **Reais** | ✅ |

**⚠️ Nenhuma view mistura centavos e reais na mesma soma/agregação.** A `vw_marketing_pedidos` é a única que cruza dados de `cat_pedidos` e `vendas`, e ela normaliza tudo para centavos via `(vendas.total * 100)::integer`.

---

## 4. Análise do formatCurrency

### 4.1 Assinatura e comportamento

```typescript
// packages/shared/src/formatters.ts
export function formatCurrency(value: number, fromCents = false): string {
    const amount = fromCents ? value / 100 : value
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(amount)
}
```

- **Default `fromCents=false`**: trata `value` como **reais**
- Se `fromCents=true`: divide por 100 antes de formatar

### 4.2 Quem usa qual versão

| App | Fonte do `formatCurrency` | Comportamento | Correto? |
|-----|---------------------------|---------------|----------|
| **Catálogo** | `@/lib/utils/format` (local) | **SEMPRE divide por 100** (recebe centavos) | ✅ Correto — o catálogo trabalha em centavos |
| **Interno** | `@mont/shared` | **NUNCA divide** (default `fromCents=false`, recebe reais) | ✅ Correto — o interno trabalha em reais |

### 4.3 Riscos identificados

1. **O catálogo NÃO usa `formatCurrency` do shared em nenhum lugar.** O shared exporta `formatCurrency` com `fromCents=false` por padrão. Se alguém no catálogo importasse do shared sem passar `fromCents=true`, um preço de `6500` centavos exibiria **R$ 6.500,00** em vez de **R$ 65,00**. Porém, isso **não acontece hoje** — o catálogo tem seu próprio `formatCurrency` local que sempre divide por 100.

2. **O interno NÃO usa o `formatCurrency` local.** O `src/utils/formatters.ts` do interno tem um `formatCurrency` que faz `format(value)` (trata como reais), que é equivalente ao shared com `fromCents=false`. Existe mas está **órfão** — nenhum arquivo importa dele para `formatCurrency`.

3. **Único ponto de atenção no interno:** `CatalogOrdersHistory.tsx` (linha 49) faz `formatCurrency(pedido.totalCentavos / 100)` — ele faz a divisão manualmente antes de chamar o `formatCurrency` do shared. Funciona, mas seria mais limpo usar `formatCurrency(pedido.totalCentavos, true)` com o parâmetro `fromCents`.

4. **Nenhuma chamada de `formatCurrency` sem `fromCents` em contexto de centavos foi encontrada.**

---

## 5. Inconsistências e Riscos

### 5.1 Tabela de Consistência

| Fluxo | Origem | Tabela/Coluna | Unidade no banco | App que lê | Conversão ao ler | Exibição final | Status |
|-------|--------|---------------|------------------|------------|-------------------|----------------|--------|
| Cliente vê preço no catálogo | View `vw_catalogo_produtos` | `price_cents` | Centavos (convertido pelo SQL) | Catálogo | Nenhuma (já é cents) | `formatCurrency(cents)` → /100 → R$ XX,XX | ✅ |
| Cliente faz pedido no catálogo | API `/api/pedidos` | `produtos.preco` | Reais | Catálogo (server) | `preco * 100` → centavos | Envia centavos na RPC | ✅ |
| RPC `criar_pedido` insere `cat_pedidos` | — | `cat_pedidos.total_centavos` | Centavos | — | — | — | ✅ |
| RPC `criar_pedido` insere `vendas` | — | `vendas.total` | Reais | — | `centavos / 100.0` | — | ✅ |
| RPC `criar_pedido` insere `itens_venda` | — | `itens_venda.preco_unitario` | Reais | — | `cents / 100.0` | — | ✅ |
| Trigger synca `cat_pedidos`→`vendas` (status='entregue') | `fn_sync_cat_pedido_to_venda` | `vendas.total` | Reais | — | `total_centavos / 100` | — | ✅ |
| Trigger synca `vendas`→`cat_pedidos` | `sync_venda_to_cat_pedido` | apenas status | — | — | — | — | ✅ |
| Gilmar vê venda no interno | `vendas` | `total`, `valor_pago` | Reais | Interno | `formatCurrency(total)` (shared, reais) | R$ XX,XX | ✅ |
| Gilmar cria venda manual no interno | `vendaService.createVenda()` | `vendas.total` | Reais | Interno | Nenhuma | — | ✅ |
| Dashboard mostra faturamento total | `view_home_financeiro` | `faturamento` = `SUM(vendas.total)` | Reais | Interno | `formatCurrency(valor)` (shared) | R$ XX,XX | ✅ |
| Fluxo de caixa (extrato) | `view_extrato_mensal` | `valor` | Reais | Interno | `formatCurrency(valor)` (shared) | R$ XX,XX | ✅ |
| Pagamentos parciais | `pagamentos_venda.valor` | `valor` | Reais | Interno | `formatCurrency(valor)` (shared) | R$ XX,XX | ✅ |
| Brindes (pago=false) | `vendas` | `total` | Reais | Interno | `formatCurrency(total)` | R$ XX,XX | ✅ |
| Admin catálogo vê pedidos | `cat_pedidos` | `total_centavos` | Centavos | Catálogo admin | `formatCurrency(val)` local (/100) | R$ XX,XX | ✅ |
| Interno exibe pedidos catálogo | `cat_pedidos` | `totalCentavos` | Centavos | Interno | `formatCurrency(totalCentavos / 100)` manual | R$ XX,XX | ✅ |
| View marketing (dashboard admin catálogo) | `vw_marketing_pedidos` | `faturamento_cents` | Centavos (normalizado) | Catálogo admin | — | Centavos | ✅ |
| Admin dashboard do catálogo | `vw_admin_dashboard` | `faturamento_hoje_cents` | Centavos | Catálogo admin | — | Centavos | ✅ |

### 5.2 Inconsistências Encontradas

#### ℹ️ INFO-1: `formatCurrency` local do interno é código morto

- **Onde:** `apps/interno/src/utils/formatters.ts` → `formatCurrency(value: number)`
- **O que está errado:** A função existe mas **nenhum arquivo a importa** para uso de `formatCurrency`. Todos usam `@mont/shared`.
- **Impacto:** Nenhum impacto funcional — apenas código legado/confuso.
- **Severidade:** ℹ️ INFO
- **Correção sugerida:** Remover `formatCurrency` de `apps/interno/src/utils/formatters.ts` para evitar que alguém a importe por engano no futuro.

---

#### ℹ️ INFO-2: Divisão manual em vez de usar `fromCents=true`

- **Onde:** `apps/interno/src/components/features/contatos/detalhe/CatalogOrdersHistory.tsx:49`
- **O que está errado:** Faz `formatCurrency(pedido.totalCentavos / 100)` em vez de `formatCurrency(pedido.totalCentavos, true)`.
- **Impacto:** Funcional: nenhum — o resultado é idêntico. Semântico: menor clareza sobre a origem do valor.
- **Severidade:** ℹ️ INFO
- **Correção sugerida:** Trocar para `formatCurrency(pedido.totalCentavos, true)` para ser explícito.

---

#### ℹ️ INFO-3: `OrderCard.tsx` do catálogo define `formatCurrency` inline

- **Onde:** `apps/catalogo/src/components/admin/OrderCard.tsx:60`
- **O que está errado:** Define `const formatCurrency = (val: number) => { ... }` localmente em vez de importar do `@/lib/utils/format`.
- **Impacto:** Funcional: nenhum — faz a mesma conversão. Manutenibilidade: duplicação de lógica.
- **Severidade:** ℹ️ INFO
- **Correção sugerida:** Importar `formatCurrency` de `@/lib/utils/format` em vez de redefinir inline.

---

#### ℹ️ INFO-4: `checkout.ts` do catálogo define `formatCurrency` inline

- **Onde:** `apps/catalogo/src/lib/whatsapp/checkout.ts:29`
- **O que está errado:** Define `const formatCurrency = (cents: number) => { ... }` localmente.
- **Impacto:** Funcional: nenhum. Manutenibilidade: duplicação.
- **Severidade:** ℹ️ INFO
- **Correção sugerida:** Importar de `@/lib/utils/format`.

---

#### ⚠️ ALERTA-1: Trigger `fn_sync_cat_pedido_to_venda` NÃO cria itens_venda

- **Onde:** Função SQL `fn_sync_cat_pedido_to_venda()` (trigger AFTER UPDATE em `cat_pedidos`)
- **O que está errado:** Quando um pedido é marcado como 'entregue' via admin catálogo (sem passar pela RPC `criar_pedido`), o trigger cria uma `venda` com `total` correto mas **sem itens_venda** e **sem custo_total**.
- **Impacto:** A margem de lucro fica zerada para vendas criadas por este trigger. O dashboard de margem por SKU (`rpt_margem_por_sku`) não contabiliza esses itens.
- **Severidade:** ⚠️ ALERTA
- **Correção sugerida:** Adicionar lógica ao trigger para copiar `cat_itens_pedido` para `itens_venda` com conversão centavos→reais, e calcular `custo_total`.

---

#### ⚠️ ALERTA-2: Duas versões da RPC `criar_pedido` (overload)

- **Onde:** Funções SQL `criar_pedido` no banco
- **O que está errado:** Existem **duas** definições de `criar_pedido` com assinaturas diferentes (uma com parâmetros de endereço, outra sem). A versão mais nova (com endereço) é chamada pela API route. A versão antiga (sem endereço) pode ser chamada se os parâmetros não corresponderem.
- **Impacto:** Risco de chamar a versão errada que não atualiza endereço do contato. Ambas fazem a conversão centavos→reais corretamente.
- **Severidade:** ⚠️ ALERTA
- **Correção sugerida:** Remover a versão legacy da RPC ou consolidar em uma única com defaults para os parâmetros de endereço.

---

### 5.3 Resumo Executivo

| Pergunta | Resposta |
|----------|---------|
| Quantas colunas monetárias existem no banco? | **27 colunas** em 10 tabelas |
| Qual é a unidade predominante? | **Reais (numeric)** — 22 colunas. Apenas 5 colunas em centavos (integer), todas na família `cat_pedidos`/`cat_itens_pedido` |
| Os triggers fazem conversão ou copiam direto? | **Fazem conversão** — `fn_sync_cat_pedido_to_venda` e `criar_pedido` ambos dividem por 100 ao inserir em `vendas`/`itens_venda` |
| Existem inconsistências críticas que afetam dinheiro real? | **NÃO.** Nenhuma inconsistência 🚨 CRÍTICO encontrada. Todas as conversões estão corretas. |
| Existem riscos (ALERTA)? | **SIM.** 2 alertas: (1) trigger de sync não cria itens_venda, (2) RPC duplicada no banco. Nenhum afeta valores monetários diretamente. |
| O `formatCurrency` do shared é seguro para ambos os apps? | **SIM**, com ressalvas. O shared funciona perfeitamente para o interno (default=reais). O catálogo NÃO o usa (tem versão local para centavos). Se alguém no catálogo importasse do shared sem `fromCents=true`, haveria erro. |
| Recomendação de padronização? | **Manter como está.** A separação é intencional e bem implementada: banco em reais, catálogo converte na fronteira (view SQL e API route). O custo de migrar tudo para centavos seria alto e arriscado sem benefício claro. A arquitetura atual é coerente. |

### Veredicto Final

🟢 **O sistema monetário está COERENTE.** Não há inconsistências que afetem valores reais exibidos ou armazenados. As conversões centavos↔reais são feitas nos pontos corretos (views SQL, RPCs, API route). Os 4 itens INFO são melhorias de manutenibilidade e os 2 ALERTA são dívidas técnicas que não corrompem dados financeiros.
