# Guia de Desenvolvimento — Mont Monorepo

## Pré-requisitos
- Node.js 20+
- pnpm 9+
- Docker Desktop (apenas para alterações de banco e testes)
- Supabase CLI (`npm install -g supabase`)

## Comandos básicos
- `pnpm --filter catalogo dev` — roda catálogo em dev (localhost:3000)
- `pnpm --filter interno dev` — roda sistema interno em dev (localhost:5173)
- `pnpm turbo build` — builda tudo
- `pnpm turbo build --filter=catalogo` — builda só o catálogo
- `pnpm turbo build --filter=interno` — builda só o interno

## Fluxo de desenvolvimento

### Alterações de código (UI, lógica, componentes)
Desenvolva normalmente. Não precisa de Docker.
1. Rode o app desejado com `pnpm --filter [app] dev`
2. O `.env.local` de cada app aponta pro banco de produção
3. Commite e push — Vercel redeploya automaticamente

### Alterações de banco (tabelas, colunas, views, RPCs, triggers)
⚠️ NUNCA altere o banco de produção diretamente.
1. Abra o Docker Desktop
2. `npx supabase start` — sobe banco local
3. Acesse Studio local em http://127.0.0.1:54323
4. Faça as alterações no banco local
5. Teste localmente (pode apontar o app pro banco local mudando `.env.local`)
6. `npx supabase migration new nome_descritivo` — registra a migration
7. `npx supabase gen types typescript --local > packages/shared/src/database.ts` — atualiza tipos
8. Commite a migration e os tipos atualizados
9. `npx supabase db push` — aplica em produção
10. `npx supabase stop` — desliga banco local

### Rodar testes (TDD)
Testes rodam contra o banco local, nunca produção.
1. Abra o Docker Desktop
2. `npx supabase start`
3. Rode os testes: `pnpm turbo test`
4. `npx supabase stop`

## Estrutura do monorepo
```
mont/
├── apps/
│   ├── catalogo/     — Next.js 15, catálogo público
│   └── interno/      — Vite/React 19, sistema interno (Jarvis)
├── packages/
│   ├── shared/       — tipos, formatters, validators
│   └── config/       — tsconfig base
├── supabase/         — CLI config + migrations
├── turbo.json
└── pnpm-workspace.yaml
```

## Regras
- Zero `as any` — tipar corretamente sempre
- Zero gambiarras — arquitetura como engenheiro sênior
- Toda alteração de banco passa pelo fluxo de migrations
- Testes nunca rodam contra produção
