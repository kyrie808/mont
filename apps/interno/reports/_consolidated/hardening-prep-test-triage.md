# Pré-Hardening — Triagem dos Integration Tests

**Data:** 2026-05-19  
**Contexto:** 37 integration tests falhando (38 originais − 1 deletado em L-1).  
**Causa raiz da falha:** Docker não está rodando / `npx supabase start` não foi executado.  
Os testes apontam para `localhost:54321` (hardcoded em `test-utils.ts`) — **não** para produção.

---

## Resultado: todos são (C) — Configure ambiente Docker

| Arquivo | Teste | Classificação | Motivo |
|---|---|---|---|
| `checkout.integration.test.ts` | RPC criar_pedido cria pedido com valores corretos em reais | **(C)** | Testa fluxo crítico de checkout — verifica cat_itens_pedido + valores em reais |
| `checkout.integration.test.ts` | calcula subtotal = soma(preco * quantidade) | **(C)** | Lógica pura, mas fica no mesmo arquivo que usa `beforeAll` com DB — passa automaticamente quando Docker sobe. Extrair para unit test em L.2 |
| `checkout.integration.test.ts` | formatCurrency exibe valores monetários corretamente | **(C)** | Mesma situação — lógica pura em arquivo integration. Extrair em L.2 |
| `checkout.integration.test.ts` | total com frete = subtotal + frete | **(C)** | Mesma situação — lógica pura em arquivo integration. Extrair em L.2 |
| `financeiro.integration.test.ts` | vendas brinde não aparecem no total a receber | **(C)** | Testa RPC `rpc_total_a_receber_dashboard` — crítico para KPI Dashboard |
| `financeiro.integration.test.ts` | atualiza valor_pago e status corretamente | **(C)** | Testa `registrar_pagamento_venda` + trigger pago=true — crítico, coberto por H-7 |
| `financeiro.integration.test.ts` | registrar_pagamento_venda cria lançamento no fluxo de caixa | **(C)** | Verifica criação de lançamento — crítico para integridade financeira |
| `sync.integration.test.ts` | RPC criar_pedido cria cat_pedidos + venda + itens_venda | **(C)** | Testa sync bidirecional completo — essencial antes de guards de Hardening |
| `sync.integration.test.ts` | trigger cria venda quando cat_pedido muda para entregue | **(C)** | Testa trigger `fn_sync_cat_pedido_to_venda` — crítico |
| `sync.integration.test.ts` | sync venda status → cat_pedidos via trigger | **(C)** | Testa trigger `fn_sync_venda_to_cat_pedido` — crítico |
| `vendas.integration.test.ts` | cria venda com itens e calcula total corretamente | **(C)** | INSERT direto em vendas + itens_venda — baseline de regressão |
| `vendas.integration.test.ts` | registra pagamento parcial e completo corretamente | **(C)** | Testa `registrar_pagamento_venda` end-to-end — crítico para H-4 |
| `vendas.integration.test.ts` | calcula margem de lucro corretamente | **(C)** | Verifica custo_total em vendas — baseline de regressão |
| `relacionamento-prioridade.integration.test.ts` | cliente sem fiado e sem inatividade fica em recompra | **(C)** | Testa `view_relacionamento_kanban` — view ainda ativa no DB (UI parked, view não) |
| `relacionamento-prioridade.integration.test.ts` | cliente com fiado em aberto cai em cobranca | **(C)** | Mesma view — lógica de prioridade cobrança |
| `relacionamento-prioridade.integration.test.ts` | com fiado em aberto + inatividade simultanea, cobranca tem prioridade | **(C)** | Regra crítica de negócio — cobrança > reativação |
| `relacionamento-prioridade.integration.test.ts` | cliente antigo sem fiado e sem venda recente cai em reativacao | **(C)** | Regra de reativação — baseline antes de qualquer migration em contatos |
| `criar_pedido.integration.test.ts` | cria contato novo com nome capitalizado e grava cat_pedidos.nome_cliente capitalizado | **(C)** | Testa `fn_capitalize_name` via `criar_pedido` — critica para nome do contato |
| `criar_pedido.integration.test.ts` | atualiza nome de contato existente quando novo nome tem mais palavras | **(C)** | Regra `fn_count_words` em ação — previne regressão de nome |
| `criar_pedido.integration.test.ts` | preserva nome quando contato atual tem mais palavras e novo nome tem menos | **(C)** | Edge case de contagem de palavras |
| `criar_pedido.integration.test.ts` | preserva nome quando quantidade de palavras eh igual | **(C)** | Edge case: empate → mantém nome existente |
| `name_helpers.integration.test.ts` | fn_count_words retorna 0 para null | **(C)** | RPC `fn_count_words` — helper de nome crítico para `criar_pedido` |
| `name_helpers.integration.test.ts` | fn_count_words retorna 0 para string vazia | **(C)** | Edge case |
| `name_helpers.integration.test.ts` | fn_count_words retorna 0 para apenas espacos | **(C)** | Edge case |
| `name_helpers.integration.test.ts` | fn_count_words retorna 1 para nome simples | **(C)** | Happy path |
| `name_helpers.integration.test.ts` | fn_count_words retorna 2 para duas palavras | **(C)** | Happy path |
| `name_helpers.integration.test.ts` | fn_count_words normaliza espacos e conta corretamente | **(C)** | Edge case de normalização |
| `name_helpers.integration.test.ts` | fn_count_words retorna 4 para nome completo | **(C)** | Happy path |
| `name_helpers.integration.test.ts` | fn_capitalize_name retorna null para null | **(C)** | RPC `fn_capitalize_name` — edge case null |
| `name_helpers.integration.test.ts` | fn_capitalize_name retorna vazio para string vazia | **(C)** | Edge case |
| `name_helpers.integration.test.ts` | fn_capitalize_name capitaliza nome completo com preposicao | **(C)** | Happy path com preposição |
| `name_helpers.integration.test.ts` | fn_capitalize_name mantem preposicao interna em minusculo | **(C)** | Lógica de capitalização PT-BR |
| `name_helpers.integration.test.ts` | fn_capitalize_name mantem dos em minusculo | **(C)** | Edge case PT-BR |
| `name_helpers.integration.test.ts` | fn_capitalize_name mantem e em minusculo quando interno | **(C)** | Edge case PT-BR |
| `name_helpers.integration.test.ts` | fn_capitalize_name garante primeira palavra em maiusculo mesmo sendo preposicao | **(C)** | Edge case posição inicial |
| `name_helpers.integration.test.ts` | fn_capitalize_name mantem uma palavra de forma idempotente | **(C)** | Idempotência |
| `name_helpers.integration.test.ts` | fn_capitalize_name normaliza espacos em excesso | **(C)** | Edge case whitespace |

