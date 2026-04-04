# SPRINT DE CORREÇÃO ARQUITETURAL — BLOCO 1 + BLOCO 2

## CONTEXTO

O monorepo Mont (`kyrie808/mont`) está em produção com dois apps:
- `apps/catalogo` — Next.js, catálogo público em montdistribuidora.com.br
- `apps/interno` — Vite/React, sistema interno (Jarvis) em sistema.montdistribuidora.com.br

Ambos compartilham o Supabase `herlvujykltxnwqmwmyx`.

### Problema arquitetural
O banco armazena valores monetários em **reais** (numeric) em 22 de 27 colunas. As 5 exceções estão nas tabelas `cat_pedidos` e `cat_itens_pedido`, que usam **centavos** (integer). Isso força conversões desnecessárias em views, RPCs, triggers e frontend. Um engenheiro sênior não deixaria duas convenções monetárias no mesmo banco.

### Objetivo
Padronizar TUDO em **reais** (numeric). Eliminar toda conversão centavos↔reais. Uma convenção, zero ambiguidade.

### Problemas adicionais a corrigir (da auditoria monetária)
- **ALERTA-1:** Trigger `fn_sync_cat_pedido_to_venda` não cria `itens_venda` quando pedido é marcado como entregue via admin do catálogo. Margem de lucro fica zerada.
- **ALERTA-2:** RPC `criar_pedido` tem overload duplicado (versão com e sem endereço).

---

## REGRA ABSOLUTA

🚨 **EXECUÇÃO INCREMENTAL COM CHECKPOINTS.** Este sprint altera schema do banco, views, RPCs, triggers E frontend. A ordem de execução é CRÍTICA. Complete cada fase, teste, commite, e só depois avance. Se algo falhar, PARE e reporte.

🚨 **BACKUP PRIMEIRO.** Antes de qualquer alteração no banco, documente o estado atual de cada objeto que será alterado (DDL completo da tabela, view, RPC, trigger).

---

## ENTREGÁVEL

1. Arquivo `backup-pre-correcao.md` na raiz — DDL completo de todos os objetos antes da alteração
2. Banco migrado com todas as colunas em reais
3. Views, RPCs, triggers corrigidos
4. Frontend do catálogo ajustado
5. Ambos os apps buildando sem erros
6. Arquivo `changelog-correcao-monetaria.md` na raiz — registro de tudo que foi alterado

---

## FASE 0 — BACKUP E DOCUMENTAÇÃO DO ESTADO ATUAL

Antes de qualquer alteração, documente no arquivo `backup-pre-correcao.md`:

1. DDL completo das tabelas `cat_pedidos` e `cat_itens_pedido` (CREATE TABLE com todas as constraints)
2. DDL completo de TODAS as views que referenciam essas tabelas ou fazem conversão centavos↔reais:
   - `vw_catalogo_produtos` (a que faz `preco * 100`)
   - `vw_admin_dashboard` (se referencia `_centavos`)
   - `vw_marketing_pedidos` (se referencia `_centavos`)
   - Qualquer outra view que contenha a palavra `centavos` ou faça `* 100` ou `/ 100`
3. DDL completo das RPCs:
   - `criar_pedido` (AMBAS as versões — a com endereço e a sem)
   - Qualquer outra RPC que lida com valores monetários das tabelas cat_*
4. DDL completo dos triggers e functions:
   - `fn_sync_cat_pedido_to_venda`
   - `tr_sync_cat_pedido_to_venda`
   - `fn_sync_venda_to_cat_pedido`
   - `tr_sync_venda_to_cat_pedido`
   - Qualquer outro trigger que referencia colunas `_centavos`
5. Dados atuais: rode `SELECT id, subtotal_centavos, frete_centavos, total_centavos FROM cat_pedidos LIMIT 10` e salve no backup
6. Dados atuais: rode `SELECT id, preco_unitario_centavos, total_centavos FROM cat_itens_pedido LIMIT 10` e salve no backup

### Critério de aceite
- Arquivo `backup-pre-correcao.md` completo e commitado
- NÃO altere nada ainda

---

## FASE 1 — MIGRAÇÃO DAS COLUNAS NO BANCO

### 1.1 — Alterar `cat_pedidos`

Renomear e converter as 3 colunas:

