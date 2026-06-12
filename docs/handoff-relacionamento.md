# Handoff — Módulo Relacionamento (CRM Pós-Venda)

> **STATUS: ENCERRADO — 04/06/2026**
> Escopo principal do módulo Relacionamento concluído (Fatias 0–5 + Track F·*).
> Itens residuais (migração planilha, IA mensagem, opex, estoque) são tracks futuros independentes — rastrear em novos documentos ou issues.

Documento vivo. Atualizar após cada fatia entregue.

---

## Status das Fatias

| Fatia | Descrição | Status |
|-------|-----------|--------|
| 0 | Diagnóstico inicial (view, enum, RLS, padrão de migration) | ✅ FEITA |
| 1 | Timeline read-only + kanban drag + gesto de ações no card | ✅ FEITA |
| 2 | Registro de feedback em side sheet próprio | ✅ FEITA |
| 3a | Tags de campanha — migration + RLS + tipos gerados | ✅ FEITA |
| 3b-1 | Tags de campanha — motor TagsSideSheet (criar, aplicar, remover) | ✅ FEITA |
| 3b-2 | Tags de campanha — chips na face do card | ✅ FEITA |
| 4 | Reescrita da view de recompra/reativação (ritmo derivado) + 2 consertos | ✅ FEITA |
| Card | Card self-explicável — linha de motivo + tooltip + legenda "?" | ✅ FEITA |
| 5 | Perfil do cliente (sheet read-only de contexto) — 6 seções + ranking de produtos | ✅ FEITA — `c767f9a` + `e1add29` + `fffa500` (03/06) |
| — | Migração da planilha de campanhas → tags | 🔜 pendente (destravada) |
| **F·diag** | **Diagnóstico Financeiro** (Dashboard Home + Relatórios) — achados A–E | ✅ FEITA |
| **F·1** | Convergência ticket médio (A) + relabels B/C/D + RPC a-receber COUNT(DISTINCT) | ✅ FEITA — A/B/C/D commitados + RPC em prod (03/06) |
| **F·op** | Cadastro de despesas operacionais (Luccas + mãe) | 🔜 ADIADO — encanamento ✅ verificado; tela parqueada; pós-roadmap |
| **CRM·bug** | Fix "Indicado por" abre vazio no Editar Contato | ✅ FEITA — 04/06 (3 bugs em cadeia: estado não inicializado + join PostgREST direção errada + mapper tratando `[]` como truthy) |

Ordem real de entrega: timeline → feedback → tags.
Track Financeiro (F·*) é a ativação da decisão #4 — "eleger a regra da LTV como canônica e convergir o front". Independente das fatias do CRM, mesmo app/método.

---

## Arquitetura atual (pós-Fatia Card)

```
apps/interno/src/
  pages/Relacionamento.tsx          — página kanban (board + sheets + legenda "?")
  components/relacionamento/
    TimelineSideSheet.tsx           — histórico read-only
    FeedbackSideSheet.tsx           — form de registro de feedback
    TagsSideSheet.tsx               — gerenciar tags do contato
    PerfilSideSheet.tsx             — perfil read-only (6 seções: Identificação / Ritmo / Financeiro / Fiado / Última compra / Produtos comprados)
    motivoCard.ts                   — helper puro: texto + tooltip + cor + glyph por aba/estado
    LinhaMotivo.tsx                 — linha de motivo com tooltip hover/tap
  hooks/  useRelacionamento.ts, useInteracoes.ts, useTags.ts, usePerfilExtras.ts, useLtvContato.ts
  services/ interacaoService.ts, relacionamentoService.ts, tagService.ts
    (+ getPerfilExtras, getLtvContato via contatoService ou próprio)
```

Click no card → ActionBar com **4 botões** empilhados (Perfil / Linha do tempo / Feedback / Tags); um sheet por vez.
Face do card: [tags chips] → nome → ID → **linha de motivo** → telefone + badge.

---

