# BRIEFING DE EXECUÇÃO — MERGE MONOREPO MONT

## DECISÕES ESTRATÉGICAS (já validadas)

- ✅ Mover primeiro, alinhar versões (React, Zod, Zustand) incrementalmente depois
- ✅ Cada app mantém suas versões atuais de dependências durante o merge
- ✅ Supabase NÃO é tocado — zero alterações em schema, triggers, RPCs, views, RLS
- ✅ Testes serão escritos pós-merge seguindo TDD na arquitetura definitiva
- ✅ Deploy paralelo com switchover DNS (zero downtime)
- ✅ Stack do monorepo: pnpm workspaces + Turborepo

---

## REGRAS ABSOLUTAS DURANTE TODA A EXECUÇÃO

1. 🚨 **ZERO ALTERAÇÕES NO SUPABASE** — nenhum CREATE, ALTER, DROP, INSERT, UPDATE, DELETE em qualquer tabela, view, trigger, RPC ou policy. O banco fica intocado.
2. 🚨 **REPOS ANTIGOS FICAM FUNCIONANDO** — não deletar, não desconectar da Vercel. Eles são o fallback até validação completa do monorepo.
3. 🚨 **NENHUMA REFATORAÇÃO DE CÓDIGO DURANTE O MERGE** — mover arquivos, ajustar imports, e só. Não melhorar, não limpar, não otimizar. Isso vem depois.
4. 🚨 **CHECKPOINT A CADA ETAPA** — ao final de cada etapa, commitar, buildar, e reportar status antes de avançar.

---

## ETAPA 1 — SCAFFOLDING DO MONOREPO

### O que fazer
1. Criar repositório `mont` no GitHub (kyrie808)
2. Inicializar com pnpm:
   ```
   mont/
   ├── apps/
   │   ├── catalogo/          # (vazio por enquanto)
   │   └── interno/           # (vazio por enquanto)
   ├── packages/
   │   └── shared/            # utils compartilhados mínimos
   ├── package.json           # workspace root
   ├── pnpm-workspace.yaml
   ├── turbo.json
   └── .gitignore
   ```
3. Configurar `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```
4. Configurar `turbo.json` básico (build, dev, lint)
5. Criar `packages/shared/` com os arquivos verdadeiramente duplicados:
   - `cn.ts` (copiar do distribuidora — mais completo)
   - `formatters.ts` (merge manual das funções de formatação)
   - `validators.ts` (merge das validações)
   - `package.json` com name `@mont/shared`
   - `tsconfig.json`
   - `index.ts` (barrel export)

### O que NÃO fazer
- NÃO criar `@mont/ui` ainda — componentes UI são divergentes e vão continuar específicos de cada app por enquanto
- NÃO criar `@mont/config` ainda — cada app mantém seu próprio eslint/tsconfig/tailwind
- NÃO mover `database.ts` / types do Supabase para shared ainda — fazer isso depois de forma incremental

### Critério de aceite
- `pnpm install` roda sem erros na raiz
- `packages/shared` exporta `cn`, formatters e validators
- Estrutura de pastas está limpa e commitada

---

## ETAPA 2 — MOVER DISTRIBUIDORA (app interno / Jarvis)

### Por que este primeiro
- App mais estável
- Vite é mais simples de configurar em monorepo que Next.js
- Se algo quebrar, o impacto é interno (só Gilmar usa)

### O que fazer
1. Copiar TODO o conteúdo do repo `distribuidora` para `apps/interno/`
   - Incluir: `src/`, `public/`, `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`, `vercel.json`, `postcss.config.js`, `index.html`
   - NÃO copiar: `node_modules/`, `.git/`, `supabase/` (migrations ficam no repo antigo como referência)
2. Ajustar `apps/interno/package.json`:
   - Adicionar dependência: `"@mont/shared": "workspace:*"`
   - Manter TODAS as outras dependências como estão (mesmas versões)
3. Substituir imports dos arquivos que agora vivem no shared:
   - `import { cn } from '@/utils/cn'` → `import { cn } from '@mont/shared'`
   - `import { cn } from '@/lib/utils'` → `import { cn } from '@mont/shared'`
   - Apenas os arquivos que foram movidos para shared. O RESTO FICA COMO ESTÁ.
4. Rodar `pnpm install` na raiz
5. Rodar `pnpm --filter interno dev` e validar que o app abre
6. Rodar `pnpm --filter interno build` e validar que builda sem erro

### O que NÃO fazer
- NÃO refatorar services, hooks, components
- NÃO alterar a estrutura de pastas interna do app
- NÃO mexer em lógica de negócio
- NÃO atualizar versões de dependências

### Critério de aceite
- `pnpm --filter interno dev` → app abre e as rotas principais funcionam (dashboard, vendas, contatos, financeiro)
- `pnpm --filter interno build` → build completa sem erros
- Imports do `@mont/shared` resolvem corretamente
- Commit com mensagem: "feat: move distribuidora to apps/interno"

---

## ETAPA 3 — MOVER CATÁLOGO