---

## Por que não (M) nem (S)?

**Não (M) — Mock:**  
CLAUDE.md e TESTING.md são explícitos: os testes usam Supabase client real contra banco local Docker. A decisão foi tomada conscientemente — mocks mascararam regressão de migration em ciclo anterior. Nenhum teste neste inventário deve ser convertido para mock.

**Não (S) — Skip:**  
Todos os 37 testes cobrem fluxos que serão **diretamente modificados pela Onda Hardening** (guards nas RPCs financeiras, policy de contatos, views SECDEF). Skippar = cegar o detector de regressão exatamente quando mais precisamos dele.

A única exceção lógica seriam os 3 testes de lógica pura em `checkout.integration.test.ts` (subtotal, formatCurrency, total+frete) — mas eles passam automaticamente quando Docker sobe. Extração para unit test é L.2, não pré-Hardening.

---

## Como habilitar (C) — passos concretos

```bash
# Pré-requisito: Docker Desktop rodando

# 1. Iniciar Supabase local (aplica migrations + seed automaticamente)
npx supabase start

# 2. Rodar a suíte completa
pnpm --filter interno test
# ou
pnpm turbo test

# 3. Parar ao terminar
npx supabase stop
```

**Credenciais:** hardcoded em `packages/shared/src/test-utils.ts` — são os JWTs públicos padrão do Docker Supabase (`127.0.0.1:54321`). Não são secrets de produção.

---

## Impacto para a Onda Hardening

Os integration tests são o único detector de regressão disponível para:
- H-3/H-4: REVOKE + guards nas 6 RPCs financeiras → `financeiro`, `vendas`, `sync` devem continuar passando após os guards
- H-5: Policy contatos → `relacionamento-prioridade`, `criar_pedido` verificam comportamento de contatos
- H-6: Views SECDEF → `sync`, `checkout` verificam se views continuam servindo dados após `security_invoker=on`

**Recomendação:** Subir Docker + `npx supabase start` antes de iniciar qualquer migration da Onda Hardening. Rodar suite completa como baseline, aplicar migration, rodar novamente.
