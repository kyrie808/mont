# ETAPA 5 — CONSOLIDAÇÃO PÓS-MERGE

## CONTEXTO GERAL

Leia os seguintes arquivos na raiz do monorepo para relembrar o que foi feito e onde estamos:
- `analise-monorepo.md` — análise diagnóstica dos dois repos antes do merge
- `auditoria-monetaria.md` — auditoria completa de valores monetários
- `changelog-correcao-monetaria.md` — tudo que foi alterado na padronização monetária
- `backup-pre-correcao.md` — estado anterior do banco antes das correções
- `deploy-config.md` — configuração de deploy na Vercel

## O QUE JÁ FOI FEITO (Etapas 1-4 + Blocos 1-3)
- ✅ Monorepo criado: `apps/catalogo` (Next.js) + `apps/interno` (Vite/React) + `packages/shared`
- ✅ Ambos deployados na Vercel com domínios reais (montdistribuidora.com.br e sistema.montdistribuidora.com.br)
- ✅ Padronização monetária completa — tudo em reais (numeric), zero conversões centavos↔reais
- ✅ ALERTA-1 corrigido (trigger agora cria itens_venda com custos)
- ✅ ALERTA-2 corrigido (RPC duplicada removida)
- ✅ 4 INFOs de código morto limpos
- ✅ Auditoria de credenciais — histórico limpo

## O QUE FALTA (Etapa 5 — ordem de execução)
1. **Mover `database.ts` para `@mont/shared`** ← ESTE PROMPT
2. Unificar tipos de Produto (Product ↔ DomainProduto)
3. Alinhar React 18 → 19 no catálogo
4. Alinhar Zod 3 → 4 (ambos os apps)
5. Alinhar Zustand 4 → 5 no catálogo
6. Alinhar ESLint 8 → 9 no catálogo
7. Criar `@mont/config` (tsconfig, eslint, tailwind base compartilhados)
8. Implementar TDD para fluxos críticos
9. Extrair `@mont/ui` (componentes compartilhados)
10. Unificar migrations na raiz
11. Arquivar repos antigos como read-only

---

# ITEM 1 — MOVER `database.ts` PARA `@mont/shared`

## OBJETIVO

O arquivo `database.ts` contém os tipos TypeScript gerados automaticamente pelo Supabase (a tipagem completa do schema do banco). Hoje cada app tem sua própria cópia. Devemos ter UMA fonte única de verdade no `@mont/shared`, importada por ambos os apps.

## DIAGNÓSTICO PRIMEIRO

Antes de mover qualquer coisa, analise e reporte:

### 1. Localizar os arquivos de tipos do banco em cada app

```bash
# No interno
find apps/interno/src -name 'database.ts' -o -name 'database.types.ts' -o -name 'supabase.types.ts'

# No catálogo
find apps/catalogo/src -name 'database.ts' -o -name 'database.types.ts' -o -name 'supabase.types.ts'
```

### 2. Comparar os conteúdos

- São idênticos?
- Se divergem: quais tabelas/tipos estão em um mas não no outro?
- Qual é o mais completo e atualizado? (Provavelmente o do interno, que tem 68 migrations vs 3 do catálogo)
- Existem tipos auxiliares manuais (não gerados) adicionados ao final do arquivo? (ex: `VendaComItens`, `Conta`, etc.)

### 3. Mapear quem importa o database.ts

```bash
# No interno — quem importa de database.ts
grep -r "from.*database" apps/interno/src --include='*.ts' --include='*.tsx' -l

# No catálogo — quem importa tipos do banco
grep -r "from.*database" apps/catalogo/src --include='*.ts' --include='*.tsx' -l
grep -r "from.*types" apps/catalogo/src --include='*.ts' --include='*.tsx' -l
```

### 4. Verificar tipos auxiliares manuais

Além dos tipos gerados pelo Supabase, existem tipos manuais que dependem do `database.ts`? Exemplos:
- `VendaComItens`
- `Conta`
- `DomainProduto`
- `Product`
- Helpers como `Tables<'vendas'>`, `Enums<'status_venda'>`, etc.

Liste TODOS e em qual app/arquivo estão.

Reporte o diagnóstico completo antes de executar.

---

## EXECUÇÃO (após diagnóstico validado)

### Passo 1 — Escolher a versão canônica

Use a versão mais completa do `database.ts` (provavelmente a do interno). Se o catálogo tem tipos ou tabelas que o interno não tem, faça merge.

### Passo 2 — Mover para o shared

1. Copie o `database.ts` canônico para `packages/shared/src/database.ts`
2. Adicione o export no `packages/shared/src/index.ts`:
   ```ts
   export type { Database } from './database'
   // + qualquer outro type helper que faça sentido exportar
   ```
3. Se existem tipos auxiliares manuais (como `VendaComItens`) que são usados por AMBOS os apps, mova-os para `packages/shared/src/types/` (ou para o próprio `database.ts` se fizer sentido)
4. Se existem tipos auxiliares usados por APENAS UM app, mantenha-os no app — não polua o shared

### Passo 3 — Atualizar imports no interno

Substitua todos os imports que apontam pro `database.ts` local:
```ts
// ANTES
import type { Database } from '@/types/database'
// DEPOIS
import type { Database } from '@mont/shared'
```

O arquivo local `apps/interno/src/types/database.ts` pode ser deletado após confirmar que todos os imports foram atualizados.

### Passo 4 — Atualizar imports no catálogo

Mesmo processo. Substituir imports locais por `@mont/shared`.

### Passo 5 — Tipar os helpers

Se existem helpers como `Tables<T>`, `Enums<T>` que são usados em ambos os apps, exporte-os do shared:
```ts
// packages/shared/src/database.ts (ou types.ts)
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
```

### Passo 6 — Build e validação

```bash
pnpm turbo build --filter=catalogo
pnpm turbo build --filter=interno
```

### Passo 7 — Verificação final

```bash
# Confirmar que não existe mais database.ts local nos apps
find apps/ -name 'database.ts' -path '*/types/*'

# Confirmar que ambos importam do shared
grep -r "from '@mont/shared'" apps/interno/src --include='*.ts' --include='*.tsx' | grep -i database
grep -r "from '@mont/shared'" apps/catalogo/src --include='*.ts' --include='*.tsx' | grep -i database
```

---

## O QUE NÃO FAZER

- 🚨 NÃO altere o schema do banco
- 🚨 NÃO refatore tipos de domínio (Product, DomainProduto) — isso é o Item 2
- 🚨 NÃO altere lógica de negócio
- 🚨 NÃO atualize versões de dependências
- 🚨 Se algum tipo auxiliar manual é usado por apenas um app, NÃO mova pro shared

## CRITÉRIO DE ACEITE

- `database.ts` existe APENAS em `packages/shared/src/`
- Ambos os apps importam tipos do banco via `@mont/shared`
- Zero cópias locais de `database.ts` nos apps
- Ambos os builds passam sem erros
- Commit: `refactor: move database types to @mont/shared as single source of truth`
- Push pro main