## Tabelas envolvidas

- **contatos** — PK id uuid, status_relacionamento enum_relacionamento_status
- **interacoes** — tipo, canal, observacao, resultado, contato_id, criado_por
- **view_relacionamento_kanban** — agrega contatos com aba_atual e status_relacionamento
- **tags** — id uuid, nome (único case-insensitive via índice lower(nome)), cor text, created_at
- **contato_tags** — contato_id FK, tag_id FK, created_at, PK composta

> ⚠️ Correção 31/05: os nomes de coluna em tags/contato_tags são `created_at` (não `criado_em`) e a unicidade do nome é por índice `lower(nome)` (não UNIQUE simples). Tipos confirmados em `packages/shared/src/database.ts`.

---

## Decisões travadas (não reabrir sem justificativa)

**`resultado` é exclusivo do status de kanban**
Feedback grava `resultado = NULL`. `resultado` = destino de movimentação (a_contatar/contatado/em_negociacao/resolvido). Nunca gravar intenção de compra ali.

**`canal` = vocabulário fechado**
`'google' | 'instagram' | 'whatsapp' | 'outro'` (type `Canal` em `interacaoService.ts`, `CANAL_OPTIONS` no front).

**FeedbackSideSheet separado da timeline**
Form em `FeedbackSideSheet.tsx`; `TimelineSideSheet.tsx` é só leitura. Entrada aparece na timeline via invalidação em `useRegistrarFeedback.onSuccess`.

**`criado_por` pode ser NULL**
Policy de INSERT em `interacoes` aceita NULL. Single-admin. Não puxar `auth.uid()` à toa.

**Tags: cor LIVRE + chips sem texto + busca global filtrada em memória + sem tela de gestão**
Cor via `<input type="color">`, contraste por luminância Rec601. Chip = barra colorida sem texto. `useContatoTags()` busca tudo numa query e filtra em memória; mutations invalidam `['contato_tags']`. Não recriar a view pra tags. Unicidade no banco (23505 → msg amigável).

**Abas são mutuamente exclusivas (confirmado 31/05)**
`aba_atual` é um único CASE if/elif/else (cobranca → reativacao → recompra-else). Cada contato cai em exatamente uma. Sem duplicação por construção. Confirmar empiricamente que não há fan-out:
```sql
select contato_id, count(distinct aba_atual) from view_relacionamento_kanban group by 1 having count(distinct aba_atual) > 1; → deve voltar VAZIO.
```

**Modelo de recompra/reativação — aba reflete AÇÃO, não contagem (trava 01/06)**

Princípio: a aba diz o que FAZER com o cliente, não quantas vezes ele comprou.

```
intervalo_medio = (ultima_compra - primeira_compra) / (total_pedidos - 1)
proxima_esperada = ultima_compra + intervalo_medio
atraso = hoje - proxima_esperada   ← positivo = atrasado; negativo = adiantado
```
É MÉDIA (sensível a outlier). Mediana = refinamento futuro.

**Classificação por aba:**

| Situação | Aba | Motivo |
|----------|-----|--------|
| 0 compras (lead) | FORA | Não há pós-venda sem venda |
| 1 compra, `dias < limiar` (balde cheio) | **RECOMPRA** | Ainda consumindo — ação = cuidar da relação, não resgatar |
| 1 compra, `dias >= limiar` (balde vazio) | **REATIVAÇÃO** | Balde vazio — win-back, ainda sem ritmo derivável |
| ≥2 compras (sempre) | **RECOMPRA** | Ritmo derivado; atraso ordena urgência |

**Flags de estado (colunas da view):**
- `balde_cheio` (bool): true quando `total_pedidos=1 AND dias_sem_compra < limiar`. Paralelo ao `sumido`. Usado para badge no card.
- `sumido` (bool): true quando `atraso >= ROUND(intervalo_medio × multiplicador_sumido)`. Apenas tier ≥2.
- `atraso` (int|null): NULL para tier 0 e 1 (sem ritmo derivável).

