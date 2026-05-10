# Prompt: Spot-check + Reorganização + Commits Separados por Workstream

## Contexto

Acabamos de auditar o estado da branch `fix/audit-onda1-seguranca-db` e confirmamos:
- `.env.local.prod-backup` está protegido pelo `.gitignore`.
- Inventário de untracked está classificado: 4 arquivos AUDITORIA, 3 arquivos PARKING (briefing + relatório + prompt operacional), 1 NÃO COMMITAR (já protegido).
- Relatório do parking existe em `docs/brownfield/parking-feature-map-2026-05-09.md` (674 linhas, 11 seções).
- Relatório de auditoria de estado existe em `docs/brownfield/branch-state-audit-2026-05-09.md`.
- `git diff --stat` atual mostra apenas `.gitignore` modificado.

Esta execução vai (1) validar o relatório do parking via spot-check factual, (2) reorganizar dois arquivos, (3) executar 3 commits separados por workstream.

## Premissas (cancele esta execução se alguma estiver errada)

1. **A auditoria de segurança Onda 1 está completa.** As 3 migrations + `onda1-progress.md` são o trabalho final da onda, prontos para commit. Não há mais trabalho pendente da auditoria nesta branch.
2. **Não fazer merge para main.** Apenas commits na branch atual. O merge será decidido manualmente pelo usuário depois.
3. **Não fazer push.** Apenas commits locais.

Se qualquer uma dessas premissas estiver errada, **PARE imediatamente** e reporte ao usuário antes de qualquer ação.

## Restrições absolutas

🚫 **NÃO** faça merge, push, pull request, ou rebase.
🚫 **NÃO** modifique nenhum arquivo de código fonte (`.ts`, `.tsx`, `.sql`, etc.) — apenas movimentações de arquivo (`git mv`) e edição do `.gitignore` (já feita) são permitidas.
🚫 **NÃO** modifique o conteúdo do relatório do parking nem do relatório de auditoria.
🚫 **NÃO** crie migrations novas nem altere as existentes.
🚫 **NÃO** instale dependências.
🚫 **NÃO** prossiga para a Fase B se o spot-check (Fase A) falhar — pare e reporte.

✅ **PERMITIDO:** comandos read-only de inspeção (`rg`, `cat`, `head`, `grep`, `git log`, `git status`, `git diff`), `git mv` (Fases B e C), `git add`, `git commit` (Fase D), criação de pasta nova `docs/operations/prompts/` se ainda não existir.

---

## FASE A — Spot-check factual do relatório do parking

Objetivo: validar que o relatório `docs/brownfield/parking-feature-map-2026-05-09.md` não contém alucinações nas afirmações verificáveis. Spot-check é **factual**, não interpretativo: você só verifica se o que o relatório afirma existe **existe mesmo**.

### Spot-check 1 — Imports cruzados

Abra o relatório, vá na **Seção 2 (Frontend — Inventário por Feature)**. Para cada uma das 8 features parqueadas (Entregas, Ranking, Relacionamento, Fluxo de Caixa, Contas a Receber, Contas a Pagar, Relatório Fábrica, Plano de Contas), procure a subseção "Imports cross-feature de fora pra dentro" (ou nome equivalente).

Pegue **3 imports cruzados quaisquer afirmados no relatório** (de features diferentes idealmente, ex: 1 de Entregas, 1 de Ranking, 1 de Fluxo de Caixa). Para cada um:

1. Anote: arquivo de origem (afirmado), arquivo importado (afirmado), o que está sendo importado (afirmado).
2. Execute `rg` para confirmar a existência do import:
   ```bash
   rg "from.*<nome-do-modulo-importado>" <arquivo-de-origem-afirmado>
   ```
3. Classifique cada um:
   - ✅ **CONFIRMADO** — o import existe exatamente como o relatório afirma.
   - ⚠️ **PARCIAL** — o import existe mas com detalhes diferentes (caminho diferente, nome diferente).
   - ❌ **INEXISTENTE** — o `rg` não retornou resultado, o import não existe.

### Spot-check 2 — RPC `criar_pedido`

Abra a **Seção 5.1** do relatório (análise detalhada da `criar_pedido`). Anote:
- Quais tabelas o relatório afirma que a RPC LÊ.
- Quais tabelas o relatório afirma que a RPC ESCREVE (INSERT/UPDATE).

Localize o SQL real da RPC procurando em `supabase/migrations/`:
```bash
rg -l "CREATE OR REPLACE FUNCTION.*criar_pedido|CREATE FUNCTION.*criar_pedido" supabase/migrations/
```

Abra o arquivo encontrado, leia o corpo da função, e compare com o que o relatório afirmou. Classifique:
- ✅ **CONFIRMADO** — o relatório descreve fielmente o que a RPC faz.
- ⚠️ **PARCIAL** — descrição correta mas omite ou adiciona detalhes (especificar quais).
- ❌ **DIVERGENTE** — o relatório afirma comportamento que a RPC não tem, ou omite comportamento crítico.

### Spot-check 3 — Trigger de criação automática de Entrega

Abra a **Seção 9.3** do relatório. Anote o que o relatório afirma sobre triggers que criam entregas automaticamente quando uma venda é inserida.

Verifique no banco/migrations:
```bash
rg "CREATE TRIGGER|trigger.*entregas" supabase/migrations/
```

Compare a afirmação do relatório com o que existe de fato. Classifique igual aos anteriores: CONFIRMADO / PARCIAL / DIVERGENTE / INEXISTENTE.

### Critério de prosseguimento da Fase A