### O que fazer
1. Copiar TODO o conteúdo do repo `catalogo-mont` para `apps/catalogo/`
   - Incluir: `src/`, `public/`, `scripts/`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`
   - NÃO copiar: `node_modules/`, `.git/`, `supabase/`
2. Ajustar `apps/catalogo/package.json`:
   - Adicionar: `"@mont/shared": "workspace:*"`
   - Manter TODAS as outras dependências como estão (React 18, Zod 3, Zustand 4 — tudo fica)
3. Substituir imports dos shared (APENAS os que foram movidos):
   - `import { cn } from '@/lib/utils/cn'` → `import { cn } from '@mont/shared'`
   - Formatters que foram unificados
4. Validar `next.config.js` — pode precisar de `transpilePackages: ['@mont/shared']` para Next.js resolver o workspace package
5. Rodar `pnpm --filter catalogo dev` → validar que abre
6. Rodar `pnpm --filter catalogo build` → validar build
7. Testar manualmente: homepage, listagem de produtos, carrinho, checkout WhatsApp

### Atenção especial
- Next.js em monorepo pode ter issues com module resolution. Se o build falhar com erro de import do `@mont/shared`, adicionar em `next.config.js`:
  ```js
  transpilePackages: ['@mont/shared']
  ```
- O catálogo usa SSR (server components, middleware, API routes). Verificar que nada quebrou por causa de path changes.
- O `src/lib/supabase/` do catálogo (client.ts, server.ts, admin.ts) FICA no app — não vai pro shared. É SSR-specific.

### Critério de aceite
- `pnpm --filter catalogo dev` → site abre, produtos carregam, carrinho funciona
- `pnpm --filter catalogo build` → build completa
- Admin dashboard funciona (login + gestão de pedidos)
- Commit: "feat: move catalogo-mont to apps/catalogo"

---

## ETAPA 4 — DEPLOY NA VERCEL

### Pré-requisito
- Ambos os apps buildando localmente sem erros
- Monorepo commitado e pushado no GitHub

### O que fazer
1. Criar NOVO projeto na Vercel para o catálogo apontando para o monorepo:
   - Root Directory: `apps/catalogo`
   - Build Command: `cd ../.. && pnpm turbo build --filter=catalogo`
   - Output Directory: `apps/catalogo/.next`
   - Framework Preset: Next.js
   - Env vars: copiar TODAS do projeto antigo do catálogo
2. Criar NOVO projeto na Vercel para o interno:
   - Root Directory: `apps/interno`
   - Build Command: `cd ../.. && pnpm turbo build --filter=interno`
   - Output Directory: `apps/interno/dist`
   - Framework Preset: Vite
   - Env vars: copiar TODAS do projeto antigo
3. Deploy em preview URL (NÃO apontar domínios ainda)
4. Validar AMBOS os apps nas URLs de preview:
   - Catálogo: navegar, ver produtos, testar carrinho e checkout
   - Interno: login, dashboard, criar venda teste, verificar sync
5. **SOMENTE após validação completa**: apontar domínios
   - `montdistribuidora.com.br` → novo projeto do catálogo
   - Domínio/subdomínio do interno → novo projeto do interno
6. Monitorar por 30 minutos após switchover
7. Manter projetos antigos na Vercel (desativados mas não deletados) como fallback por 2 semanas

### Rollback plan
- Se algo quebrar após switchover: reverter apontamento de domínio na Vercel (< 5 min)
- Os deploys antigos continuam ativos e podem receber o domínio de volta instantaneamente

### Critério de aceite
- Ambos os apps funcionando nas URLs de preview
- Domínios apontados e respondendo corretamente
- Checkout do catálogo funcional em produção
- Sistema interno acessível e funcional para Gilmar
- Zero erros no console de ambos os apps

---

## ETAPA 5 — PÓS-MERGE (incremental, sem pressa)

Estas tarefas são feitas depois do merge estar estável em produção. Cada uma é independente e pode ser feita em sprints separados:

- [ ] Alinhar React 18 → 19 no catálogo
- [ ] Alinhar Zod 3 → 4 no catálogo
- [ ] Alinhar Zustand 4 → 5 no catálogo
- [ ] Alinhar ESLint 8 → 9 no catálogo
- [ ] Mover `database.ts` (types Supabase) para `@mont/shared`
- [ ] Criar `@mont/config` com configs compartilhadas (tsconfig, eslint, tailwind base)
- [ ] Extrair componentes UI compartilháveis para `@mont/ui`
- [ ] Unificar tipos de Produto (Product ↔ DomainProduto)
- [ ] Implementar testes (TDD) para fluxos críticos
- [ ] Unificar migrations em pasta `supabase/` na raiz
- [ ] Arquivar repos antigos como read-only
- [ ] Rotacionar credenciais Supabase (já estava flaggado)

---

## RESUMO DO FLUXO

```
ETAPA 1 (scaffolding) → commit/validar
    ↓
ETAPA 2 (mover interno) → commit/validar/buildar
    ↓
ETAPA 3 (mover catálogo) → commit/validar/buildar
    ↓
ETAPA 4 (deploy preview → validar → switchover DNS)
    ↓
ETAPA 5 (alinhamento incremental, TDD, consolidação)
```

Tempo estimado de execução (etapas 1-4): 4-6 horas
Downtime estimado: zero (se switchover DNS for bem sucedido)
