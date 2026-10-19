# Diagnóstico — Agenda de Retornos (Onda 0)

19/10/2026 · branch `feat/agenda-retornos` (criada da `main` em `0c1e453`) · nenhum código alterado, nenhum SQL de escrita executado. Consultas ao banco foram só `SELECT` em catálogo e em contagens.

---

## 0. O que não bate com o planejamento (ler primeiro)

| # | Planejamento diz | Realidade (código/banco) | Impacto |
|---|---|---|---|
| D1 | Prompt 00: "sistema interno … Next.js" | `apps/interno` é **Vite + React 19, SPA com HashRouter** (`apps/interno/src/App.tsx`). Next.js é só o `apps/catalogo`. A rota fica `#/agenda`. | Nenhum na arquitetura; só o vocabulário dos prompts. |
| D2 | "ver docs/DESIGN_SYSTEM.md" e "docs/DATABASE_ARCHITECTURE.md" | Os dois são de **abr/2026 e estão desatualizados** (o de design ainda se chama "MassasCRM"; o de banco fala em "18 tabelas", com data de 15/03). A fonte oficial é **`apps/interno/DESIGN_SYSTEM.md`** + o cheat-sheet no topo de `apps/interno/src/index.css` (CLAUDE.md, Regra #4). Para o banco, a fonte é o catálogo do Postgres + `supabase/migrations/`. | Usei as fontes atuais. |
| D3 | "padrão Portal" | Não existe um componente `Portal` único. Há dois jeitos: o Radix `Dialog.Portal` dentro de `components/ui/Modal.tsx`, e `createPortal(…, document.body)` em `ui/Drawer.tsx`, `ui/Toast.tsx`, `layout/NavigationDrawer.tsx` e nos side sheets de `components/relacionamento/`. | Popover e folha inferior vão usar o portal do Radix. |
| D4 | Popover de detalhe (estilo Google) | **Não existe primitivo de Popover oficial.** Há `components/_incoming/popover.tsx` (shadcn, sobre `radix-ui`), **sem uso nenhum**, com dois anti-padrões do DESIGN_SYSTEM: borda sem cor (`border`, §7.3) e `z-50` em vez de `z-modal`/`z-overlay`. | A Onda 3 precisa de um `ui/Popover.tsx` tokenizado. É primitivo visual novo, então **precisa da sua autorização** (Regra #4). |
| D5 | Auditoria: "criado em, criado por, alterado por" | Colunas reais: **`criado_em`, `atualizado_em`, `created_by`, `updated_by`**, carimbadas pelo trigger `handle_audit_fields()`. Esse trigger **sobrescreve** `created_by = auth.uid()` no INSERT. | Lembrete gravado pelo Claude via MCP roda como `postgres`, então fica `created_by = NULL`. Quem identifica o Claude é a coluna `origem = 'claude'`, não o `created_by`. |
| D6 | "54 vendas que vencem em 13/11" | Hoje o banco tem **33 vendas** com `data_prevista_pagamento = 2026-11-13`: **31 em aberto, somando R$ 1.875,00** (todas fiado entregue), e 2 já pagas. | O critério de aceite "13/11 igual ao banco" passa a valer contra **31 / R$ 1.875,00** (ou o que houver no dia). Vale conferir de onde saiu o 54. |
| D7 | Vencimento = "venda não paga e não cancelada" | Por essa regra, **brinde entra** (brinde é `pago=false`, `status='entregue'`). Há 2 brindes com previsão de pagamento já passada. | A função tem que excluir `forma_pagamento = 'brinde'` de propósito (CLAUDE.md, "Brindes"). |
| D8 | Contador "X **fiados** sem data" | Fiado em aberto sem previsão: **9**. Mas existem **29 vendas não-brinde em aberto sem previsão (R$ 2.324,90)**: fiado 9, `venda` 14, pix 5, cartão 1. | **Decisão:** o contador conta só fiado ou todo o "em aberto sem data"? |
| D9 | Faixa de Atrasados = "lembretes pendentes com data passada" | Hoje há **27 vendas** (fiado/pré-venda) com **vencimento já passado**. Pela definição do README, nenhuma delas entra na faixa. | **Decisão:** a faixa mostra também os vencimentos atrasados? Sem isso, o grosso da cobrança atrasada fica fora do topo. |
| D10 | Lembrete tipo "retorno comercial" ("me chama semana que vem") | **Já existe**: `interacoes.retomar_em` (migration `20261015145750_analista_adiou_retomar_em.sql`). O analista (IA) grava quando o cliente adia, e o card vai para `follow_up` em `view_relacionamento_kanban` nesse dia. | Risco de **dado duplicado**, o mesmo que o README quer evitar. **Decisão:** virar uma 5ª camada só-leitura "Retomadas" (lida de `interacoes`) ou manter o lembrete manual como coisa separada. |
| D11 | Responsável "Luccas, Gilmar, equipe"; "concluído por" | `admin_users` tem só **`adm@distribuidora.com.br`** e a conta-teste. Se você e o Gilmar entram com o mesmo login, `auth.uid()` não diferencia os dois. | `responsavel` vira texto com CHECK (`luccas`, `gilmar`, `equipe`), não FK. `concluido_por` (uuid) só diz "foi o sistema", não quem. **Preciso confirmar:** vocês dividem o login? |
| D12 | Prompt 01: teste "dentro de BEGIN … ROLLBACK" | O padrão do projeto (skill `tdd-mont-pragmatico`, decisão de 13/10) é **DO-block que sempre termina em `RAISE EXCEPTION 'SUITE_OK…'`**, em `supabase/tests/<assunto>.sql`. Ele roda como a conta-teste via `request.jwt.claims` e mostra as contagens antes e depois. Referência: `supabase/tests/metas_mensais.sql`. | Proponho seguir o padrão do projeto. Ele também roda no SQL Editor, e nada persiste. |
| D13 | Prompt 02: "chave da Evolution lida de variável de ambiente" | No W5, a chave fica numa **credencial do n8n** ("Evolution API (apikey)", `httpHeaderAuth`), e a Edge Function exige o header `x-ingestor-secret` (credencial "Ingestor Mont"). Os destinos são **constantes validadas dentro da Edge Function**, nunca campo livre. | Mesmo nível de segurança. Proponho repetir o molde do W5. |
| D14 | "Só uma tabela nova" | "Nunca envia duas vezes no mesmo dia" precisa de uma marca gravada (o W5 usa `vendas.aviso_grupo_enviado_em`). | Proponho uma 2ª tabela pequena, `agenda_avisos_enviados` (`dia` PK), na Onda 2. **Decisão sua.** |
| D15 | Prompt 03: "outra aba … ao voltar" reflete a baixa | O React Query global está com **`refetchOnWindowFocus: false`** (`apps/interno/src/lib/react-query.ts`). | A query da agenda liga `refetchOnWindowFocus: true` só para ela. O global continua como está. |

---

## 1. Estrutura do repositório, rotas e menu

- Monorepo pnpm + Turborepo: `apps/catalogo` (Next 15), `apps/interno` (Vite SPA), `packages/shared` (`@mont/shared`, consumido como fonte TS), `packages/config`.
- **Rotas:** `apps/interno/src/App.tsx`. Páginas em `React.lazy()`, todas dentro de `<AuthGuard><AppLayout/></AuthGuard>`. As páginas ficam em `apps/interno/src/pages/*.tsx`.
- **Menu:** uma fonte única, `apps/interno/src/components/layout/navConfig.ts` (`NAV_GROUPS`), lida pela `SidebarNav.tsx` (desktop ≥ lg) e pelo `NavigationDrawer.tsx` (mobile). A `BottomNav.tsx` tem itens próprios. Um item novo em `NAV_GROUPS` aparece nos dois menus.
- Layout: `components/layout/AppLayout.tsx` usa **scroll de documento** (footgun conhecido: `overflow-x-hidden` quebra `sticky`, então barras fixas usam `fixed`).
- Desktop × mobile: `useIsDesktop()` (`hooks/useIsDesktop.ts`, 1024px) e o padrão `lg:hidden` / `hidden lg:block`. **Mobile é sagrado**: o Gilmar usa no celular, e o layout atual dele não pode mudar.

## 2. Design system

- Tokens: CSS vars HSL em `apps/interno/src/index.css` (`:root` = tema claro "Stitch", `.dark` = "Tactical"), mapeadas em `apps/interno/tailwind.config.js`. **Tailwind v4** com `@config` como ponte. Tema por classe no `<html>`, controlado por `contexts/ThemeContext.tsx`.
- Tokens úteis pra Agenda: `primary`/`success` (verde), `warning-strong` (pendente/fiado), `destructive` (atraso/saldo devedor), `muted-foreground`, `card`, `popover`, `border`, z-index nomeados (`z-overlay`, `z-modal`, `z-toast`), sombras `shadow-card`/`shadow-elevated`.
- Cores das camadas: os chips por camada são **código categórico** e entram na exceção do DESIGN_SYSTEM §8, como os dots da timeline. Mesmo assim, proponho mapear para tokens (Lembretes = `primary`, Vencimentos = `warning-strong`, Atraso = `destructive`, Entregas e Contas a pagar = neutros, com tint `foreground/[0.06]` + ícone). Assim os chips funcionam nos dois temas. Paleta final é decisão visual sua.
- Primitivos (`apps/interno/src/components/ui/`, barrel em `index.ts`): `Button`, `Input`, `Select`, `Card`, `Modal` (Radix Dialog), `ConfirmDialog`, `Drawer` (painel lateral, portal), `Tabs`, `Badge`, `Skeleton`, `EmptyState`, `Toast`, `Spinner`. Desktop v2: `components/reui/data-grid`, com peças `_incoming/*` (shadcn).
- Modal = Radix Dialog com scrim `bg-black/50`, `z-9998/9999`. **Não existe folha inferior (bottom sheet)**: o `Drawer` no mobile é um painel lateral.

## 3. Busca e gravação de dados, erros e toasts

- Cliente: `apps/interno/src/lib/supabase.ts` (`createClient<Database>` com `fetchComTimeout`, que aborta em 15s).
- Camadas: **service** (`src/services/*Service.ts`: objeto com métodos async, `if (error) throw error`, RPC via `supabase.rpc('nome', { p_… })`) → **hook** (`src/hooks/use*.ts`: `useQuery` + `useMutation`, `invalidateQueries` no `onSuccess`, e devolve `mutateAsync`). Modelo: `hooks/useContasAPagar.ts` + `services/contasAPagarService.ts`.
- Cache: `lib/react-query.ts`, com `staleTime` de 5 min, `retry: 1` e `refetchOnWindowFocus: false` (ver D15).
- Erros: a página faz `try/await mutateAsync/catch` e chama `toast.error(err instanceof Error ? err.message : '…')`. Toast é Zustand + portal (`components/ui/Toast.tsx`, `useToast()`). Erro também dura 4s.
- Validação: Zod 4 em `src/schemas/` (`venda.ts`, `contato.ts`). Formulários usam react-hook-form + zodResolver.

## 4. Datas e calendário

- **date-fns 4** (+ `ptBR`), usado em 21 arquivos. Não há lib de calendário nem date picker: os formulários usam `<input type="date">` nativo (15 ocorrências). `components/dashboard/MonthPicker.tsx` é só uma pílula de meses.
- **Fuso:** o banco está em **UTC** (`TimeZone = UTC`, `vendas.data DEFAULT CURRENT_DATE`). Padrão do diretor (17/10): tudo em America/Sao_Paulo. Use `hojeBrasilia()` de `@mont/shared` (`packages/shared/src/formatters.ts:87`), e no SQL `(now() AT TIME ZONE 'America/Sao_Paulo')::date`, nunca `CURRENT_DATE`.
- **Recomendação:** fazer a grade do mês **na mão**, com date-fns (já instalado) + Radix Popover (`radix-ui` já instalado). A grade é cálculo de 35/42 células, e o mini-calendário usa a mesma função. Uma lib de calendário (FullCalendar, react-big-calendar) traz CSS próprio que briga com os tokens e com o tema, e pesa no PWA. Para Semana/Dia (Onda 4), também na mão: são colunas com posição absoluta por hora.

## 5. Padrão das tabelas, RLS e migrações

- Auditoria: `criado_em timestamptz DEFAULT now()`, `atualizado_em`, `created_by uuid`, `updated_by uuid` + `CREATE TRIGGER tr_<tabela>_audit BEFORE INSERT OR UPDATE … EXECUTE FUNCTION handle_audit_fields()`.
- RLS (padrão mais recente, `20261016195141_metas_mensais.sql`): `ENABLE ROW LEVEL SECURITY` + 4 policies `TO authenticated` (`select`/`insert`/`update`/`delete`) com `(SELECT public.is_admin())`, + `REVOKE ALL … FROM anon`. Usuários autenticados que não são admin (entregador) ficam fora. `vendas`, `contas_a_pagar` e `pagamentos_venda` são admin-only.
- Migrações: `supabase/migrations/YYYYMMDDHHMMSS_nome_snake.sql`, comentadas em português, com o "porquê" no topo (158 arquivos). Testes de banco: `supabase/tests/<assunto>.sql`. Backup antes: `supabase/scripts/dump-prod.ps1`. Tipos: `packages/shared/src/database.ts` é gerado (nunca editar à mão), e os aliases manuais ficam em `packages/shared/src/types.ts`.
- Já existe nada parecido com `lembretes`, `agenda`, `tarefa` ou `follow` no schema (só o `interacoes.retomar_em`, ver D10).

## 6. Como `vendas.pago` / `valor_pago` mudam hoje, e onde entra "venda paga fecha lembretes"

- `pagamentos_venda` → trigger **`trigger_update_venda_pagamento`** (AFTER INSERT/UPDATE/DELETE) → `update_venda_pagamento_summary()`, que **recalcula pela soma real** e grava `vendas.valor_pago` e `vendas.pago = soma >= total`. A RPC `registrar_pagamento_venda` (admin-only) passa por `_pagamento_venda_core`.
- **Outros caminhos que mexem em `pago`:** `vendaService.updateVenda` (`data.pago`, direto), `vendaService.cancelVenda` (`status='cancelada', pago=false` **no mesmo UPDATE**), `fn_sync_cat_pedido_to_venda` (sync do catálogo), `criar_pedido`, `entregador_marcar_recebido_dinheiro`. E o estorno: `deleteUltimoPagamento` apaga o pagamento e o trigger volta `pago` para `false`.
- **Onde encaixar:** um trigger novo **`AFTER UPDATE OF pago, status ON vendas`**. Ele pega todos os caminhos acima sem tocar no trigger de `pagamentos_venda`. Ordem dentro da função: **primeiro o cancelamento** (`status` virou `cancelada` → lembretes viram `cancelado`/`venda_cancelada`), depois o pagamento (`pago` foi para `true` → `parcela`/`cobranca` pendentes viram `feito`/`venda_paga`). Ele só escreve em `lembretes`, então não há recursão. Não conflita com `tr_sync_venda_to_cat_pedido`, que também dispara em `pago`/`status`.
- **Simetria (decisão):** se o pagamento for estornado (`pago` true→false) ou a venda for "descancelada", proponho **reabrir só os lembretes que o próprio trigger fechou** (motivo `venda_paga`/`venda_cancelada`). É a mesma lição do estoque simétrico de 26/07. Os fechados à mão ficam como estão.
- **FK e exclusão de venda:** `vendaService.deleteVenda` apaga `vendas` direto, contando com o CASCADE de `itens_venda`/`pagamentos_venda`. Se `lembretes.venda_id` ficar `NO ACTION`, **excluir uma venda com lembrete passa a falhar.** Proposta: `ON DELETE SET NULL` em `venda_id` e `contato_id` (o lembrete fica, só perde o vínculo). Decisão sua.

## 7. Colunas reais

| Conceito | Coluna real | Observação |
|---|---|---|
| Previsão de pagamento | `vendas.data_prevista_pagamento` (`date`) | Índice parcial já existe: `idx_vendas_data_prevista_pagamento … WHERE pago = false`. ⚠️ A Nova Venda grava `addDays(new Date(),30).toISOString()` (`CheckoutSidebar.tsx:153`, `FinalizarVendaDrawer.tsx:209`): depois das 21h de Brasília a data sai **um dia adiantada**. Assunto da `fix/fuso-brasilia`. |
| Entrega prevista | `vendas.data_entrega_prevista` (`date`) | Hoje só **1** venda pendente tem a data preenchida. A camada vai ser pequena. |
| Status da venda | `vendas.status` ∈ `pendente`, `entregue`, `cancelada` (feminino; no `cat_pedidos` é `cancelado`) | Não existe `cancelado_em`. Cancelada = `status='cancelada'`. |
| Pago / em aberto | `vendas.pago` (bool), `vendas.valor_pago` (numeric, **nullable**), `vendas.total` | Em aberto = `total - COALESCE(valor_pago,0)`. Excluir `forma_pagamento='brinde'` (D7). |
| Fiado em aberto (regra "não oferecer venda") | Mesma definição de `view_relacionamento_kanban.tem_fiado_aberto`: `status='entregue' AND forma_pagamento='fiado' AND pago=false` | Reaproveitar, não reinventar. |
| Conta a pagar | `contas_a_pagar.data_vencimento` (`date`), `status` ∈ `pendente`, `pago`, `saldo_devedor` (coluna **gerada**), `valor_total`, `valor_pago`, `credor`, `descricao`, `parcela_atual`/`total_parcelas` | Cada parcela é **uma linha** própria. Hoje: 3 pendentes. Não há índice em `data_vencimento`, mas a tabela é pequena. |
| Telefone (abrir WhatsApp) | `contatos.telefone` (NOT NULL) + `getWhatsAppLink()` em `@mont/shared` | O prompt 01 pede "contato (id e nome)". Proponho incluir também o telefone na função de leitura. |

## 8. `avisos-entrega` e `avisoEntrega.ts`

- **Texto e regra** ficam em `packages/shared/src/avisoEntrega.ts`, só lógica pura (sem banco, sem rede): `montarAvisoEntrega(v)`, `avisosDevidos(vendas, agoraMs)`, `alertaEquipe(…)`. Exportados em `packages/shared/src/index.ts:139`. Testes em **`apps/interno/src/utils/__tests__/avisoEntrega.spec.ts`**, que é onde os testes do `shared` moram.
- **Edge Function** `supabase/functions/avisos-entrega/index.ts`: importa o shared por caminho relativo com `.ts` (exigência do Deno). Header `x-ingestor-secret` comparado com o secret `INGESTOR_SECRET`. Client `service_role`. Ações: `simular`, `devidos`, `marcar_enviado` (grava só se vazio, o que segura envio concorrente), `nao_entregues`. Destinos são **constantes** (`GRUPO_ENTREGAS`, `GRUPO_EQUIPE`). Flags por secret (`AVISOS_*`). `supabase/config.toml` tem `[functions.avisos-entrega] verify_jwt = false`. ⚠️ Sem essa entrada, o deploy liga o JWT e **mata o cron em silêncio** (footgun registrado).
- **n8n W5** (`infra/crm/workflows/w5-avisos-entrega.json`, timezone America/Sao_Paulo, `saveDataSuccessExecution: none`): Schedule (5 em 5 min / cron `0 21 * * *`) → HTTP para a Edge Function (credencial "Ingestor Mont") → Code que divide os itens → HTTP `http://evolution:8080/message/sendText/mont` (credencial "Evolution API (apikey)") → IF "saiu?" → `marcar_enviado` → em caso de falha, avisa a Equipe.
- ⚠️ Formato de dinheiro: o `reais()` local do `avisoEntrega.ts` **não põe separador de milhar** (`R$ 1875,00`) e fere a régua de 17/10. O `reais()` certo está em `packages/shared/src/whatsapp.ts:236`, mas é **privado**. O aviso da agenda soma valores acima de mil, então o helper novo usa a versão com milhar (cópia local, pelo mesmo motivo do Deno, ou export compartilhado; decido na Onda 2). Não mexo no `avisoEntrega.ts` sem você pedir.

## 9. Riscos e conflitos

1. **Branch `fix/fuso-brasilia` não mergeada.** A `feat/agenda-retornos` nasceu da `main`, sem os ajustes de fuso no front (`vendaService` filtro de mês, modais de data). Os arquivos quase não se cruzam com a Agenda, mas a ordem de merge importa. E o `ALTER DATABASE … timezone` ainda pendente não pode mudar o resultado da função da agenda: por isso ela vai **fixar o fuso explicitamente**, sem depender do fuso do banco.
2. **Duplicação com o Relacionamento** (D10): `interacoes.retomar_em` e o kanban `follow_up` já são uma "agenda comercial" alimentada pela IA.
3. **Divergência com o sino do Dashboard.** `hooks/useAlertasFinanceiros.ts` calcula "atrasado" com a data **do aparelho** (`startOfDay(new Date())`) e só considera `forma_pagamento='fiado'`. A Agenda vai contar todo não-brinde, no fuso de Brasília. O critério da Onda 4 ("Dashboard e Agenda com o mesmo número") obriga os dois a lerem **a mesma função do banco**.
4. **Quem envia o aviso das 8h.** A instância Evolution `mont` é o **WhatsApp Business do Gilmar** (dispositivo vinculado). "Mandar pro meu número" sai do número da Mont para o seu, e a saída volta pelo `SEND_MESSAGE` para o ingestor do CRM, onde pode aparecer na timeline de um contato seu. O grupo Equipe já recebe os alertas do W5 e evita isso. **Decisão** (está em aberto no README).
5. **Login compartilhado** (D11): "concluído por" e "responsável" não saem do `auth.uid()`.
6. **Exclusão de venda** quebraria com FK sem `SET NULL` (§6).
7. **Estorno e descancelamento** precisam reabrir o que o trigger fechou (§6).
8. **Teste com pagamento real dentro do DO-block.** O `registrar_pagamento_venda` dispara `_pagamento_venda_core` (lançamento) → trigger em `vendas` → `sync_venda_to_cat_pedido` e `fn_enfileirar_purchase_meta`. Antes de escrever a suíte, confiro se algum deles faz `net.http_post` ou `nextval` visível, que escapariam do rollback (regra da skill). A venda de teste é fiado sem `cat_pedido`, para não acionar o sync.
9. **Bundle do PWA.** Nada de lib de calendário nova (§4).
10. **Primitivo visual novo** (`ui/Popover.tsx`, folha inferior): precisa de autorização (Regra #4).

---

## 10. Plano proposto: ondas 1 a 4

Cada onda fecha com checkpoint (commit + `tsc` + build + relatório por ponto) antes da próxima.

### Onda 1 — Banco (SQL só em arquivo; você revisa e testa antes de aplicar)

Antes: `.\supabase\scripts\dump-prod.ps1`.

**Cria**
- `supabase/migrations/<ts>_agenda_lembretes.sql`
  - Tabela `public.lembretes`: `id uuid`, `titulo text NOT NULL`, `descricao`, `data date NOT NULL`, `hora time NULL` (sem hora = dia inteiro), `tipo` CHECK (`parcela`, `cobranca`, `pendencia_interna`, `retorno_comercial`, `outro`), `contato_id → contatos ON DELETE SET NULL`, `venda_id → vendas ON DELETE SET NULL`, `responsavel` CHECK (`luccas`, `gilmar`, `equipe`) NULL, `situacao` CHECK (`pendente`, `feito`, `cancelado`) DEFAULT `pendente`, `concluido_em`, `concluido_por uuid`, `motivo_conclusao` CHECK (`manual`, `venda_paga`, `venda_cancelada`), `vezes_reagendado int DEFAULT 0`, `origem` CHECK (`manual`, `automacao`, `claude`) DEFAULT `manual`, mais as 4 colunas de auditoria e o `tr_lembretes_audit`. CHECKs de coerência: `situacao='pendente'` ⇔ campos de conclusão nulos.
  - Trigger `trg_venda_fecha_lembretes` (`AFTER UPDATE OF pago, status ON vendas`) com `fn_venda_fecha_lembretes()`: fecha e reabre conforme o §6.
  - RPC `agenda_itens(p_inicio date, p_fim date)`, `SECURITY INVOKER` (RLS de admin vale): lista única de lembretes + vencimentos (sem brinde, valor em aberto) + entregas previstas pendentes + contas a pagar não pagas. Cada item traz `origem, id, data, hora, titulo, tipo, situacao, contato_id, contato_nome, contato_telefone, venda_id, valor`. (Mais a camada "Retomadas", se D10 for aprovada.)
  - RPC `agenda_atrasados()`: lembretes pendentes com `data < hoje em SP` (mais os vencimentos atrasados, se D9 for aprovada).
  - RPC `agenda_sem_data()` ou um campo de contagem: em aberto sem previsão (conforme D8).
  - Índices: `(data) WHERE situacao='pendente'`, `(venda_id) WHERE situacao='pendente'`, `(contato_id)`.
  - RLS: 4 policies admin + `REVOKE ALL FROM anon`. `GRANT EXECUTE` das RPCs só para `authenticated`.
- `supabase/tests/agenda_lembretes.sql`: DO-block com RAISE cobrindo os 6 critérios do prompt 01 + estorno + cancelamento + exclusão de venda.
- ~~`supabase/migrations/<ts>_agenda_lembretes_19out.sql`~~: **cancelado** (decisão 11 da §12). Os lembretes de 19/10 serão gravados depois pelo Claude, direto no banco, com `origem='claude'`.

**Altera (depois de aplicada)**
- `packages/shared/src/database.ts` (regenerado, sem edição à mão)
- `packages/shared/src/types.ts` (aliases `Lembrete`, `LembreteInsert`, `ItemAgenda`)

### Onda 2 — Aviso diário das 8h

**Cria**
- `packages/shared/src/avisoAgenda.ts`: `montarAvisoAgenda({ atrasados, hoje, amanha })` → `string | null` (null = dia vazio, não envia). Dinheiro com milhar, datas dd/mm.
- `apps/interno/src/utils/__tests__/avisoAgenda.spec.ts`
- `supabase/functions/avisos-agenda/index.ts`: função **nova**, para não misturar com entregas, no mesmo molde. Ações `simular` (texto, sem gravar), `do_dia` (texto + destino ou `enviar:false`), `marcar_enviado` (grava só se o dia ainda não existe). Lê `agenda_itens` e `agenda_atrasados`, as mesmas funções da tela. Destino como constante validada.
- `supabase/migrations/<ts>_agenda_avisos_enviados.sql`: `agenda_avisos_enviados (dia date PK, enviado_em, message_id, destino)`, RLS fechada (só `service_role`) (D14).
- `infra/crm/workflows/w6-aviso-agenda.json`: cron `0 8 * * 1-6`, timezone SP, credenciais existentes. O cron só liga depois da simulação aprovada.

**Altera**
- `packages/shared/src/index.ts` (export)
- `supabase/config.toml` (`[functions.avisos-agenda] verify_jwt = false`)
- `infra/crm/README.md` (seção do W6)

### Onda 3 — Tela do Mês (desktop)

**Cria**
- `apps/interno/src/pages/Agenda.tsx`
- `apps/interno/src/services/agendaService.ts` (RPCs da agenda + CRUD de `lembretes`)
- `apps/interno/src/hooks/useAgenda.ts` (`['agenda', inicio, fim]`, uma chamada por mês visível, `refetchOnWindowFocus: true`, mutations criar/reagendar/feito/excluir invalidando `['agenda']`)
- `apps/interno/src/schemas/lembrete.ts` (Zod)
- `apps/interno/src/utils/agenda.ts` + `utils/__tests__/agenda.spec.ts` (grade começando no domingo, agrupamento por dia, chip agregado "N vencimentos · R$ X", corte em 3 + "+N mais", camadas salvas no localStorage com try/catch)
- `apps/interno/src/components/features/agenda/`: `AgendaCabecalho.tsx`, `AgendaLateral.tsx`, `MiniCalendario.tsx`, `ListaCamadas.tsx`, `GradeMes.tsx`, `ChipItem.tsx`, `FaixaAtrasados.tsx`, `DetalheItem.tsx`, `CriacaoRapida.tsx`
- `apps/interno/src/components/ui/Popover.tsx`: **primitivo novo, com autorização sua** (D4), em Radix e tokenizado.

**Altera**
- `apps/interno/src/App.tsx` (rota lazy `/agenda`)
- `apps/interno/src/components/layout/navConfig.ts` (item "Agenda", ícone `CalendarDays`, grupo Operações. Posição a confirmar.)
- `apps/interno/src/components/ui/index.ts` (export do Popover)

### Onda 4 — Acabamento

**Cria**
- `components/features/agenda/GradeSemana.tsx`, `GradeDia.tsx` (dia inteiro no topo, itens com hora na régua)
- `components/features/agenda/AgendaMobile.tsx` (mês em pontinhos + lista do dia)
- `components/ui/FolhaInferior.tsx`: bottom sheet, primitivo novo, **com autorização** (ou reaproveito o `Drawer`, se você preferir não criar)
- `components/dashboard/RetornosHojeWidget.tsx`

**Altera**
- `pages/Agenda.tsx` (liga Semana/Dia e o ramo mobile via `useIsDesktop`)
- `pages/VendaDetalhe.tsx` e `pages/ContatoDetalhe.tsx` (botão "Agendar retorno" abrindo a `CriacaoRapida` já preenchida)
- `pages/Dashboard.tsx` (bloco "Retornos de hoje", lendo `agenda_atrasados()`: o mesmo número da faixa)
- Se você quiser o sino igual à Agenda: `hooks/useAlertasFinanceiros.ts` (fora do escopo até você pedir; ver risco 3)

---

## 11. Decisões que preciso de você antes da Onda 1

1. **D9:** a faixa de Atrasados inclui os vencimentos atrasados (hoje são 27)?
2. **D8:** o contador "sem data" conta só fiado (9) ou todo não-brinde em aberto (29)?
3. **D10:** "retorno comercial" vira camada lida de `interacoes.retomar_em` ou fica como lembrete manual?
4. **D11:** você e o Gilmar usam o mesmo login (`adm@`)? Confirma o `responsavel` como texto (`luccas`, `gilmar`, `equipe`)?
5. **§6:** confirma o `ON DELETE SET NULL` e a reabertura simétrica (estorno e descancelamento)?
6. **D12:** teste no padrão DO-block com RAISE, em vez de BEGIN…ROLLBACK?
7. **D14:** autoriza a 2ª tabela `agenda_avisos_enviados` na Onda 2?
8. **D6:** de onde veio o "54 vendas em 13/11"? Hoje o banco tem 31 em aberto.

---

## 12. Decisões aprovadas (19/10/2026)

1. **D9:** a faixa de Atrasados mostra **dois grupos separados**, cada um com contador e valor: lembretes pendentes vencidos, e vencimentos atrasados (vendas em aberto, sem brinde, com previsão de pagamento < hoje em SP).
2. **D8:** o contador "sem data" conta **todo não-brinde em aberto sem previsão** (hoje 29), com quebra por `forma_pagamento`.
3. **D10:** "Retomadas" vira uma **5ª camada só-leitura**, lida de `interacoes.retomar_em`. O tipo `retorno_comercial` continua no lembrete manual, para combinados feitos fora do WhatsApp.
4. **D11:** `responsavel` é texto com CHECK (`luccas`, `gilmar`, `equipe`). (O marcador "[AJUSTE AQUI SE NÃO DIVIDEM O LOGIN]" veio sem ajuste. Texto funciona nos dois casos; se vocês tiverem logins separados, dá para ligar `concluido_por` a um nome depois.)
5. **§6:** `ON DELETE SET NULL` em `venda_id` e `contato_id`. **Reabertura simétrica:** estorno e descancelamento reabrem só o que o trigger fechou.
6. **D12:** teste no padrão do projeto (DO-block com RAISE): `supabase/tests/agenda_lembretes.sql`.
7. **D14:** tabela `agenda_avisos_enviados` autorizada, para a Onda 2.
8. **D6:** o "54" do README estava errado. Vale o banco (13/11 = 31 vendas, R$ 1.875,00 em 19/10).
9. **Aviso das 8h:** destino é o **grupo Equipe** desde o início.
10. **D4:** autorizado `ui/Popover.tsx` tokenizado na Onda 3. A FolhaInferior fica para decidir na Onda 4.
11. **Sem migração de seed.** Os lembretes de 19/10 serão gravados pelo Claude, com `origem='claude'`, direto no banco.

### O que a Onda 1 interpretou (para você conferir)

| Ponto | Como ficou | Por quê |
|---|---|---|
| Cancelamento | Fecha como `cancelado` só os lembretes **parcela/cobranca** da venda. Pendência interna, retorno comercial e "outro" continuam pendentes. | Uma pendência ligada a venda cancelada (ex.: "devolver o dinheiro") continua sendo trabalho. O prompt 01 fala do mesmo conjunto do pagamento. |
| Venda paga e depois cancelada | Os lembretes fechados como `venda_paga` ficam feitos. O `cancelVenda` zera `pago`, mas isso não é tratado como estorno. | Foram pagos de fato. |
| Brinde nas Entregas | ~~Fora de tudo~~ → **corrigido no ajuste 2 abaixo**: entra na camada entrega, com valor 0. | Brinde é entrega de verdade, só não é dinheiro. |
| Contas a pagar atrasadas | **Não** entram em `agenda_atrasados` (D9 = lembretes + vencimentos). Aparecem no próprio dia, com `atrasado = true`. | Hoje há 3 parcelas do Gilmar (abr–jun, R$ 3.497,50) em aberto. |
| Lembrete cancelado | Não volta em `agenda_itens`. Pendente e feito voltam, com `situacao`. | Cancelado não é compromisso. |
| `vezes_reagendado` | Controlado pelo banco: soma 1 a cada mudança de data de um pendente; ignora valor vindo da tela. | Assim o contador não mente. |
| Conclusão | `concluido_em` / `concluido_por` / `motivo` são carimbados pelo trigger. A tela só manda `situacao`. Reabrir limpa os três. | Regra no banco, não na tela. |
| Cliente do lembrete | Com `venda_id` e sem `contato_id`, o banco preenche o cliente da venda. Cliente diferente do da venda é recusado. | Evita um lembrete apontando para o cliente errado. |
| Retomadas | Mesmo critério da cadência do `view_relacionamento_kanban`: vale o `retomar_em` da última saída/adiamento depois da última resposta do cliente. Contato arquivado, resolvido ou recusou fica fora. | Respondeu, a retomada some. Sem cópia. |
| "Sem data" | `agenda_sem_data()` devolve a **lista** (com `forma_pagamento` e `dias_em_aberto`). Contagem e quebra saem dela. | A tela precisa da lista para "abrir e preencher". |
| `valor` | Nas vendas: `total − valor_pago` (0 na entrega de brinde). Na conta a pagar: `saldo_devedor`. No lembrete: `lembretes.valor` (parcela combinada); sem ele, o em aberto da venda ligada. | Prompt 03: o valor vem da função. |

### Ajustes da revisão da migração (19/10/2026)

1. **Uma dívida, um item.** `lembretes.valor numeric(10,2)`, com `CHECK (valor IS NULL OR valor > 0)`, guarda o valor da parcela combinada. Em `agenda_itens`, o lembrete mostra `COALESCE(l.valor, em aberto da venda)`. Na camada vencimento de `agenda_itens` e no grupo vencimento de `agenda_atrasados`, **sai a venda que tem lembrete PENDENTE de parcela/cobrança**: o lembrete passa a ser o dono da cobrança. Feito o último lembrete pendente, o vencimento volta, se a venda continuar em aberto. Caso real: Ana Maria, previsão 07/11, duas parcelas de R$ 32,50 (07/11 e 07/12). Enquanto a 2ª parcela estiver pendente, o vencimento continua escondido.
2. **Brinde nas entregas.** Brinde continua fora de vencimentos, atrasados e sem data (não é dinheiro a receber), mas **entra na camada entrega com valor 0**. Isto corrige o "brinde fora de tudo" registrado antes.
3. **Cobrança em venda fechada.** `fn_lembretes_regras` recusa parcela/cobrança que nasce, ou é religada (troca de `venda_id` ou de `tipo`), numa venda já paga ("Essa venda já está paga") ou cancelada ("Essa venda está cancelada"). Pendência interna e os outros tipos continuam permitidos. A reabertura feita pelo trigger da venda não passa por essa regra: ela só acontece quando a venda volta a ficar em aberto.

Testes novos: T14 (dono da cobrança, nas formas de 1 e 2 parcelas e nos atrasados), T15 (entrega de brinde com valor 0) e T16 (cobrança recusada em venda paga ou cancelada, inclusive ao religar). R1 a R3 passaram a aplicar a regra de exclusão no SELECT direto. O T2 agora confere que o vencimento não duplica a parcela pendente. O T11 confere que valor 0 e valor negativo são recusados.

**Para você decidir depois (não implementado):**
- `agenda_sem_data()` **não** aplica a regra de dono da cobrança. Uma venda sem previsão que já tem parcela/cobrança pendente continua contada como "sem data", embora na prática já tenha data. Se quiser, é a mesma linha de `NOT EXISTS`.
- Reabrir à mão (feito → pendente) uma cobrança cuja venda já foi paga **não é bloqueado**: a regra cobre nascer e religar. Bloquear a reabertura esbarraria no descancelamento de venda paga, que reabre e fecha de novo no mesmo trigger.
- Cobrança ligada a **brinde** é aceita. Ela nunca fecharia sozinha, porque brinde nunca fica pago. Dá para recusar com a mesma regra ("Essa venda é brinde").

## 13. Onda 1 — como testar e aplicar

Arquivos: `supabase/migrations/20261019161813_agenda_lembretes.sql` e `supabase/tests/agenda_lembretes.sql`.

1. **Backup:** `.\supabase\scripts\dump-prod.ps1` (na raiz do repo, no PowerShell).
2. **Ensaio sem aplicar:** no SQL Editor, cole **a migração inteira e, logo abaixo, o teste inteiro**, numa execução só. O RAISE do teste desfaz tudo, inclusive a migração.
   - Esperado: erro `P0001` começando com `SUITE_OK agenda_lembretes 20/20`.
   - Depois rode `SELECT to_regclass('public.lembretes');`. Tem que voltar **NULL** (nada ficou).
3. **Aplicar** (com sua autorização): pelo `apply_migration` do MCP, para registrar no histórico de migrações.
4. **Conferência pós-aplicação:** rode só o teste de novo (`SUITE_OK 20/20`) e a consulta do rodapé do arquivo de teste. As contagens têm que bater com `contagens_antes`.
