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
| 3b-2 | Tags de campanha — chips na face do card (estilo Trello recolhido) | ✅ FEITA |

**Ordem real de entrega:** timeline → feedback → tags (difere da ordem original que
previa feedback dentro da timeline).

---

## Arquitetura atual (pós-Fatia 3)

### Componentes do módulo
```
apps/interno/src/
  pages/Relacionamento.tsx          — página kanban (board + sheets)
  components/relacionamento/
    TimelineSideSheet.tsx           — histórico read-only (movimentações + feedbacks)
    FeedbackSideSheet.tsx           — form de registro de feedback (sheet próprio)
    TagsSideSheet.tsx               — gerenciar tags do contato (criar, aplicar, remover)
  hooks/
    useRelacionamento.ts            — useKanbanData, useMoverCard
    useInteracoes.ts                — useInteracoes, useRegistrarFeedback
    useTags.ts                      — useTags, useContatoTags, useCriarTag, useAplicarTag, useRemoverTag
  services/
    interacaoService.ts             — getByContato, criarFeedback
    relacionamentoService.ts        — moverCard
    tagService.ts                   — listTags, listContatoTags, criarTag, aplicarTag, removerTag
```

### Fluxo de UI
- Click no card → ActionBar com três botões empilhados verticalmente:
  - **Linha do tempo** → abre `TimelineSideSheet` (read-only, fecha os demais)
  - **Feedback** → abre `FeedbackSideSheet` (form, fecha os demais)
  - **Tags** → abre `TagsSideSheet` (chips aplicados + picker + criar-e-aplicar, fecha os demais)
- Só um sheet aberto por vez (mutual exclusion por estado separado no board)
- Face do card: barras coloridas estilo Trello recolhido no topo (nome no `title` hover)

### Tabelas envolvidas
- `contatos` — PK `id uuid`, coluna `status_relacionamento enum_relacionamento_status`
- `interacoes` — `tipo`, `canal`, `observacao`, `resultado`, `contato_id`, `criado_por`
- `view_relacionamento_kanban` — agrega contatos com `aba_atual` e `status_relacionamento`
- `tags` — lookup global: `id uuid`, `nome text UNIQUE`, `cor text`, `criado_em`
- `contato_tags` — associação N:N: `contato_id FK`, `tag_id FK`, `criado_em`

---

## Decisões travadas (não reabrir sem justificativa explícita)

### `resultado` é exclusivo do status de kanban
Feedback grava `resultado = NULL`. O campo `resultado` em `interacoes` representa
exclusivamente o destino de uma movimentação de kanban (a_contatar / contatado /
em_negociacao / resolvido). Nunca gravar intenção de compra ou qualquer outro dado
de negócio nesse campo.

### `canal` = vocabulário fechado
`'google' | 'instagram' | 'whatsapp' | 'outro'` — definido como union type em
`interacaoService.ts` (`type Canal`), constante no front via `CANAL_OPTIONS`.
Nunca passar string solta na chamada.

### FeedbackSideSheet separado da timeline
O form de feedback vive em `FeedbackSideSheet.tsx`, separado de `TimelineSideSheet.tsx`
que é somente leitura. A entrada de feedback salva aparece na timeline quando ela
for aberta (query invalidada por `useRegistrarFeedback.onSuccess`).

### `criado_por` pode ser NULL
A policy de INSERT em `interacoes` aceita `criado_por IS NULL`. Sistema é
single-admin, sem atribuição de autor. Não puxar `auth.uid()` à toa.

### Tags: cor LIVRE, sem paleta restrita
A cor de cada tag é um hex livre escolhido pelo usuário via `<input type="color">`.
Não existe paleta fechada. Contraste do texto sobre a cor é calculado em runtime
por luminância Rec601 (`textColorForBg`). Não reabrir esse ponto.

### Chips no card: barra colorida, sem texto
A representação visual de tag na face do card é uma barra colorida (`h-[5px] w-8`)
sem texto visível — nome aparece apenas no `title` (hover). O `TagsSideSheet` já
mostra o nome completo. Não adicionar texto na barra sem necessidade explícita.

### `useContatoTags` busca global, filtra em memória
`useContatoTags()` retorna TODAS as `contato_tags` em uma única query (sem parâmetro
de `contato_id`). Cada `CardBody` filtra em memória. React Query deduplicou — zero
fetches paralelos. Mutations invalidam `['contato_tags']` → chips atualizam na hora.
Não recriar a `view_relacionamento_kanban` para incluir tags; fetch separado é a
decisão adotada.

### Sem tela de gestão global de tags
Não existe (e não está planejada) uma tela administrativa de tags. Tags são criadas
ad-hoc dentro do `TagsSideSheet` de cada contato. A unicidade é garantida por
`UNIQUE` no banco (`error.code === '23505'` → mensagem amigável ao usuário).

---

## Dívida consciente

### Movimentação de kanban: origem não estruturada
`interacoes` do tipo `movimentacao_kanban` gravam o texto `"Movido de X para Y via
drag-and-drop"` em `observacao` (texto livre) e o destino em `resultado`. A origem
não está em campo estruturado. Serve para exibição na timeline, não para métrica de
funil. Estruturar (adicionar coluna `resultado_anterior`) só se nascer demanda real
de analytics de conversão entre colunas.

---

## Próximo: Migração da planilha (Fatia 4 — destravada pela Fatia 3)

As tags existem. A próxima fatia natural é importar os contatos da planilha de
campanhas e gravar as campanhas como tags.

### Fluxo previsto
1. **Diagnóstico de match** — cruzar contatos da planilha com `contatos` da base,
   casar por nome (fuzzy ou exact). Identificar taxa de match e casos ambíguos.
2. **Decisão de granularidade** — cada campanha da planilha vira uma tag?
   ou agrupamentos? (Definir com o diretor antes de executar.)
3. **Script de importação** — para cada linha da planilha com match confirmado:
   - Garantir que a tag-campanha existe em `tags` (INSERT OR IGNORE).
   - Inserir em `contato_tags` (upsert ON CONFLICT DO NOTHING).
4. **Validação** — SELECT de contagem por tag, conferência manual de amostra.

### Pré-requisitos
- Planilha de campanhas disponível (formato a definir).
- Taxa de match aceitável para nome → `contatos.id`.
- Autorização explícita antes de qualquer escrita em produção.