**Assimetria intencional e justificada:**
- Cliente ≥2 frio (atraso grande) fica em **recompra** com atraso elevado (sobe ao topo). NÃO migra pra reativação. Razão: já provou que compra — o ritmo é real, só atrasado. Ação = empurrar na hora certa.
- Cliente 1-compra frio vai pra **reativação** (win-back). Razão: sem histórico suficiente para derivar ritmo — tratar como resgate, não como ciclo.

**Ordenação no service (`relacionamentoService.ts`):**
- `recompra`: `atraso DESC NULLS LAST` → ≥2 mais atrasados no topo, balde cheio (NULL) no fundo.
- `reativacao`: `dias_sem_compra DESC` → mais tempo sem 2ª compra primeiro.
- `cobranca`: `nome ASC`.

**Limiar configurável:** `configuracoes.relacionamento.limiar_reativacao` (padrão 30d). Multiplicador de sumido: `multiplicador_sumido` (padrão 1.5). Ambos tunáveis na tela Configurações.

**Fiado no perfil: três estados (trava 31/05)**
`nunca usou | quitou | em aberto`, derivado de `vendas.forma_pagamento + pago`. NÃO é booleano "já comprou fiado?". "Em aberto" deve bater com o cliente estar na aba Cobrança. Uso: objeção de preço de quem QUITOU → ofertar prazo com segurança; quem tem EM ABERTO → não oferecer mais fiado.

**`fiado_estado` no perfil vem da view, NÃO re-derivado de vendas (trava 03/06)**
`fiado_estado='em_aberto'` é lido diretamente de `aba_atual='cobranca'` em `view_relacionamento_kanban` — fonte única de verdade. Proibido criar lógica paralela que recalcule o estado de fiado a partir de `vendas`. A view já faz esse trabalho; re-derivar quebraria a consistência entre o card e o perfil.

**Todo RPC novo nasce com guard `is_admin` no topo (trava 03/06)**
`rpc_perfil_extras(contato_id)` e todos os RPCs futuros devem começar com `IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;` como primeira instrução. Sem exceção.

**Lucro líquido — `custo_fabrica` FORA por design; `liquido == bruto` é falta de opex, NÃO bug (trava 02/06)**

NÃO existe subtração de `custo_fabrica` no `lucro_liquido` hoje — e está correto assim. NÃO mandar o Claude Code "remover" nada daqui (engano comum: o valor aparece como *coluna* na view, mas não entra na *conta*). Fórmula viva confirmada: `lucro_liquido = lucro_bruto − despesas_operacionais`.

- `custo_fabrica` (de `purchase_order_payments`) = CMV pago em PRESTAÇÃO ao Mont Massas (via Izualino). O custo do produto vendido JÁ está embutido no `lucro_bruto` (competência — mai/26: faturamento R$12.146 − ~R$7.114 de custo = bruto R$5.032). `custo_fabrica` (R$2.545 em mai) é o lado CAIXA do mesmo estoque. Somar no líquido contaria o custo duas vezes. Fica fora; é indicador de contas-a-pagar à fábrica, não dedução de lucro.
- `lucro_liquido == lucro_bruto` HOJE porque `despesas_operacionais = 0`: nada em `lancamentos` passa no filtro da CTE `desp_op` (`tipo='saida' AND origem NOT IN ('migracao_historica','compra_fabrica')`). Não é cálculo errado, é dado incompleto. Efeito: o líquido SUPERESTIMA o lucro real (ignora opex). Conserto = cadastrar opex (track operacional F·op), não mexer em fórmula.

**Ticket médio canônico = por evento `(contato_id, data)` (trava 02/06) — CONVERGIDO ✅**

