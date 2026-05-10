# Briefing: Mapeamento de Acoplamento — Parking de Features

**Projeto:** Mont — Sistema Interno (`apps/interno`)
**Repositório:** `kyrie808/mont` (monorepo pnpm + Turborepo)
**Data:** 09/05/2026
**Fase:** 1 de 5 (Diagnóstico — apenas leitura)
**Tipo:** Brownfield refactor — preparação para parking de features
**Executor:** Claude Code

---

## 1. Contexto

O sistema interno da Mont Distribuidora foi desenvolvido com mais features do que o usuário final (Gilmar, operador único do sistema) demandou. Houve scope creep: várias features foram construídas antecipadamente como "essenciais para uma distribuidora", mas o Gilmar nunca aprendeu a usá-las e a carga cognitiva (dele e do brownfield em andamento) está alta demais.

A decisão estratégica já tomada: **parquear 8 features** (mover código para `_parked/` e exibi-las desativadas com cadeado na sidebar). Antes de mover qualquer arquivo ou alterar qualquer coisa no banco, é necessário **mapear todas as dependências cruzadas** entre as features que serão parqueadas e as features que permanecerão ativas. Sem esse mapa, qualquer movimento é cego e quebra produção.

Esta tarefa é **estritamente diagnóstico**. Nenhuma alteração de código, schema, ou execução de comandos destrutivos será feita aqui.

---

## 2. Decisão estratégica (já tomada)

### 2.1 Features que serão PARQUEADAS (8)

| # | Feature | Bloco na sidebar |
|---|---------|------------------|
| 1 | Entregas / Rotas Inteligentes | OPERAÇÕES |
| 2 | Ranking | GESTÃO |
| 3 | Relacionamento | GESTÃO |
| 4 | Fluxo de Caixa | FINANCEIRO |
| 5 | Contas a Receber | FINANCEIRO |
| 6 | Contas a Pagar | FINANCEIRO |
| 7 | Relatório Fábrica | FINANCEIRO |
| 8 | Plano de Contas | FINANCEIRO |

### 2.2 Features que permanecerão ATIVAS

- Dashboard / Início (OPERAÇÕES) — pode ter widgets que dependem de features parqueadas
- Clientes (OPERAÇÕES)
- Nova Venda (OPERAÇÕES)
- Vendas (OPERAÇÕES) — **contém o filtro original de "fiados"**
- Estoque (GESTÃO)
- Produtos (GESTÃO)
- Pedidos de Compra (GESTÃO)
- Configurações (SISTEMA)

### 2.3 Pontos críticos do domínio (já conhecidos)

- O Gilmar dá baixa em pagamento por dois caminhos hoje: (a) abrindo o pedido a partir da página de Vendas, (b) através do histórico do perfil do cliente. Em ambos há um botão **"Quitar"** que abre um sidesheet com formulário.
- A página **Contas a Receber** foi desenvolvida recentemente como parte do módulo financeiro, mas a função de "ver quem deve" já existe desde o início via filtro de fiados em Vendas. As duas leem essencialmente o mesmo dado.
- Existe uma RPC `criar_pedido` que provavelmente toca múltiplas tabelas (vendas, pedido_itens, possivelmente pagamentos, possivelmente entregas). Sua superfície precisa ser mapeada com cuidado.
- Existem funções `fn_count_words` e `fn_capitalize_name` no banco que NÃO devem ser tocadas (são utilitárias, não pertencem a features parqueadas).

---

## 3. Objetivo desta tarefa

Produzir **um único relatório em markdown** que responde, com precisão e exemplos concretos de código/SQL, às perguntas:

1. Quais arquivos do frontend pertencem exclusivamente a cada feature parqueada?
2. Onde features ativas dependem de código de features parqueadas (imports, links, widgets)?
3. Quais tabelas do banco são **exclusivas** das features parqueadas vs **compartilhadas** com features ativas?
4. Quais triggers, RPCs e views tocam essas tabelas?
5. O que a RPC `criar_pedido` toca? Ela escreve em alguma tabela de feature parqueada?
6. Como funciona o fluxo de "Quitar" (sidesheet de baixa de pagamento)? Em qual(is) tabela(s) ele escreve? Essas tabelas são exclusivas, compartilhadas ou parqueáveis?
7. Existe trigger que cria registro em `entregas` (ou similar) automaticamente quando uma venda é criada? Onde está e o que faz?

