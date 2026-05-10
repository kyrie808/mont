# Auditoria do Estado da Branch — Pré-Merge

Data: 2026-05-09
Branch: fix/audit-onda1-seguranca-db

## 1. Proteção do .env.local.prod-backup

- Adicionado ao .gitignore: SIM
- Sumiu do `git status`: SIM
- Linhas adicionadas ao .gitignore:
  ```
  # Backups locais de .env (NUNCA commitar — contém credenciais)
  .env.local.prod-backup
  .env.local*
  apps/*/.env.local*
  apps/*/.env.local.prod-backup
  ```

## 2. Inventário de arquivos untracked

| Arquivo | Categoria | Justificativa |
|---------|-----------|---------------|
| `apps/interno/.env.local.prod-backup` | NÃO COMMITAR | Backup de credenciais de produção (timestamp 2026-04-04); agora ignorado pelo .gitignore adicionado na Tarefa 1 |
| `apps/interno/onda1-progress.md` | AUDITORIA | Nome explicita "onda1"; timestamp 04:11 do dia 09/05 — antes da execução do parking (início ~21h) |
| `briefing-parking-fase1-mapeamento.md` | PARKING | Briefing da Fase 1 colado pelo usuário antes da execução; timestamp 18:53 |
| `docs/brownfield/parking-feature-map-2026-05-09.md` | PARKING | Criado pelo agente durante a execução da Fase 1; timestamp 21:56 |
| `prompt-claude-code-stop-audit.md` | PARKING | Instrução de auditoria pré-merge criada pelo usuário (timestamp 22:19); faz parte da documentação do processo de parking |
| `supabase/migrations/20260509120000_drop_backfill_contatos_artifacts.sql` | AUDITORIA | Nome: drop de artifacts de backfill em contatos.nome — segurança Onda 1; timestamp 03:53 |
| `supabase/migrations/20260509120100_restrict_products_bucket_policies.sql` | AUDITORIA | Nome: restrição de policies no bucket de products — segurança Onda 1; timestamp 03:56 |
| `supabase/migrations/20260509120200_restrict_rpc_execute_grants.sql` | AUDITORIA | Nome: restrição de execute grants em RPCs — segurança Onda 1; timestamp 04:09 |

**Totais por categoria:** AUDITORIA: 4 | PARKING: 3 | NÃO COMMITAR: 1 | DESCONHECIDO: 0

## 3. Relatório do parking — validação de existência

- Caminho esperado: `docs/brownfield/parking-feature-map-2026-05-09.md`
- Existe nesse caminho: SIM
- Total de linhas: 674
- Headings identificados (output de `grep "^##" arquivo`):
  ```
  ## 1. Sumário Executivo
  ### Riscos críticos
  ## 2. Frontend — Inventário por Feature
  ### 2.1 Entregas / Rotas Inteligentes
  ### 2.2 Ranking
  ### 2.3 Relacionamento
  ### 2.4 Fluxo de Caixa
  ### 2.5 Contas a Receber
  ### 2.6 Contas a Pagar
  ### 2.7 Relatório Fábrica
  ### 2.8 Plano de Contas
  ## 3. Frontend — Dashboard (Início)
  ### Widgets e dependências
  ### Recomendação de desacoplamento para o Dashboard
  ## 4. Banco — Inventário de Tabelas
  ## 5. Banco — RPCs e Funções
  ### 5.1 Análise detalhada: `criar_pedido`
  ## 6. Banco — Triggers
  ## 7. Banco — Views
  ## 8. Banco — Foreign Keys Cruzadas (Bombas Relógio)
  ## 9. Pontos Críticos
  ### 9.1 RPC `criar_pedido` — escreve em tabela parqueada?
  ### 9.2 Sidesheet de Quitar — onde escreve?
  ### 9.3 Trigger de criação automática de Entrega
  ### 9.4 Filtro de fiados em Vendas — query e dependências
  ## 10. Recomendação Preliminar (não vinculante — para discussão na Fase 2)
  ## 11. Anexo: Comandos executados
  ### Reads de arquivos
  ### Buscas com Grep/Glob
  ```
- Primeiras 60 linhas do arquivo:
  ```
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
  ```

## 4. Localização do briefing original

- Localização atual: `/briefing-parking-fase1-mapeamento.md` (raiz do repositório)
- Recomendação: mover para `/docs/brownfield/briefing-parking-fase1-mapeamento.md`
- Mover agora? Não — aguardar autorização do usuário.

## 5. Plano de commits sugerido (NÃO EXECUTAR — apenas para revisão)

### Commit A — Workstream AUDITORIA
Arquivos:
- `apps/interno/onda1-progress.md`
- `supabase/migrations/20260509120000_drop_backfill_contatos_artifacts.sql`
- `supabase/migrations/20260509120100_restrict_products_bucket_policies.sql`
- `supabase/migrations/20260509120200_restrict_rpc_execute_grants.sql`

Mensagem sugerida:
```
chore(security): onda 1 de auditoria — drop backfill, restrict bucket policies, restrict RPC execute grants

- Drop dos artifacts de backfill em contatos.nome
- Restrição de policies no bucket de products
- Restrição de execute grants nas RPCs
- Progresso documentado em apps/interno/onda1-progress.md
```

### Commit B — Workstream PARKING (Fase 1)
Arquivos:
- `docs/brownfield/parking-feature-map-2026-05-09.md`
- `docs/brownfield/branch-state-audit-2026-05-09.md`
- `briefing-parking-fase1-mapeamento.md` (ou `docs/brownfield/briefing-parking-fase1-mapeamento.md` após `git mv` autorizado)
- `prompt-claude-code-stop-audit.md`

Mensagem sugerida:
```
docs(brownfield): mapa de acoplamento Fase 1 do parking de features

- Briefing original da Fase 1
- Mapa completo de dependências entre features ativas e parqueáveis
- Auditoria do estado da branch pré-merge
```

### Commit C — Chore (gitignore)
Arquivos:
- `.gitignore`

Mensagem sugerida:
```
chore(git): ignorar backups locais de .env

Adiciona padrões para .env.local* e .env.local.prod-backup,
evitando vazamento de credenciais de produção em commits futuros.
```

## 6. Próximas decisões para o usuário

1. Confirmar que os arquivos classificados como AUDITORIA realmente pertencem ao workstream da onda 1 de segurança (não foram criados pelo agente do parking).
2. Autorizar o `git mv` do briefing para `docs/brownfield/`.
3. Decidir se prefere fazer os commits manualmente ou autorizar o agente a executar.
4. Fazer spot-check manual do relatório do parking (seção 9 do briefing original): pegar 2-3 imports cruzados afirmados e validar com `rg`, pegar 1 RPC afirmada e validar em `supabase/migrations/`.
