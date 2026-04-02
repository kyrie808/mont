# Vercel Deployment Configuration for Mont Monorepo

Este documento contém as configurações exatas para realizar o deploy estruturado na Vercel a partir do monorepo, mantendo os apps independentes mas consumindo pacotes compartilhados via Turborepo/pnpm.

## 1. Catálogo (`apps/catalogo`)

- **Project Name:** `catalogo-mont` (ou o nome que desejar no Vercel Dashboard)
- **Repository:** `kyrie808/mont`
- **Root Directory:** `apps/catalogo`
- **Framework Preset:** `Next.js`
- **Build Command:** `pnpm turbo build --filter=catalogo`
- **Output Directory:** `.next` (ou deixe Vercel inferir como Next.js)
- **Install Command:** `pnpm install`
- **Node.js Version:** `20.x` (Next 14 exige Node > 18.17, 20.x é o LTS ideal configurado na Vercel)
- **Ignored Build Step:** `npx turbo-ignore` (Impede que alterações na pasta do app interno gerem triggers disparando build do catálogo)

### Variáveis de Ambiente necessárias (`apps/catalogo`)
Listadas abaixo (adicione no painel Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `NEXT_PUBLIC_APP_URL`

<br/>

## 2. ERP / Interno (`apps/interno`)

- **Project Name:** `distribuidora-interno` (ou o nome que desejar)
- **Repository:** `kyrie808/mont`
- **Root Directory:** `apps/interno`
- **Framework Preset:** `Vite`
- **Build Command:** `pnpm turbo build --filter=interno`
- **Output Directory:** `dist`
- **Install Command:** `pnpm install`
- **Node.js Version:** `20.x`
- **Ignored Build Step:** `npx turbo-ignore` (Impede que alterações no app `catalogo` ativem rebuilds automáticos descenessários do ERP)

### Variáveis de Ambiente necessárias (`apps/interno`)
Listadas abaixo:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

<br/>

---

## Notas Adicionais e `vercel.json`

### `vercel.json` em cada App
- **apps/interno:** Foi validado e ajustado. Ele contém a configuração de `rewrites` com `"source": "/(.*)"` redirecionando para `/index.html`. Isso é necessário para que as rotas cliente (React Router DOM) funcionem sem retornar erro 404 ao atualizar a página. Não existem rotas de API neste app e lixo remanescente foi removido da config.
- **apps/catalogo:** Não deve existir `vercel.json` neste diretório. A Vercel constrói tudo usando detectores nativos para o _framework preset_ do Next.js (SSR, Api Routes, App Router formam saídas de funções nativamente).