---

## 4. Escopo: DIAGNÓSTICO APENAS

A entrega esperada é **um arquivo markdown**. Nada além disso.

---

## 5. Restrições absolutas (não negociáveis)

🚫 **NÃO** alterar nenhum arquivo de código (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, etc).
🚫 **NÃO** alterar nada no schema do banco (sem `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`).
🚫 **NÃO** criar, mover ou deletar pastas/arquivos do código fonte.
🚫 **NÃO** comentar, desabilitar ou refatorar código existente.
🚫 **NÃO** criar migrations novas.
🚫 **NÃO** instalar dependências (`pnpm add`, `npm install`, etc).
🚫 **NÃO** executar comandos destrutivos: `supabase db push`, `db reset`, `migration repair`, `git reset --hard`, etc.
🚫 **NÃO** modificar `package.json`, `tsconfig.json`, `.gitignore`, ou qualquer config.

✅ **PERMITIDO:** ler arquivos, executar `grep`/`rg`, executar comandos read-only do Supabase CLI (`supabase db dump --schema public --data-only=false` em modo leitura, `supabase migration list`), executar queries SELECT no banco se necessário para descoberta, criar **um único arquivo novo** em `docs/brownfield/parking-feature-map-2026-05-09.md`.

A regra do `git diff` se aplica: ao final, `git diff` deve mostrar apenas o arquivo de relatório criado. Qualquer outra mudança não autorizada é falha de execução.

---

## 6. Análises requeridas

### 6.1 Frontend — `apps/interno`

Para cada uma das 8 features parqueadas, mapear:

**A) Arquivos exclusivos da feature:**
- Pastas em `app/` com a rota dessa feature (ex.: `app/entregas/`, `app/ranking/`, etc.)
- Componentes em `components/` cujo nome ou caminho indica uso exclusivo (ex.: `components/entregas/MapaRotas.tsx`)
- Hooks específicos (ex.: `hooks/useEntregas.ts`)
- Stores Zustand específicas (ex.: `stores/entregasStore.ts`)
- Schemas Zod específicos da feature
- Types específicos da feature em arquivos locais

**B) Imports cruzados (CRÍTICO):**
- Para cada arquivo de uma feature ativa, listar todos os imports que apontam para arquivos de features parqueadas. Use `rg` com padrões tipo:
  ```
  rg "from ['\"].*?(entregas|ranking|relacionamento|fluxo-caixa|contas-receber|contas-pagar|relatorio-fabrica|plano-contas)" apps/interno/app apps/interno/components
  ```
- Para cada import encontrado, anotar: arquivo de origem (ativo), arquivo importado (parqueado), o que está sendo importado (componente, função, type), e como esse import é usado (ex.: "widget no Dashboard que mostra ranking dos top clientes").

**C) Links e navegação cross-feature:**
- Procurar por `<Link href="/entregas` (e variações para todas as 8 features) em arquivos de features ativas.
- Procurar por chamadas a `router.push()` ou `redirect()` para rotas das features parqueadas.

**D) Widgets do Dashboard (Início):**
- Listar todos os widgets/cards do Dashboard. Para cada um, identificar a fonte de dado: tabela/RPC consultada. Marcar quais dependem de features parqueadas.

**E) Tipos compartilhados em `@mont/shared/database.ts`:**
- Identificar os tipos das tabelas que pertencem às features parqueadas. Esses tipos podem permanecer no shared (não custa nada). Apenas listar para visibilidade.

### 6.2 Banco de dados — Supabase

**A) Inventário de tabelas:**
- Listar todas as tabelas do schema `public`. Para cada uma, classificar:
  - **Exclusiva de feature parqueada:** ex. `ranking_pontos`, `relacionamentos`, `plano_contas`
  - **Exclusiva de feature ativa:** ex. `produtos`, `clientes`, `vendas`
  - **Compartilhada:** ex. provavelmente `pagamentos` (lida por Vendas, escrita por Contas a Receber)
  - **Indeterminada:** sinalize claramente; não chute.