```sql
-- Adicionar novas colunas em reais (numeric)
ALTER TABLE cat_pedidos ADD COLUMN subtotal numeric;
ALTER TABLE cat_pedidos ADD COLUMN frete numeric;
ALTER TABLE cat_pedidos ADD COLUMN total numeric;

-- Migrar dados existentes (centavos → reais)
UPDATE cat_pedidos SET
  subtotal = subtotal_centavos / 100.0,
  frete = frete_centavos / 100.0,
  total = total_centavos / 100.0;

-- Dropar colunas antigas
ALTER TABLE cat_pedidos DROP COLUMN subtotal_centavos;
ALTER TABLE cat_pedidos DROP COLUMN frete_centavos;
ALTER TABLE cat_pedidos DROP COLUMN total_centavos;
```

⚠️ **ATENÇÃO:** Antes de dropar as colunas antigas, verifique se há constraints, indexes, ou triggers que referenciam os nomes antigos. Se houver, ajuste-os primeiro.

⚠️ **ATENÇÃO:** Se preferir uma abordagem mais segura, mantenha as colunas antigas temporariamente e drope depois de validar tudo. A decisão é sua, mas documente o que fez.

### 1.2 — Alterar `cat_itens_pedido`

Mesmo processo:

```sql
ALTER TABLE cat_itens_pedido ADD COLUMN preco_unitario numeric;
ALTER TABLE cat_itens_pedido ADD COLUMN total numeric;

UPDATE cat_itens_pedido SET
  preco_unitario = preco_unitario_centavos / 100.0,
  total = total_centavos / 100.0;

ALTER TABLE cat_itens_pedido DROP COLUMN preco_unitario_centavos;
ALTER TABLE cat_itens_pedido DROP COLUMN total_centavos;
```

### 1.3 — Verificação pós-migração

```sql
-- Confirmar que os dados migraram corretamente
SELECT id, subtotal, frete, total FROM cat_pedidos LIMIT 10;
SELECT id, preco_unitario, total FROM cat_itens_pedido LIMIT 10;
```

Compare com os dados do backup. R$ 65,00 deve aparecer como `65.00` (não `6500`).

### Critério de aceite
- Colunas renomeadas e convertidas
- Dados corretos (verificar comparando com backup)
- Zero dados corrompidos

---

## FASE 2 — CORRIGIR VIEWS

Toda view que fazia conversão centavos↔reais ou referenciava colunas `_centavos` precisa ser atualizada.

### 2.1 — `vw_catalogo_produtos`

A view atual faz `((preco * 100))::integer AS price_cents`. Agora que o catálogo vai trabalhar em reais, essa conversão não é mais necessária.

**OPÇÃO A (recomendada):** Remover a coluna `price_cents` e adicionar `price` que retorna `preco` direto (numeric).
**OPÇÃO B:** Manter como alias `price` = `preco` (sem conversão).

Escolha a opção que cause menos impacto no frontend (verifique como o catálogo consome essa view — provavelmente via `product.price_cents` em vários arquivos).

### 2.2 — Outras views

Atualize TODAS as views que:
- Referenciam `subtotal_centavos`, `frete_centavos`, `total_centavos`, `preco_unitario_centavos` → usar os novos nomes (`subtotal`, `frete`, `total`, `preco_unitario`)
- Fazem `* 100` ou `/ 100` para conversão monetária → remover a conversão
- Retornam aliases com `_cents` no nome → renomear para sem `_cents`

Liste TODAS as views alteradas no changelog.

### Critério de aceite
- Todas as views recriadadas sem erros
- Nenhuma view faz conversão centavos↔reais
- Nenhuma coluna retornada tem `_cents` ou `_centavos` no nome

---

## FASE 3 — CORRIGIR RPCs

### 3.1 — `criar_pedido` (corrige + resolve ALERTA-2)

1. **Remover a versão legacy** (sem parâmetros de endereço)
2. **Atualizar a versão atual** para:
   - Receber valores em **reais** (não mais centavos)
   - Remover toda divisão por 100 ao inserir em `vendas` e `itens_venda`
   - Inserir direto: `subtotal` → `vendas.total`, `preco_unitario` → `itens_venda.preco_unitario`
   - Manter a criação de `itens_venda` (que já existe nesta RPC)

### 3.2 — Outras RPCs