Mesma régua da `rpt_ltv` (decisão #4). `view_home_financeiro.ticket_medio` usava `AVG(linhas)` → subestimava (mai/26: R$59,54 / 204 linhas vs. canônico R$62,93 / 193 eventos — 11 linhas = múltiplos itens entregues ao mesmo cliente no mesmo dia). **Convergido em prod via migration `20260602200000_fix_ticket_medio_por_evento_home.sql`** (aplicada 02/06, não commitada). Fórmula: `SUM(total filtrado) / NULLIF(COUNT(DISTINCT (contato_id, data)) filtrado, 0)`, `WITH (security_invoker = true)` preservado, sem ROUND (front formata). `vendas.data` é `date` — sem cast necessário. Se um `pedido_id` real surgir no schema, revisitar `rpt_ltv` + esta JUNTAS — não divergir.

---

## Spec — Fatia Card (linha de motivo)

### Régua card vs perfil (trava 02/06)

O card mostra **somente o que explica a posição** (por que este cliente está aqui e qual é a urgência). Todo o resto — LTV, ticket médio, histórico completo, fiado 3 estados, último produto — vai para o **Perfil (Fatia 5)**.

### Linha de motivo — rótulos por estado

| Estado | Linha exibida | Cor |
|--------|--------------|-----|
| cobranca | `fiado em aberto` | `text-warning-strong` (laranja) |
| reativacao | `1ª compra · sumiu há {dias_sem_compra}d` 🪣vazio | `text-primary/75` (verde neon) |
| recompra · balde cheio | `1ª compra há {dias_sem_compra}d · balde cheio` 🪣cheio | `text-muted-foreground/40` (apagado) |
| recompra ≥2 · sumido | `compra a cada ~{ciclo}d · sumiu ({atraso}d atrasado)` | `text-destructive` (vermelho) |
| recompra ≥2 · atrasou | `compra a cada ~{ciclo}d · atrasou {atraso}d` | `text-warning` (âmbar) |
| recompra ≥2 · no ritmo | `compra a cada ~{ciclo}d · no ritmo` | `text-muted-foreground/60` (calmo) |

**Regra do número exibido = chave de ordenação da coluna:** recompra ≥2 mostra `atraso` (mesma chave que ordena a coluna por urgência); reativação mostra `dias_sem_compra` (idem). O operador entende por que o card está naquele nível de fila sem saber as regras.

**Guard:** `ciclo = Math.max(1, Math.round(intervalo_medio))` — evita exibir "a cada ~0d" quando duas compras caem no mesmo dia.

**Balde glyph:** silhueta SVG inline, 11×12px, apenas nos estados de 1 compra. ≥2 compras usa cor + texto (ritmo derivado calculável), sem glyph.

### Gauge / radial — PARQUEADO (nota de design para Fatia 5 + Relatórios)

Não entra no card. Ideia registrada para uso posterior:
- **Balde no Perfil:** balde que esvazia progressivamente ao longo da janela do limiar (cheio = acabou de comprar; vazio = passou o prazo). Representa o grau de consumo.
- **Anel de atraso (≥2):** anel de progresso no Perfil ou em Relatórios para visualizar o quanto o cliente passou do ritmo esperado.

Esses elementos pertencem ao contexto de análise do Perfil (espaço para mais dados) e de Relatórios — não ao card que é contexto de varredura rápida.

---

## Dívida técnica RESOLVIDA na Fatia 4

**`dias_sem_compra` — unificado (entregue + não-brinde)** ✅
Definição canônica aplicada em `view_relacionamento_kanban` e `view_home_alertas`.

**Fallback `coalesce(..., criado_em)`** ✅
Eliminado — tier 0 compras = fora do kanban (aba_atual = NULL).

---

## Dívida consciente (não-urgente)

**Movimentação de kanban: origem não estruturada**
`movimentacao_kanban` grava texto em `observacao` e destino em `resultado`; origem não é campo estruturado. Serve pra exibir, não pra métrica de funil. Estruturar só se nascer demanda de analytics de conversão entre colunas.

---

## PARQUEADO — track SEPARADO (NÃO é dependência da Fatia 4)

Scope creep no módulo de estoque/produtos. NÃO bloqueia nem entra na reescrita da view. Limpeza própria, isolada, sem bolar na Fatia 4:

- Categorias podem não existir / incompletas.
- Sem lotes de produto com validade (lote importa pra estoque/validade física, NÃO pra previsão de recompra).
- Aba de Estoque incompleta (parada). Possível estoque negativo.
- Validade no produtos (conservação resfriado 30d / congelado 120-190d) — pré-req do "teto de validade", adiado.

Meta: views limpas, zero frankenstein. Por isso este track fica isolado.

---

## Decisões EM ABERTO (precisam do diretor)

1. ~~Valor do limiar de reativação~~ ✅ **30 dias** (configurável em `configuracoes.relacionamento`)
2. ~~Confirmar: cliente ≥2 que esfria fundo fica em recompra-com-atraso~~ ✅ **Confirmado**
3. ~~Campos núcleo do Perfil (Fatia 5)~~ ✅ **Entregue** — 6 seções: Identificação / Ritmo (atraso, ciclo, dias sem compra) / Financeiro (LTV, ticket, nº compras) / Fiado (3 estados) / Última compra (produto+data) / Produtos comprados (ranking por qtd). `c767f9a` + `e1add29` + `fffa500`.
4. Migração da planilha: granularidade (cada campanha = 1 tag?) + diagnóstico de match por nome antes de qualquer escrita.
5. ~~**Despesas operacionais — cadastro (track F·op).** PRÉ-REQUISITO TÉCNICO verificado 03/06: caminho grava `lancamentos(tipo='saida', origem='manual')`, passa no filtro desp_op, cai no lucro_liquido. UI parqueada. **ADIADO** por decisão do diretor — última prioridade do roadmap.~~ ✅ Encerrado como questão aberta.

**Track futuro (NÃO desta fatia):** "nutrição de 1ª recompra" — acompanhar clientes de 1 compra warm rumo à 2ª compra dentro do grace period. Candidato a trigger no WhatsApp-K.

---

## Diagnóstico do ciclo (31/05) — referência

- `ciclo_recompra`: linha em `configuracoes`, JSONB `{"b2b":7,"b2c":15}`, global, manual → será removido.
- View atual: cobranca (fiado aberto) → reativacao (dias > ciclo) → recompra (else).
- Agregados existentes por contato: `ranking_compras` (count/sum/ultima, sem primeira), `rpt_ltv_por_cliente` (primeira+ultima+count+ltv+ticket+dias_relacionamento+status_atividade; INNER JOIN), `rpt_churn` RPC (dias_sem_compra acima de threshold).
- NÃO existe view com array de datas por contato (não precisa — fórmula do intervalo médio dispensa).

---

## Fatia 4 — Reescrita da view (PRÓXIMA). Escopo BOUNDED.

Mexe SÓ na lógica de classificação + os 2 consertos. NÃO toca estoque/produtos/categorias/lotes.

1. Definir `dias_sem_compra` canônico (entregue + não-brinde).
2. Reescrever `view_relacionamento_kanban`: tier 0/1/≥2; matar `ciclo_recompra` global; expor `dias_sem_compra` e `atraso` como colunas.
3. Remover linha `ciclo_recompra` de `configuracoes`; adicionar config do limiar de reativação.
4. Consertar `view_home_alertas` (excluir brinde).
5. Migration versionada (DDL/view obrigatório). Backup antes. Validar NO BROWSER (build verde não é prova).

---

## Fatia F — Convergência Financeira (Dashboard Home + Relatórios). Escopo BOUNDED.

Origem: decisão #4 (eleger a regra da LTV como canônica e convergir o front) + diagnóstico financeiro 02/06 (achados A–E). Mexe SÓ no ticket médio (view) e em labels/guard de front. NÃO toca `lucro_liquido`/`custo_fabrica` (decisão travada acima — está correto).

### Estado verificado (03/06 — contra código + git)

- **A — ticket médio (BANCO):** ✅ **COMMITADO** — `43d4772` (02/06).
  - Migration `supabase/migrations/20260602200000_fix_ticket_medio_por_evento_home.sql` commitada e aplicada em prod.
  - Fórmula: `SUM(filtrado) / NULLIF(COUNT(DISTINCT (contato_id, data)) filtrado, 0)`. `security_invoker=true`. Sem ROUND.

- **B — label "A Receber" (FRONT) + RPC COUNT(DISTINCT):** ✅ **COMMITADO** — `b9bb784` (03/06).
  - Dashboard.tsx — trend mostra contagem por clientes distintos.
  - dashboardService.ts + migration `20260603120000_fix_rpc_total_a_receber_clientes_distintos.sql` — RPC alterado para `COUNT(DISTINCT contato_id)` com `is_admin` preservado. Decisão: opção (2) COUNT(DISTINCT).

- **C — label "30d" e botões (FRONT):** ✅ **COMMITADO** — `575da7d` (03/06).
  - `TabFinanceiro.tsx` — label dinâmico `Faturamento · ${currMesAbrev}/${fat.ano}`.
  - `Relatorios.tsx` — botões 90d/6m/1a: `disabled`, `cursor:'not-allowed'`, `opacity:0.4`.

- **D — guard mês em curso (FRONT):** ✅ **COMMITADO** — `575da7d` (03/06).
  - `calculations.ts` — helper `isMesEmCurso(ano, mes)`.
  - `Dashboard.tsx` — Faturamento KpiCard guarded.
  - `TabFinanceiro.tsx` — DeltaPill condicional guarded.
  - `KpiCard.tsx` — `trendDirection="neutral"` renderiza traço (badge vazio) em vez de texto.

- **E — lucro líquido:** ✅ **ENCERRADO** (decisão travada). Zero código alterado. Track operacional F·op.

- **F·op — encanamento:** ✅ **VERIFICADO** (diagnóstico read-only 03/06).
  - `registrar_despesa_manual` (RPC) grava `lancamentos(tipo='saida', origem='manual')`. Passa no filtro `desp_op` (`origem NOT IN ('migracao_historica','compra_fabrica')`). Cai direto no `lucro_liquido`. Zero fix de banco necessário.
  - Fábrica (`purchase_order_payments`) é rastreada separada na CTE `custo_fab`. Card "Próximos 30 dias" usa `rpt_projecao_recebimentos` (dinheiro a receber de clientes) — sem relação com fábrica.
  - UI: rota `/fluxo-caixa` é `ParkedRoute` (retorna null desde Fase 4). Serviço e RPC prontos; falta tela.
  - **ADIADO por decisão do diretor (03/06):** reativar tela + cadastro operacional é última prioridade do roadmap. Não cadastrar opex agora.

> ⚠️ **Nota aberta — brinde/desp_op (03/06):** os 7 registros `lancamentos(tipo='saida', origem='brinde')` passam no filtro denylist atual e são contados como `despesas_operacionais`, reduzindo `lucro_liquido` em: jan/26 −R$163, fev/26 −R$25, mar/26 −R$25 (total R$213). Todos pré-zero-date (mai/26). Nenhum impacto em abr/mai (despesas_op=0 nesses meses). Decisão pendente do diretor: excluir `'brinde'` da denylist (virar `NOT IN ('migracao_historica','compra_fabrica','brinde')`) ou migrar para allowlist. Não urgente enquanto não houver opex real cadastrada.

### Fatia F — concluída (03/06)

Todos os itens A–D commitados e aplicados em prod. RPC a-receber COUNT(DISTINCT) implementado. F·op encanamento verificado e adiado por decisão do diretor. Nota aberta: brinde/desp_op (acima).

## Track Futuro — IA de Sugestão de Mensagem (planejado / não-iniciado)

**Objetivo:** no Perfil do cliente, a IA analisa o contexto e rascunha uma mensagem de WhatsApp personalizada. O operador lê, edita se quiser, e copia/cola manualmente. A IA nunca contacta — humano no meio, sempre.

**Arquitetura planejada:**

1. **Edge Function Supabase** recebe `contato_id`.
2. Agrega variáveis server-side: estágio/aba (`cobranca|reativacao|recompra`), `dias_sem_compra`, `atraso`, produtos + qtd (ranking já entregue), `fiado_estado`, ticket médio.
3. Chama LLM (Groq/Llama ou Claude API) com prompt estruturado. Chave da API fica no servidor — nunca exposta ao front.
4. Retorna mensagem rascunho + botão "Copiar" no `PerfilSideSheet`.

**Requisitos do prompt (antes de implementar, criar skill `mont-brand-voice`):**

| Requisito | Detalhe |
|-----------|---------|
| Brand voice | Tom Mont (skill `mont-brand-voice` — ainda não existe) |
| Ramificação por estágio | cobrança → gentil; reativação → win-back; recompra → nudge de recompra |
| Respeitar fiado | `em_aberto` → não oferecer mais fiado na mensagem |
| CRÍTICO | Só dados reais; proibido inventar promoção, preço ou data que não esteja no banco |
| Rascunho editável | Campo textarea editável antes de copiar |

**Dependência já entregue:** ranking de produtos por cliente (`rpc_perfil_extras` — Fatia 5.1 `e1add29`).

**Estado:** planejado pelo diretor — não iniciado. Não há branch, não há código.

---

## Próximo — Migração da Planilha → Tags

**Diagnóstico pendente antes de qualquer escrita:** verificar match de nomes + granularidade (cada campanha = 1 tag?). Coluna A da planilha mistura DDM=tag, 1ºContato/CTA=funil, Feedback=interação, Whats Incorreto=qualidade — definir o que vira tag e o que é descartado.

---

## Roadmap — próximas ações (ordem de prioridade)

| Prioridade | Item | Estado |
|-----------|------|--------|
/ 🔜 Depois | IA de sugestão de mensagem | planejado / não-iniciado |
| ⏸ Adiado | F·op — cadastro opex (fluxo-caixa) | última prioridade |
| ⏸ Sem pressa | Estoque / categorias / lotes / validade | parqueado |
| ⏸ Sem pressa | @mont/ui, migração migrations, archive repos | roadmap técnico |

---

## TODO (processos — ordem)

- [x] Atualizar este handoff (Claude Code) ← meta-tarefa
- [x] Fatia 4: reescrita da view + 2 consertos
- [x] Fatia 5: Perfil do cliente (PerfilSideSheet read-only + ranking de produtos) — `c767f9a` + `e1add29` + `fffa500`
- [x] Diagnóstico Financeiro (achados A–E) ← FEITO
- [x] Diagnóstico read-only de schema/front ← FEITO (02/06)
- [x] F·1 A — ticket por evento (banco): migration commitada `43d4772`
- [x] F·1 B — label "a receber" + RPC COUNT(DISTINCT contato_id): commitado `b9bb784`
- [x] F·1 C — label dinâmico + botões disabled: commitado `575da7d`
- [x] F·1 D — guard mês em curso: commitado `575da7d` (KpiCard neutral renderiza traço)
- [x] F·1: A+B+C+D commitados em prod (03/06)
- [x] F·op: encanamento verificado — `saida/manual` passa no desp_op; UI parqueada; ADIADO por decisão do diretor
- [x] Fix "Indicado por" (ContatoFormModal + contatoService.getById + mappers) — 04/06
- [x] *(track futuro)* Migração planilha → tags (diagnóstico → import com OK explícito)
- [ ] *(track futuro)* IA de sugestão de mensagem (criar skill `mont-brand-voice` → Edge Function → front)
- [ ] *(track separado, sem pressa)* estoque/categorias/lotes → validade no produto → teto de validade
/res