# AUDITORIA MONETÁRIA — CENTAVOS vs REAIS

## CONTEXTO

O monorepo Mont tem dois apps que lidam com dinheiro de formas diferentes:
- **Catálogo** (`apps/catalogo`): historicamente trabalha com valores em **centavos** (integer). R$ 25,90 = 2590.
- **Interno** (`apps/interno`): trabalha com valores em **reais** (decimal/float). R$ 25,90 = 25.90.

Ambos compartilham o mesmo banco Supabase (`herlvujykltxnwqmwmyx`). Existe sync bidirecional via triggers entre `cat_pedidos` ↔ `vendas`.

O `@mont/shared` tem um `formatCurrency(value, fromCents?)` que aceita ambos os formatos, mas NÃO sabemos se toda a cadeia está coerente.

## REGRA ABSOLUTA

🚨 **MODO DIAGNÓSTICO.** Você NÃO vai modificar NENHUM arquivo, NENHUMA configuração, NENHUM dado no banco. Apenas leitura, análise e documentação. Zero alterações.

## ENTREGÁVEL

Gere um único arquivo `auditoria-monetaria.md` na raiz do monorepo com TODA a análise abaixo. Salve incrementalmente (fase por fase). Se o limite de tokens for atingido, o arquivo já terá as fases concluídas até aquele ponto.

---

## FASE 1 — MAPEAMENTO DE COLUNAS MONETÁRIAS NO BANCO

Use o MCP Supabase para analisar o schema e documente TODAS as colunas que armazenam valores monetários em TODAS as tabelas. Para cada coluna:

| Tabela | Coluna | Tipo SQL (integer/numeric/decimal/real/float) | Unidade (centavos ou reais?) | Como determinou |
|--------|--------|-----------------------------------------------|------------------------------|-----------------|

Verifique pelo menos estas tabelas (e qualquer outra que tenha colunas monetárias):
- `produtos` (preco, preco_promocional, ou similares)
- `cat_pedidos` (total, subtotal, ou similares)
- `cat_itens_pedido` (preco_unitario, subtotal, ou similares)
- `vendas` (valor_total, desconto, ou similares)
- `itens_venda` (preco_unitario, quantidade, subtotal, ou similares)
- `pagamentos_venda` (valor, ou similares)
- `lancamentos` (valor, ou similares)
- `contas_pagar` (valor, ou similares)
- Qualquer outra tabela com colunas monetárias

**Critério para determinar a unidade:** verifique o tipo SQL (integer geralmente = centavos, numeric/decimal = reais). Se ambíguo, consulte dados reais na tabela via MCP para inferir (ex: se um pão de queijo 1kg custa ~25.90, um valor de 2590 = centavos, um valor de 25.90 = reais).

---

## FASE 2 — MAPEAMENTO DE COMO CADA APP LÊ E ESCREVE VALORES

### 2.1 — Catálogo (`apps/catalogo`)

Para cada operação que envolve dinheiro no catálogo, documente:

| Arquivo | Operação | Valor vem de onde | Formato recebido | Conversão aplicada | Formato enviado/exibido |
|---------|----------|-------------------|-------------------|--------------------|-------------------------|

Busque em:
- `src/app/api/` — API routes que criam pedidos (INSERT em `cat_pedidos`, `cat_itens_pedido`)
- `src/lib/supabase/mappers.ts` — como os dados do banco são mapeados para o frontend
- `src/lib/utils/format.ts` — o `formatCurrency` local do catálogo (como divide por 100?)
- `src/lib/cart/store.ts` — como o carrinho armazena preços
- `src/app/(public)/_components/` — componentes que exibem preços
- `src/components/catalog/ProductCard.tsx` — como exibe preço do produto
- Qualquer outro arquivo que lida com `preco`, `price`, `total`, `subtotal`, `valor`

### 2.2 — Interno (`apps/interno`)

Mesmo mapeamento para o sistema interno:

| Arquivo | Operação | Valor vem de onde | Formato recebido | Conversão aplicada | Formato enviado/exibido |
|---------|----------|-------------------|-------------------|--------------------|-------------------------|

Busque em:
- `src/services/vendaService.ts` — como cria vendas (INSERT em `vendas`, `itens_venda`)
- `src/services/cashFlowService.ts` — como lida com fluxo de caixa
- `src/services/pagamentoService.ts` — como registra pagamentos
- `src/services/contasPagarService.ts` — como registra contas a pagar
- `src/utils/formatters.ts` — o `formatCurrency` local do interno
- `src/utils/calculations.ts` — cálculos financeiros
- `src/hooks/` — hooks que fazem queries de dados financeiros
- `src/components/features/vendas/` — componentes de venda
- `src/components/features/financeiro/` — componentes financeiros
- `src/components/dashboard/` — widgets do dashboard que mostram valores
- Qualquer outro arquivo que lida com `preco`, `price`, `total`, `subtotal`, `valor`, `revenue`, `custo`