Verifique TODAS as RPCs que:
- Recebem ou retornam valores em centavos → ajustar para reais
- Fazem `/ 100` ou `* 100` → remover conversão

### Critério de aceite
- Apenas UMA versão de `criar_pedido` existe
- Nenhuma RPC faz conversão centavos↔reais
- RPC `criar_pedido` recebe reais e insere reais

---

## FASE 4 — CORRIGIR TRIGGERS (+ resolve ALERTA-1)

### 4.1 — `fn_sync_cat_pedido_to_venda`

Este trigger hoje:
- Cria `venda` quando `cat_pedidos` muda para status 'entregue'
- Faz conversão centavos→reais (que não será mais necessária)
- **NÃO cria `itens_venda`** (ALERTA-1)

Corrigir para:
- Remover conversão (agora ambas as tabelas estão em reais)
- **Adicionar lógica para copiar `cat_itens_pedido` → `itens_venda`** com os dados corretos:
  - `preco_unitario` → `itens_venda.preco_unitario`
  - `quantidade` → `itens_venda.quantidade`
  - `total` → `itens_venda.subtotal`
  - Buscar `custo` da tabela `produtos` para preencher `itens_venda.custo_unitario`
  - Calcular `vendas.custo_total` como soma dos custos

### 4.2 — `fn_sync_venda_to_cat_pedido`

Se este trigger faz conversão reais→centavos, remover a conversão (agora ambas em reais).

### 4.3 — Outros triggers

Verifique TODOS os triggers que referenciam colunas `_centavos` e atualize.

### Critério de aceite
- Triggers não fazem nenhuma conversão centavos↔reais
- `fn_sync_cat_pedido_to_venda` agora cria `itens_venda` com custos
- Testar: simular um UPDATE em `cat_pedidos` (status → 'entregue') e verificar se `vendas` + `itens_venda` são criados corretamente

---

## FASE 5 — CORRIGIR FRONTEND DO CATÁLOGO

### 5.1 — Types

Atualizar o tipo `Product` em `apps/catalogo/src/types/product.ts`:
- `price_cents: number` → `price: number` (ou equivalente, conforme a view atualizada)
- `anchor_price_cents: number` → `anchor_price: number` (se existir)
- Qualquer outro campo com `_cents`

### 5.2 — Mappers

Atualizar `apps/catalogo/src/lib/supabase/mappers.ts`:
- Mapear os novos nomes de campos da view

### 5.3 — formatCurrency

O `formatCurrency` local do catálogo (`apps/catalogo/src/lib/utils/format.ts`) hoje divide por 100. Agora que tudo é reais:
- **Remover a divisão por 100**
- O `formatCurrency` do catálogo deve funcionar igual ao do `@mont/shared` (recebe reais, formata direto)
- Avaliar: faz sentido o catálogo passar a usar o `formatCurrency` do `@mont/shared` diretamente? Se sim, fazer a troca. Se não (por alguma especificidade), manter local mas sem a conversão.

### 5.4 — Componentes e páginas

Atualizar TODOS os arquivos que referenciam `price_cents`, `anchor_price_cents`, `total_centavos`, `subtotal_centavos`, `frete_centavos`:

Buscar com grep em `apps/catalogo/src/`:
- `price_cents` → `price`
- `anchor_price_cents` → `anchor_price`
- `total_centavos` → `total`
- `subtotal_centavos` → `subtotal`
- `frete_centavos` → `frete`
- `/ 100` em contexto monetário → remover

Arquivos que certamente precisam de ajuste (da auditoria):
- `src/components/catalog/ProductCard.tsx` — remove `price_cents / 100`
- `src/app/(public)/produtos/[slug]/page.tsx` — remove divisão
- `src/app/(public)/carrinho/page.tsx` — remove divisão
- `src/lib/cart/store.ts` — `getTotalPrice()` agora trabalha com reais
- `src/components/admin/OrderCard.tsx` — remove `formatCurrency` inline, usa o correto
- `src/lib/whatsapp/checkout.ts` — remove `formatCurrency` inline e divisão
- `src/app/api/pedidos/route.ts` — remove `Math.round(Number(produto.preco) * 100)` (agora envia reais direto pra RPC)

### 5.5 — Interno (`apps/interno`)

