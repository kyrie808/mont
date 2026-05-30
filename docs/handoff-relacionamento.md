# Handoff — Módulo Relacionamento (CRM Pós-Venda)

Documento vivo. Atualizar após cada fatia entregue.

---

## Status das Fatias

| Fatia | Descrição | Status |
|-------|-----------|--------|
| 0 | Diagnóstico inicial (view, enum, RLS, padrão de migration) | ✅ FEITA |
| 1 | Timeline read-only + kanban drag + gesto de ações no card | ✅ FEITA |
| 2 | Registro de feedback em side sheet próprio | ✅ FEITA |
| 3a | Tags de campanha — migration + RLS + tipos gerados | pendente |
| 3b | Tags de campanha — UI (chip no card, sheet de tags) | pendente |

**Ordem real de entrega:** timeline → feedback → tags (difere da ordem original que
previa feedback dentro da timeline).

---

## Arquitetura atual (pós-Fatia 2)

### Componentes do módulo
```
apps/interno/src/
  pages/Relacionamento.tsx          — página kanban (board + sheets)
  components/relacionamento/
    TimelineSideSheet.tsx           — histórico read-only (movimentações + feedbacks)
    FeedbackSideSheet.tsx           — form de registro de feedback (sheet próprio)
  hooks/
    useRelacionamento.ts            — useKanbanData, useMoverCard
    useInteracoes.ts                — useInteracoes, useRegistrarFeedback
  services/
    interacaoService.ts             — getByContato, criarFeedback
    relacionamentoService.ts        — moverCard
```

### Fluxo de UI
- Click no card → ActionBar com dois botões empilhados verticalmente:
  - **Linha do tempo** → abre `TimelineSideSheet` (read-only, fecha o sheet de feedback)
  - **Feedback** → abre `FeedbackSideSheet` (form, fecha o sheet de timeline)
- Só um sheet aberto por vez (mutual exclusion por estado separado no board)

### Tabelas envolvidas
- `contatos` — PK `id uuid`, coluna `status_relacionamento enum_relacionamento_status`
- `interacoes` — `tipo`, `canal`, `observacao`, `resultado`, `contato_id`, `criado_por`
- `view_relacionamento_kanban` — agrega contatos com `aba_atual` e `status_relacionamento`

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

---

## Dívida consciente

### Movimentação de kanban: origem não estruturada
`interacoes` do tipo `movimentacao_kanban` gravam o texto `"Movido de X para Y via
drag-and-drop"` em `observacao` (texto livre) e o destino em `resultado`. A origem
não está em campo estruturado. Serve para exibição na timeline, não para métrica de
funil. Estruturar (adicionar coluna `resultado_anterior`) só se nascer demanda real
de analytics de conversão entre colunas.

---

## Fatia 3 — Diagnóstico (read-only, levantado em 2026-05-30)

### Banco

**Tabelas de tags:** nenhuma existe hoje (`tags`, `contato_tags`, `tag`,
`tags_campanha` — todas ausentes). Banco parte do zero para essa feature.

**`view_relacionamento_kanban`:** tem `security_invoker=on`
(`reloptions = ["security_invoker=on"]`). Qualquer view nova do módulo deve espelhar
isso (ver migration `20260522133520_h6b_security_invoker_safe_views.sql`).

**`contatos` (PK e FK target):**
- PK: `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `contato_tags` deve usar `contato_id uuid NOT NULL REFERENCES contatos(id) ON DELETE CASCADE`

### Padrão de RLS (tabelas do módulo)

| Tabela | cmd | roles | qual |
|--------|-----|-------|------|
| contatos | ALL | authenticated | `is_admin()` |
| contatos | SELECT | authenticated | `true` |
| interacoes | ALL | authenticated | `is_admin()` |
| interacoes | INSERT | authenticated | `criado_por = auth.uid() OR criado_por IS NULL` |
| interacoes | SELECT | authenticated | `true` |
| vendas | ALL | authenticated | `is_admin()` |
| vendas | SELECT | authenticated | `true` |

**Padrão para `contato_tags`:** espelhar `interacoes`:
- SELECT: `authenticated`, `qual = true`
- ALL (INSERT/UPDATE/DELETE): `authenticated`, `qual = is_admin()`
- (Sem INSERT especial pois não há campo `criado_por` previsto em tags)

### Convenção de migrations
Pasta: `supabase/migrations/`
Formato: `YYYYMMDDHHMMSS_descricao_snake_case.sql`
Última: `20260523090000_rpt_ltv_add_status_atividade.sql`
Próxima (Fatia 3a): algo como `20260530HHMMSS_relacionamento_tags_campanha.sql`

### Referências a tags no código existente
- `TimelineSideSheet.tsx`: importa ícone `Tag` (lucide-react) e tem entrada em
  `TIPO_CONFIG` para `tipo = 'tag'` — ícone azul, sem lógica de dados. Placeholder
  visual já existe; a lógica de dados (tabela + insert + render real) é a Fatia 3.
- Nenhum outro arquivo renderiza ou consulta tags.

### Pré-requisitos para Fatia 3a
1. Migration: criar `tags` (id, nome, cor, criado_em) + `contato_tags`
   (contato_id FK, tag_id FK, criado_em) — decidir se `tags` é lookup global ou
   free-form por contato.
2. RLS conforme padrão acima.
3. `npx supabase gen types typescript --local` para atualizar `database.ts`.
4. Só então partir para Fatia 3b (UI).