**B) Inventário de RPCs/funções:**
- Listar todas as funções do schema `public` (extraindo de `supabase/migrations/*.sql` ou via `pg_proc`).
- Para cada uma, descrever: o que faz, quais tabelas lê, quais tabelas escreve.
- **Atenção especial à `criar_pedido`:** descrever passo a passo o que ela faz, enumerando cada `INSERT`/`UPDATE`/`SELECT` e em qual tabela.
- Marcar `fn_count_words` e `fn_capitalize_name` como utilitárias (não tocar).

**C) Inventário de triggers:**
- Listar todos os triggers do schema `public`.
- Para cada um: tabela alvo, evento (BEFORE/AFTER INSERT/UPDATE/DELETE), função executada, tabelas que a função toca.
- **Procurar especificamente** por triggers em `vendas` que escrevem em `entregas` ou em `pagamentos` ou em `contas_a_receber`.

**D) Inventário de views:**
- Listar todas as views. Para cada uma: definição, tabelas das quais depende.

**E) Foreign keys cruzadas:**
- Listar todas as FKs onde uma tabela ativa referencia uma tabela parqueada (ou vice-versa). Essas são **bombas relógio** — drop de tabela parqueada com FK ativa apontando pra ela falha.

### 6.3 Pontos críticos para investigação aprofundada

Os quatro pontos abaixo precisam de tratamento dedicado no relatório, com seções próprias:

**Ponto 1 — RPC `criar_pedido`:**
Documentar fluxo completo. Se ela escreve em tabela parqueada (ex. cria entrega ou conta a receber automaticamente), isso é um ponto de desacoplamento obrigatório na Fase 2. Sinalize com `⚠️`.

**Ponto 2 — Sidesheet de Quitar pagamento:**
Localizar o componente (provavelmente em `components/vendas/` ou `components/clientes/`). Identificar:
- Em qual(is) tabela(s) o submit escreve.
- Se a tabela é compartilhada, exclusiva, ou indeterminada.
- Se há alguma dependência de tabelas das features de Contas a Receber/Contas a Pagar/Fluxo de Caixa.

**Ponto 3 — Trigger de criação automática de Entrega:**
Verificar se ao criar uma venda, um registro é automaticamente criado em `entregas`. Se sim, esse trigger é "cola" do fluxo. Quando a feature de Entregas for parqueada, esse trigger pode (a) ser desabilitado, (b) ser refatorado, (c) ser mantido escrevendo em uma tabela dormente. Apenas mapeie agora; a decisão é da Fase 2.

**Ponto 4 — Filtro de fiados em Vendas:**
Localizar a query/RPC que alimenta o filtro de fiados na página de Vendas. Documentar exatamente qual(is) tabela(s) ela consulta. Esse é o caminho que substituirá Contas a Receber, então precisamos confirmar que ele não depende de tabelas que serão arquivadas.

---

## 7. Formato de saída

**Arquivo único:** `docs/brownfield/parking-feature-map-2026-05-09.md`

**Estrutura obrigatória:**

```markdown
# Mapa de Acoplamento — Parking de Features
Data: 2026-05-09
Versão do schema: [hash do último migration aplicado]

## 1. Sumário Executivo
- Total de arquivos exclusivos identificados por feature
- Total de imports cruzados encontrados
- Total de tabelas parqueáveis vs compartilhadas
- Riscos críticos identificados (lista curta, em destaque)

## 2. Frontend — Inventário por Feature
### 2.1 Entregas
- Arquivos exclusivos: [lista com paths]
- Imports cross-feature de fora pra dentro: [tabela]
- Imports cross-feature de dentro pra fora: [tabela]
- Recomendação preliminar: [parking total / parking parcial / manter]
### 2.2 Ranking
[mesmo formato]
[... 8 seções, uma por feature ...]

## 3. Frontend — Dashboard (Início)
- Inventário de widgets
- Quais dependem de features parqueadas
- Recomendação de desacoplamento

## 4. Banco — Inventário de Tabelas
| Tabela | Classificação | Lida por (ativas) | Escrita por (ativas) | Lida por (parqueadas) | Escrita por (parqueadas) | FKs apontando para ela |
|--------|---------------|-------------------|----------------------|-----------------------|--------------------------|------------------------|

## 5. Banco — RPCs e Funções
[Tabela com nome, descrição, lê, escreve, classificação]

### 5.1 Análise detalhada: `criar_pedido`
[Passo a passo do que a RPC faz, com snippets do SQL]

## 6. Banco — Triggers
[Tabela com tabela alvo, evento, função, classificação]

## 7. Banco — Views
[Tabela]

## 8. Banco — Foreign Keys Cruzadas (Bombas Relógio)
[Lista de FKs entre tabelas parqueadas e ativas]

## 9. Pontos Críticos
### 9.1 RPC `criar_pedido` — escreve em tabela parqueada?
### 9.2 Sidesheet de Quitar — onde escreve?
### 9.3 Trigger de criação automática de Entrega
### 9.4 Filtro de fiados em Vendas — query e dependências

## 10. Recomendação Preliminar (não vinculante — só para discussão na Fase 2)
| Feature | Parking total OK? | Bloqueios | Ação prévia necessária |
|---------|-------------------|-----------|------------------------|

## 11. Anexo: comandos executados
[Lista dos comandos `rg`, queries SQL, etc., para reprodutibilidade]
```

