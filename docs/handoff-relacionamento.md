# Handoff — Módulo Relacionamento (CRM Pós-Venda)

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
| 5 | Perfil do cliente (sheet read-only de contexto) | 🔜 planejada |
| — | Migração da planilha de campanhas → tags | 🔜 pendente (destravada) |

Ordem real de entrega: timeline → feedback → tags.

---

## Arquitetura atual (pós-Fatia 3)

```
apps/interno/src/
  pages/Relacionamento.tsx          — página kanban (board + sheets)
  components/relacionamento/
    TimelineSideSheet.tsx           — histórico read-only
    FeedbackSideSheet.tsx           — form de registro de feedback
    TagsSideSheet.tsx               — gerenciar tags do contato
  hooks/  useRelacionamento.ts, useInteracoes.ts, useTags.ts
  services/ interacaoService.ts, relacionamentoService.ts, tagService.ts
```

Click no card → ActionBar com 3 botões empilhados (Linha do tempo / Feedback / Tags); um sheet por vez.
Face do card: barras coloridas estilo Trello recolhido (nome no title hover).

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
3. Campos núcleo do Perfil (Fatia 5): dias sem compra, última compra (produto+data), LTV/total, nº de compras, atraso na recompra, fiado (3 estados), telefone clicável — confirmar lista.
4. Migração da planilha: granularidade (cada campanha = 1 tag?) + diagnóstico de match por nome antes de qualquer escrita.

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

## Depois — Fatia 5 (Perfil) e Migração da planilha

- **Perfil:** sheet read-only com os campos núcleo + fiado 3 estados + atraso derivado.
- **Planilha:** diagnóstico de match → granularidade → import com OK explícito. (Coluna A mistura DDM=tag, 1ºContato/CTA=funil, Feedback=interação, Whats Incorreto=qualidade; Onda fora.)

---

## TODO (processos — ordem)

- [x] Atualizar este handoff (Claude Code) ← meta-tarefa
- [ ] Diretor responder decisões em aberto 1–3
- [ ] Abrir chat NOVO de execução, semeado por este handoff
- [x] Fatia 4: reescrita da view + 2 consertos
- [ ] Fatia 5: Perfil
- [ ] Migração planilha
- [ ] (Track separado, sem pressa) estoque/categorias/lotes → validade no produto → teto de validade