- **3/3 ou 2/3 CONFIRMADO** (e nenhum DIVERGENTE/INEXISTENTE crítico) → relatório considerado confiável, **prossiga para Fase B**.
- **Algum DIVERGENTE ou INEXISTENTE** → relatório tem alucinação. **PARE.** Não prossiga para Fase B. Reporte ao usuário com detalhes.
- **PARCIAL em todos** → tolerável, prossiga mas mencione no relatório final.

---

## FASE B — Reorganização de arquivos

**Só execute se Fase A passou.**

### B.1 — Mover briefing original para `docs/brownfield/`

```bash
git mv briefing-parking-fase1-mapeamento.md docs/brownfield/briefing-parking-fase1-mapeamento.md
```

### B.2 — Mover prompt operacional para `docs/operations/prompts/`

Crie a pasta se não existir:
```bash
mkdir -p docs/operations/prompts
```

Mova o arquivo:
```bash
git mv prompt-claude-code-stop-audit.md docs/operations/prompts/prompt-claude-code-stop-audit-2026-05-09.md
```

(Note o sufixo de data adicionado — convenção para arquivar prompts operacionais por data de uso.)

Verifique com `git status` que ambos os movimentos foram registrados como `renamed:` (não como `deleted:` + `new file:` separados, o que indicaria que o git não detectou o rename).

---

## FASE C — Confirmação pré-commit

Antes dos commits, rode:
```bash
git status
git diff --stat
```

Verifique:
- `.gitignore` aparece como `modified`.
- Os 3 arquivos do PARKING aparecem ou como `renamed` (briefing e prompt operacional) ou `untracked` (`branch-state-audit-2026-05-09.md` e `parking-feature-map-2026-05-09.md`).
- Os 4 arquivos da AUDITORIA aparecem como `untracked` (3 migrations + `onda1-progress.md`).
- `apps/interno/.env.local.prod-backup` NÃO aparece (está ignorado).

Se algo divergir, **PARE** e reporte antes dos commits.

---

## FASE D — Executar os 3 commits separados

Execute na ordem exata abaixo. Use as mensagens exatamente como escritas (multi-line com `-m`).

### Commit A — Workstream AUDITORIA

```bash
git add apps/interno/onda1-progress.md
git add supabase/migrations/20260509120000_drop_backfill_contatos_artifacts.sql
git add supabase/migrations/20260509120100_restrict_products_bucket_policies.sql
git add supabase/migrations/20260509120200_restrict_rpc_execute_grants.sql

git commit -m "chore(security): onda 1 de auditoria — drop backfill, restrict bucket policies, restrict RPC grants" -m "
- Drop dos artifacts de backfill em contatos.nome
- Restrição de policies no bucket de products
- Restrição de execute grants nas RPCs
- Progresso documentado em apps/interno/onda1-progress.md
"
```

Capture o hash do commit (`git rev-parse HEAD`) para reportar depois.

### Commit B — Workstream PARKING (Fase 1)

```bash
git add docs/brownfield/parking-feature-map-2026-05-09.md
git add docs/brownfield/branch-state-audit-2026-05-09.md
git add docs/brownfield/briefing-parking-fase1-mapeamento.md
git add docs/operations/prompts/prompt-claude-code-stop-audit-2026-05-09.md

git commit -m "docs(brownfield): mapa de acoplamento Fase 1 do parking de features" -m "
- Briefing original da Fase 1 (docs/brownfield/)
- Mapa completo de dependências entre features ativas e parqueáveis (674 linhas, 11 seções)
- Auditoria do estado da branch pré-merge
- Registro do prompt operacional de stop-audit (docs/operations/prompts/)
"
```

Capture o hash.

### Commit C — Chore gitignore

```bash
git add .gitignore

git commit -m "chore(git): ignorar backups locais de .env" -m "
Adiciona padrões para .env.local* e .env.local.prod-backup,
evitando vazamento de credenciais de produção em commits futuros.
"
```

Capture o hash.

---

## FASE E — Validação final

Rode:
```bash
git status
git log --oneline -5
git diff --stat HEAD~3..HEAD
```

Espera-se:
- `git status` → working tree clean (nada untracked, nada modified).
- `git log` → mostra os 3 commits novos no topo (C, B, A — em ordem reversa de criação).
- `git diff --stat HEAD~3..HEAD` → mostra os arquivos esperados em cada commit.

---

## Critérios de aceite

- [ ] Fase A concluída com resultado documentado (3/3 spot-checks classificados).
- [ ] Se Fase A falhou: paradinha em A, sem commits, sem movimentações.
- [ ] Se Fase A passou: Fases B/C/D/E completas.
- [ ] 3 commits criados na ordem A → B → C.
- [ ] Working tree clean ao final.
- [ ] Nenhum push, nenhum merge, nenhum pull request.
- [ ] Nenhum arquivo de código fonte modificado.

---

## Como reportar ao terminar

### Se Fase A falhou (parou ali):

Reporte:
1. Quais spot-checks falharam (1, 2, ou 3) e classificação de cada um.
2. Discrepância encontrada (ex: "relatório afirma import X em Y, mas `rg` não encontra").
3. Recomendação: refazer relatório? Editar manualmente? Ignorar?

### Se Fase A passou e tudo executou:

Reporte:
1. Resultado dos 3 spot-checks (CONFIRMADO/PARCIAL/etc).
2. Os 3 hashes de commit (A, B, C) com a primeira linha da mensagem.
3. Confirmação: working tree clean, branch ainda em `fix/audit-onda1-seguranca-db`, nenhum push feito.
4. Próximo passo sugerido para o usuário (sem executar): "Pronto para merge linear da branch para main quando autorizar" — mas **NÃO ofereça opções nem pergunte "o que quer fazer agora?"**. Apenas reporte e espere.