---

## 8. Critérios de aceite

A entrega só é considerada completa se **todos** os itens abaixo forem verdadeiros:

- [ ] Arquivo `docs/brownfield/parking-feature-map-2026-05-09.md` existe e segue exatamente a estrutura da seção 7.
- [ ] Todas as 8 features parqueadas têm sua subseção em "Frontend — Inventário por Feature".
- [ ] A tabela de inventário de tabelas (seção 4) cobre 100% das tabelas do schema `public`.
- [ ] Os 4 pontos críticos da seção 6.3 têm análise dedicada e conclusiva (não "a investigar").
- [ ] Snippet de SQL real está incluído na análise da `criar_pedido`.
- [ ] Lista de FKs cruzadas (seção 8) está exaustiva ou explicitamente marcada como "nenhuma encontrada".
- [ ] `git diff` final mostra **apenas** o arquivo de relatório criado. Nenhum outro arquivo foi modificado.
- [ ] Anexo (seção 11) lista os comandos executados para que Luccas possa reproduzir.

---

## 9. Como Luccas vai validar

Ao final da execução, Luccas vai:

1. Rodar `git status` e `git diff --stat` para confirmar que apenas o arquivo de relatório foi criado.
2. Abrir o relatório e ler a seção 1 (Sumário Executivo) e seção 9 (Pontos Críticos) primeiro.
3. Spot-check: pegar 2 ou 3 imports cruzados afirmados no relatório e verificar manualmente com `rg` se realmente existem.
4. Spot-check: pegar 1 RPC ou trigger afirmado no relatório e verificar manualmente em `supabase/migrations/` ou via Supabase Studio.
5. Validar que a análise da `criar_pedido` faz sentido com o que ele lembra do código.

---

## 10. Próximos passos (NÃO executar agora)

Após validação do relatório por Luccas, virão (uma de cada vez, com novo briefing dedicado):

- **Fase 2:** Desacoplamento — remover imports cruzados, simplificar fluxos, garantir que build passa antes do parking.
- **Fase 3:** Parking de código — mover features para `apps/interno/_parked/`, atualizar `tsconfig.exclude`, ignores de agentes.
- **Fase 4:** Cadeado UX na sidebar — itens visíveis, disabled, com ícone de cadeado, sem navegação.
- **Fase 5:** Validação — build, type-check, smoke test manual.
- **Fase 6 (futura):** Arquivamento de tabelas no banco com prefix `_archived_` (apenas após mapa validado e com calma).

Nada disso é desta tarefa. Esta tarefa termina com o relatório criado e validado.

---

## 11. Stack de referência

- **Monorepo:** pnpm workspaces + Turborepo
- **Apps:** `apps/interno` (foco desta tarefa) e `apps/catalogo` (não tocar)
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind, Zustand 5, Zod 4
- **Backend:** Supabase (Postgres + RPCs + triggers)
- **Types compartilhados:** `packages/shared` ou `@mont/shared/database.ts`
- **Migrations:** `supabase/migrations/`
- **Padrão monetário:** 100% reais (numeric), nunca centavos
- **Padrão de data:** `date-fns` com `startOfDay` + `differenceInCalendarDays` (timezone São Paulo)

---

**Fim do briefing.**