---

## FASE 3 — ANÁLISE DOS TRIGGERS DE SYNC

Analise os triggers que sincronizam dados entre catálogo e interno:

1. **Trigger `tr_sync_venda_to_cat_pedido`** (e qualquer outro trigger de sync):
   - Qual é a direção? (`cat_pedidos` → `vendas` ou `vendas` → `cat_pedidos` ou bidirecional?)
   - Os valores monetários são copiados diretamente ou há conversão (centavos ↔ reais)?
   - Se não há conversão: os valores nas duas tabelas estão na mesma unidade?

2. **RPCs que envolvem valores monetários** (ex: `criar_pedido` ou similares):
   - A RPC recebe valores em qual formato?
   - Faz alguma conversão antes de inserir?
   - Onde é chamada (catálogo, interno, ou ambos)?

3. **Views que agregam ou calculam valores monetários:**
   - A view faz soma/média de colunas de tabelas diferentes?
   - Se sim, as unidades são compatíveis?

---

## FASE 4 — ANÁLISE DO `@mont/shared` formatCurrency

Analise o `packages/shared/src/formatters.ts`:

1. Como o `formatCurrency(value, fromCents?)` funciona exatamente?
2. Quais arquivos do catálogo chamam `formatCurrency` do shared vs do local?
3. Quais arquivos do interno chamam `formatCurrency` do shared vs do local?
4. Existe risco de um app chamar a função errada (shared quando deveria ser local, ou vice-versa)?
5. Existem chamadas de `formatCurrency` sem o parâmetro `fromCents` em contextos onde o valor é centavos? (Isso resultaria em exibição errada: R$ 2.590,00 em vez de R$ 25,90)

---

## FASE 5 — MAPA DE INCONSISTÊNCIAS E RISCOS

Com base nas fases anteriores, crie:

### 5.1 — Tabela de consistência

| Fluxo | Origem | Tabela/Coluna | Unidade no banco | App que lê | Conversão ao ler | Exibição final | ✅/⚠️/🚨 |
|-------|--------|---------------|------------------|------------|-------------------|----------------|----------|

Exemplos de fluxos:
- Cliente vê preço no catálogo
- Cliente faz pedido no catálogo → INSERT em cat_pedidos
- Trigger synca cat_pedidos → vendas
- Gilmar vê a venda no sistema interno
- Gilmar cria venda manual no interno → INSERT em vendas
- Trigger synca vendas → cat_pedidos
- Dashboard do interno mostra faturamento total
- Fluxo de caixa calcula receita
- Pagamentos parciais
- Brindes (pago=false)

### 5.2 — Lista de inconsistências encontradas

Para cada inconsistência:
- **Onde:** tabela/coluna/arquivo
- **O que está errado:** descrição clara
- **Impacto:** o que acontece na prática (valor errado na tela? cálculo errado? dado corrompido?)
- **Severidade:** 🚨 CRÍTICO (dinheiro errado) / ⚠️ ALERTA (pode causar erro) / ℹ️ INFO (melhoria recomendada)
- **Correção sugerida:** o que precisa mudar (sem implementar)

### 5.3 — Resumo executivo

- Quantas colunas monetárias existem no banco?
- Qual é a unidade predominante (centavos ou reais)?
- Os triggers fazem conversão ou copiam direto?
- Existem inconsistências críticas que afetam dinheiro real?
- Qual é a recomendação: padronizar tudo em centavos, tudo em reais, ou manter como está?
- O `formatCurrency` do shared pode ser usado com segurança por ambos os apps?

---

## FORMATO DO ARQUIVO DE SAÍDA

```markdown
# Auditoria Monetária — Mont Distribuidora

> Gerado em: [data/hora]
> Status: DIAGNÓSTICO — nenhuma alteração foi feita

## 1. Colunas Monetárias no Banco
[conteúdo da fase 1]

## 2. Leitura e Escrita por App
### 2.1 Catálogo
[conteúdo]
### 2.2 Interno
[conteúdo]

## 3. Triggers e Sync
[conteúdo da fase 3]

## 4. Análise do formatCurrency
[conteúdo da fase 4]

## 5. Inconsistências e Riscos
### 5.1 Tabela de Consistência
[tabela]
### 5.2 Inconsistências Encontradas
[lista]
### 5.3 Resumo Executivo
[resumo]
```

Seja específico. Use nomes reais de tabelas, colunas, arquivos, linhas de código. Nada genérico. Se encontrar dados reais no banco que ajudem a determinar a unidade, cite-os (ex: "produto X tem valor 2590 na coluna preco, confirmando que é centavos").
