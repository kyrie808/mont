# ETAPA 5 — ITEM 2: UNIFICAR TIPOS DE PRODUTO

## CONTEXTO

Leia os seguintes arquivos na raiz do monorepo para contexto:
- `analise-monorepo.md` — a análise original identificou tipos divergentes de Produto
- `auditoria-monetaria.md` — confirma que todos os valores são reais (numeric) agora
- `changelog-correcao-monetaria.md` — registro das alterações monetárias

### O que já foi feito
- ✅ `database.ts` centralizado em `packages/shared/src/database.ts`
- ✅ Tipos base (`Produto`, `ProdutoInsert`, `ProdutoUpdate`) exportados pelo `@mont/shared`
- ✅ Padronização monetária completa — tudo em reais, zero conversões

### Problema atual
Existem DOIS tipos diferentes representando um produto:
- **Catálogo:** `Product` (em `apps/catalogo/src/types/product.ts`) — tipo manual com campos em inglês (`name`, `price`, `slug`, etc.), consumido por todo o frontend público
- **Interno:** `DomainProduto` ou `Produto` (via `@mont/shared` database types) — tipo gerado pelo Supabase com campos em português (`nome`, `preco`, `slug`, etc.)

Além disso, o catálogo tem um **mapper** (`apps/catalogo/src/lib/supabase/mappers.ts`) que converte `ProdutoDatabase` → `Product` (português → inglês).

### Objetivo
Eliminar a duplicação. Ter UMA representação canônica de Produto que ambos os apps usem, eliminando o mapper desnecessário do catálogo.

---

## PRINCÍPIO

🚨 **Corrigir como engenheiro sênior.** Sem gambiarras, sem "funciona por enquanto". Se o tipo do banco é em português, o frontend trabalha com português. Não existe razão técnica pra manter um mapper que só traduz nomes de campos de PT pra EN.

---

## DIAGNÓSTICO PRIMEIRO

Antes de executar, analise e reporte:

### 1. Tipo `Product` do catálogo

Leia `apps/catalogo/src/types/product.ts` e mostre o conteúdo completo. Liste todos os campos e seus tipos.

### 2. Tipo do banco (via shared)

Mostre os campos da tabela `produtos` conforme o `database.ts` do shared. Compare campo a campo com o `Product` do catálogo.

### 3. View `vw_catalogo_produtos`

Mostre a definição atual da view. Quais campos ela retorna? Os nomes são em português ou inglês? Existem aliases?

### 4. Mapper do catálogo

Leia `apps/catalogo/src/lib/supabase/mappers.ts` completo. O que ele faz exatamente? É apenas tradução de nomes (pt→en) ou tem lógica de transformação real?

### 5. Quem consome `Product` no catálogo

```bash
grep -r "Product" apps/catalogo/src --include='*.ts' --include='*.tsx' -l
grep -r "product\." apps/catalogo/src --include='*.ts' --include='*.tsx' -l
```

Liste os arquivos e quais campos de `Product` cada um usa (ex: `product.name`, `product.price`, `product.slug`).

### 6. Quem consome tipos de Produto no interno

```bash
grep -r "Produto\|DomainProduto" apps/interno/src --include='*.ts' --include='*.tsx' -l
```

### 7. Decisão de nomenclatura

O banco usa português (`nome`, `preco`, `descricao`, `slug`). A view pode ter aliases. O frontend do catálogo hoje usa inglês (`name`, `price`, `description`, `slug`).

A pergunta é: manter português (como o banco) ou inglês (como o catálogo)?

**Analise os prós e contras de cada abordagem e recomende.** Considere:
- O banco é a fonte de verdade e está em português
- O interno inteiro já trabalha em português
- O catálogo é o único que usa inglês
- Mudar o catálogo pra português = mudar muitos componentes
- Mudar o banco pra inglês = alterar schema (não queremos isso agora)
- Manter a view com aliases em inglês = meio termo (view traduz, frontend usa inglês)

Reporte o diagnóstico completo com sua recomendação antes de executar.

---

## EXECUÇÃO (após diagnóstico validado)

A execução depende da decisão de nomenclatura. Independente da decisão, o resultado final deve ser:

### Cenário A — Se a decisão for manter PORTUGUÊS (recomendado se o impacto for gerenciável)

1. Deletar `apps/catalogo/src/types/product.ts`
2. Catálogo passa a usar `Produto` do `@mont/shared` diretamente
3. Deletar ou simplificar o mapper (se a view retorna os mesmos campos que o tipo, não precisa de mapper)
4. Atualizar TODOS os componentes do catálogo: `product.name` → `produto.nome`, `product.price` → `produto.preco`, etc.
5. Atualizar a view `vw_catalogo_produtos` se necessário (remover aliases em inglês)

### Cenário B — Se a decisão for manter INGLÊS via view

1. A view `vw_catalogo_produtos` faz os aliases (nome AS name, preco AS price, etc.)
2. Criar um tipo `CatalogProduct` no shared que reflete o output da view
3. Catálogo usa `CatalogProduct`, interno usa `Produto`
4. Deletar o mapper do catálogo (a view já faz o trabalho)
5. Ainda são dois tipos, mas com fonte única (view define a tradução, não o código JS)

### Cenário C — Se existir outra abordagem melhor

Proponha e justifique.

### Independente do cenário

1. Deletar todo código de mapeamento desnecessário
2. Verificar e atualizar `ProductImage` e qualquer subtipo relacionado
3. Garantir que o carrinho (`cart/store.ts`) usa o tipo correto
4. Garantir que a API route de pedidos usa o tipo correto
5. Garantir que o admin do catálogo usa o tipo correto

### Build e validação

```bash
pnpm turbo build --filter=catalogo
pnpm turbo build --filter=interno
```

### Verificação final

```bash
# Se cenário A: nenhuma referência a Product (com P maiúsculo como tipo) no catálogo
grep -r "type Product " apps/catalogo/src --include='*.ts' --include='*.tsx'
grep -r "interface Product " apps/catalogo/src --include='*.ts' --include='*.tsx'

# Mapper eliminado ou simplificado
cat apps/catalogo/src/lib/supabase/mappers.ts
```

---

## O QUE NÃO FAZER

- 🚨 NÃO altere o schema do banco (tabelas, colunas)
- 🚨 NÃO altere RPCs, triggers ou views sem justificativa clara
- 🚨 NÃO altere lógica de negócio (cálculos, validações)
- 🚨 NÃO atualize versões de dependências
- 🚨 NÃO toque nos tipos do interno que já funcionam (`DomainProduto`, `Produto`)

## CRITÉRIO DE ACEITE

- Um ÚNICO tipo canônico de Produto usado por ambos os apps (ou dois tipos derivados da mesma fonte)
- Zero mappers que apenas traduzem nomes de campos
- Ambos os builds passam sem erros
- Commit descritivo e push pro main