Verificar se algum arquivo do interno referencia colunas com nome antigo (`_centavos`):
- `src/components/features/contatos/detalhe/CatalogOrdersHistory.tsx` — muda `pedido.totalCentavos / 100` para `pedido.total`
- Qualquer outro arquivo que use `totalCentavos`, `subtotalCentavos`, etc.

### Critério de aceite
- Zero referências a `_cents` ou `_centavos` em todo o codebase
- Zero divisões por 100 ou multiplicações por 100 em contexto monetário
- `pnpm turbo build --filter=catalogo` ✅
- `pnpm turbo build --filter=interno` ✅

---

## FASE 6 — VALIDAÇÃO FINAL

1. **Build de ambos os apps:**
   ```bash
   pnpm turbo build --filter=catalogo
   pnpm turbo build --filter=interno
   ```

2. **Verificação de dados no banco:**
   ```sql
   -- Confirmar que cat_pedidos tem valores em reais
   SELECT id, subtotal, frete, total FROM cat_pedidos LIMIT 5;
   
   -- Confirmar que cat_itens_pedido tem valores em reais
   SELECT id, preco_unitario, total FROM cat_itens_pedido LIMIT 5;
   
   -- Confirmar que a view não faz mais conversão
   SELECT nome, price FROM vw_catalogo_produtos LIMIT 5;
   ```

3. **Verificação de grep final:**
   ```bash
   # Nenhuma dessas buscas deve retornar resultados em código fonte
   grep -r "centavos" apps/ --include="*.ts" --include="*.tsx" -l
   grep -r "price_cents" apps/ --include="*.ts" --include="*.tsx" -l
   grep -r "fromCents" packages/ --include="*.ts" -l
   ```

4. **Gerar changelog:**
   Crie `changelog-correcao-monetaria.md` na raiz com:
   - Lista de todas as tabelas alteradas
   - Lista de todas as views recriadas
   - Lista de todas as RPCs alteradas
   - Lista de todos os triggers alterados
   - Lista de todos os arquivos de código alterados
   - Decisões tomadas e justificativas

5. **Commit e push:**
   ```
   feat: standardize all monetary values to reais (numeric)
   
   - Migrated 5 columns from centavos (integer) to reais (numeric)
   - Updated all views, RPCs, triggers to remove centavos conversion
   - Fixed ALERTA-1: trigger now creates itens_venda with costs
   - Fixed ALERTA-2: removed duplicate criar_pedido RPC
   - Updated catalog frontend to work with reais directly
   - Updated internal app references
   ```

---

## FASE 7 — LIMPEZA DO `@mont/shared`

Agora que tudo é reais, o parâmetro `fromCents` do `formatCurrency` no shared não tem mais razão de existir.

1. Remover o parâmetro `fromCents` de `packages/shared/src/formatters.ts`
2. Atualizar `packages/shared/src/index.ts` se necessário
3. Verificar que nenhum arquivo em nenhum app chama `formatCurrency(value, true)`
4. Build de ambos os apps para confirmar

### Critério de aceite
- `formatCurrency` aceita apenas `(value: number)` — sem segundo parâmetro
- Zero referências a `fromCents` em todo o codebase
- Ambos os builds passam

---

## O QUE NÃO FAZER

- 🚨 NÃO altere preços de produtos (isso é o Bloco 2, vem depois)
- 🚨 NÃO altere a lógica de cálculo de margem ou faturamento (apenas as conversões de unidade)
- 🚨 NÃO delete dados — apenas converta
- 🚨 NÃO altere RLS policies (a menos que referenciem colunas renomeadas)
- 🚨 Se alguma fase falhar, PARE e reporte. Não tente contornar.

---

## EXECUÇÃO INCREMENTAL

```
FASE 0 (backup) → commitar
    ↓
FASE 1 (migrar colunas) → verificar dados → commitar
    ↓
FASE 2 (corrigir views) → commitar
    ↓
FASE 3 (corrigir RPCs + ALERTA-2) → commitar
    ↓
FASE 4 (corrigir triggers + ALERTA-1) → testar sync → commitar
    ↓
FASE 5 (corrigir frontend) → buildar ambos → commitar
    ↓
FASE 6 (validação final + changelog) → commitar + push
    ↓
FASE 7 (limpar fromCents do shared) → buildar → commitar + push
```

Salve no `backup-pre-correcao.md` e execute fase por fase. Reporte checkpoint de cada fase antes de avançar.
