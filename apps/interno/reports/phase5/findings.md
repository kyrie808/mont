# Phase 5 — TESTES
# Findings Report
# Data: 2026-05-17
# Scope: apps/interno/ — suíte Vitest (89 passing + 1 failing)
# Seeds: P4-DC04, P3-T05, P1-TEST02, P3-T10

---

## Caminhos críticos definidos

| Categoria | Membros |
|---|---|
| (a) 11 SECDEF RPCs chamáveis por authenticated | criar_pedido, add/delete_image_reference, rpc_total_a_receber_dashboard, registrar_despesa_manual, registrar_entrada_manual, registrar_pagamento_venda, update_purchase_order_with_items (+ 2 parked P3-T05) |
| (b) Forms/sidebars financeiros | NovaVenda, PaymentSidebar (+ CheckoutSidebar/ContaAPagarModal fora do scope ou parked) |
| (c) Auth flow | useAuth + AuthGuard |
| (d) Checkout end-to-end | `criar_pedido` → cat_pedidos + itens_venda + vendas |
| (e) Registro de pagamento | `registrar_pagamento_venda` → lançamento + saldo conta |

---

## Executive Summary

| ID | Severidade | Descrição | Ação |
|---|---|---|---|
| P5-T01 | 🔴 | `registrar_despesa_manual`: zero testes (caminho crítico financeiro) | Criar integration test |
| P5-T02 | 🔴 | `registrar_entrada_manual`: zero testes (caminho crítico financeiro) | Criar integration test |
| P5-T03 | 🔴 | `update_purchase_order_with_items`: zero testes (caminho crítico financeiro) | Criar integration test |
| P5-T08-FIN | 🔴 | 7 entidades financeiras sem Zod e sem critério de validação testado: `purchase_orders`, `lancamentos`, `contas_a_pagar`, `pagamentos_conta_a_pagar`, `plano_de_contas`, `configuracoes`, `produtos` | Critério (ii) DB rejection para as ativas; critério (i) unit para as parked |
| P5-T04 | 🟡 | ZERO role/permission tests em todos os 11 SECDEF RPCs | Criar role tests antes de adicionar guards |
| P5-T05 | 🟡 | `add_image_reference`, `delete_image_reference`: zero testes | Criar testes |
| P5-T06 | 🟡 | `registrar_pagamento_venda`: happy path ✓ mas zero boundary e zero role | Adicionar boundary + role |
| P5-T07 | 🟡 | Schemas Zod (contato, venda, pagamento): zero unit tests | Criar unit tests de schema |
| P5-T08 | 🟡 | ~12 entidades não-financeiras sem Zod: zero dos 3 critérios de validação testada | Priorizar forms com dados de negócio |
| P5-T09 | 🟡 | Teste órfão failing: backfill_contatos_nome chama RPC+tabela dropados | Deletar arquivo (P4-DC04) |
| P5-T10 | 🟡 | vitest sem CI gate: toda regressão de coverage passa silenciosa — cobertura existente sem garantia | Adicionar coverage.thresholds + CI gate |
| P5-T11 | 🟢 | Sem `__fixtures__/`: helpers inline duplicados por arquivo de teste | Extrair para test-helpers.ts |
| P5-T12 | 🟢 | ~20 instâncias de `as any` em spec files | Remediado organicamente com P3-T01/T02 |

**Contagem:** 4 🔴 · 7 🟡 · 2 🟢

---

## Estado atual da suíte

| Tipo | Tests | % |
|---|---|---|
| Integration (Supabase real) | 34 | 38% |
| Unit (pura, sem DB) | 46 | 52% |
| Component (RTL + jsdom) | 9 | 10% |
| **Total passing** | **89** | — |
| Failing (orphan) | ~2 | — |

**P1-TEST02 meta 85→90:** 89 passing vs meta de 90. Deleting P4-DC04 (backfill) + 1 novo teste = meta atingida.

---

## P5-T01 — registrar_despesa_manual: ZERO testes

**Severidade:** 🔴 (caminho crítico financeiro sem nenhum teste)

**Chamada:** `cashFlowService.ts:128-134`
```typescript
await supabase.rpc('registrar_despesa_manual', {
  p_valor, p_descricao, p_data, p_conta_id, p_plano_conta_id
})
```

**Efeitos no DB:**
- INSERT em `lancamentos` (tipo='saida')
- Trigger `update_conta_saldo_lancamento` → UPDATE `contas.saldo_atual`

Zero testes para este caminho. Um bug nesta RPC ou no trigger de saldo não tem detectação automática. Com a data de referência financeira em 01/05/2026, lançamentos incorretos afetam diretamente os KPIs do Dashboard.

**Teste recomendado (integration):**
```typescript
it('registrar_despesa_manual cria lançamento e atualiza saldo', async () => {
  const saldoAntes = await getSaldo(contaId)
  await supabase.rpc('registrar_despesa_manual', {
    p_valor: 50, p_descricao: 'Teste', p_data: hoje, p_conta_id: contaId,
    p_plano_conta_id: planoContaId
  })
  const lancamentos = await getLancamentos(contaId)
  const saldoDepois = await getSaldo(contaId)
  expect(lancamentos[0].tipo).toBe('saida')
  expect(saldoDepois).toBe(saldoAntes - 50)
})
```

---

## P5-T02 — registrar_entrada_manual: ZERO testes

**Severidade:** 🔴 (caminho crítico financeiro sem nenhum teste)

**Chamada:** `cashFlowService.ts:145-151` — mesma estrutura de params que despesa, tipo='entrada'.

Análogo a P5-T01. Afeta `contas.saldo_atual` via trigger. Zero testes.

**Teste recomendado:** Espelho de P5-T01 com `tipo='entrada'` e saldo aumentando.

---

## P5-T03 — update_purchase_order_with_items: ZERO testes

**Severidade:** 🔴 (caminho crítico financeiro sem nenhum teste)

**Chamada:** `purchaseOrderService.ts:89-102`
```typescript
await supabase.rpc('update_purchase_order_with_items', {
  p_order_id, p_fornecedor_id, p_order_date, p_total_amount,
  p_notes, p_status, p_payment_status, p_items  // jsonb array
})
```

**Efeitos no DB:** UPDATE `purchase_orders` + DELETE/INSERT `purchase_order_items` (array jsonb). Mais complexo — a lógica do jsonb no server-side não tem nenhuma cobertura.

`purchaseOrderService.ts` não tem nenhum arquivo de teste (nem spec, nem integration).

---

## P5-T04 — Zero role/permission tests em todos os SECDEF RPCs

**Severidade:** 🟡 (ausência sistêmica de categoria de teste — regressão quando guards forem adicionados)

Nenhum dos 9 RPCs ativos tem teste que:
1. Chame com cliente `anon` e verifique erro de permissão
2. Chame com `authenticated` não-admin e verifique comportamento
3. Verifique que `is_admin()` bloqueia quem não deve ter acesso

**Contexto P3-T05:** As 2 RPCs financeiras de contas-a-pagar estão marcadas para receber `is_admin()` guard antes da reativação. Quando o guard for adicionado, sem role tests o CI não confirma que o guard funciona.

**Risco imediato:** Médio — as RPCs 🔴 financeiras ativas (`registrar_*`, `update_*`) atuam sobre DB com `SECURITY DEFINER` e qualquer `authenticated` pode chamá-las hoje (sem guard). Um role test de anon bloqueado + authenticated com sucesso documentaria o estado atual como linha de base.

---

## P5-T05 — add_image_reference, delete_image_reference: zero testes

**Severidade:** 🟡 (mutações sem cobertura)

Ambas chamadas em `produtoService.ts:160-174`. Afetam `sis_imagens_produto`. Zero testes. Não são financeiras (menor urgência que P5-T01-T03) mas são mutações sem detectação de regressão.

---

## P5-T06 — registrar_pagamento_venda: happy path testado, boundary e role não

**Severidade:** 🟡 (caminho crítico com cobertura parcial)

**Testes existentes (4):**
- `financeiro.integration.ts`: pagamento parcial (60→100) + lançamento criado ✓
- `vendas.integration.ts`: pagamento parcial e total ✓

**Gaps:**
- `p_valor <= 0` — RPC aceita ou rejeita? Trigger de saldo opera?
- `p_conta_id` inexistente — FK violation tratada no RPC ou propaga erro?
- Pagamento que ultrapassa total da venda — pago=true ou comportamento indefinido?
- Role: cliente anon consegue chamar? (resposta esperada: não, mas não testado)

---

## P5-T07 — Schemas Zod sem unit tests

**Severidade:** 🟡 (boundary de validação crítico sem regressão automatizada)

**Schemas sem teste:**

| Schema | Arquivo | Validação não-trivial não testada |
|---|---|---|
| `contatoSchema` | schemas/contato.ts | `refine(isValidPhone)`, `transform(cleanPhone)`, enum tipo |
| `vendaSchema` | schemas/venda.ts | refinamento `fiado→data_obrigatória`, enum forma_pagamento |
| `pagamentoSchema` | schemas/venda.ts | `data` não pode ser futura (UTC-3) |
| `itemVendaSchema` | schemas/venda.ts | validações básicas |
| `contatoFiltrosSchema`, `vendaFiltrosSchema` | schemas/ | N/A (filtros de UI, menor prioridade) |

**Contraste:** `utils/fiado.ts` tem 15 testes de timezone/data. O `pagamentoSchema.data` tem uma refine de timezone comparável mas zero testes.

**Teste recomendado (unit):**
```typescript
it('contatoSchema rejeita telefone inválido', () => {
  expect(() => contatoSchema.parse({ ...base, telefone: '12345' })).toThrow(ZodError)
})
it('vendaSchema rejeita fiado sem data_prevista_pagamento', () => {
  expect(() => vendaSchema.parse({ ...base, forma_pagamento: 'fiado', data_prevista_pagamento: null })).toThrow(ZodError)
})
```

**Reconciliação P3-T10 (2) vs P5-T07 (5):**

P3-T10 conta ao nível de **entidade**: 2 entidades têm algum Zod (`contatos`, `vendas/pagamentos`). P5-T07 conta ao nível de **schema object**: 5 objetos de schema criados dentro dessas 2 entidades:

| Entidade | Schemas |
|---|---|
| `contatos` | `contatoSchema` (write) + `contatoFiltrosSchema` (read) |
| `vendas/pagamentos` | `vendaSchema` + `itemVendaSchema` + `pagamentoSchema` + `vendaFiltrosSchema` (read) |

P5-T07 agrupa os 2 filtros como "1 grupo" → conta 5 (4 write schemas + 1 filtros group). Não há discrepância: P3-T10 = perspectiva de entidade, P5-T07 = perspectiva de schema object. P3-T10 permanece correto como "2 de 21 entidades".

---

## P5-T08-FINANCEIRO — Entidades financeiras sem validação testada

**Severidade:** 🔴 (entidades de caminho crítico financeiro sem qualquer teste de validação)

Das 19 entidades do P3-T10, as 7 abaixo são financeiras/críticas e não atingem nenhum dos 3 critérios:

| Entidade | Status | Risco |
|---|---|---|
| `purchase_orders` | Ativa (PurchaseOrderForm.tsx) | Valores financeiros, p_items jsonb — sem rejeição testada |
| `lancamentos` | Server-managed via RPC/trigger | Afeta saldo de contas — apenas happy path testado |
| `contas_a_pagar` | _parked (P4-DC01), DB ativo | Tabela live em produção — zero testes |
| `pagamentos_conta_a_pagar` | _parked (P3-T05), DB ativo | Tabela live em produção — zero testes |
| `plano_de_contas` | _parked, DB ativo | Tabela live em produção — zero testes |
| `configuracoes` | Ativa (Configuracoes.tsx) | `recompra_dias`, `recompra_limite` afetam engine de negócio |
| `produtos` | Ativo (Produtos.tsx) — preco, custo | Fronteira financeira indireta: preco/custo errado contamina toda venda subsequente |

**Nota para entidades _parked/:** As tabelas `contas_a_pagar`, `pagamentos_conta_a_pagar`, `plano_de_contas` são live em produção (P4-DC01). Quando a feature for reativada (P3-T05), zero testes de validação existirão para cobrir a reativação.

**Ação por critério:**
- `purchase_orders`, `configuracoes`, `produtos` (ativos): critério (ii) — integration test de DB rejection (`preco < 0`, `recompra_dias = null`)
- `lancamentos` (server-managed): critério (ii) — RPC com valor negativo ou conta inexistente
- Entidades _parked/: critério (i) — unit test de validação inline antes da reativação

---

## P5-T08 — ~13 entidades não-financeiras sem Zod: zero critérios de validação testada

**Severidade:** 🟡 (sem validação testada — menor risco que P5-T08-FINANCEIRO)

As 7 entidades financeiras foram separadas em P5-T08-FINANCEIRO (🔴). As ~12 restantes das 19 do P3-T10 seguem sem atingir nenhum dos 3 critérios de validação testada:

| Entidade | Form ativo? | Critério (i) | Critério (ii) | Critério (iii) |
|---|---|---|---|---|
| `contatos.endereço` (campos opcionais) | Sim | ❌ | ❌ | ❌ |
| `interacoes` | N/A (insert inline) | ❌ | ❌ | ❌ |
| `cat_pedidos` | N/A (via RPC) | ❌ | happy path only | ❌ |
| `vendas` (campos server-managed) | N/A | ❌ | ❌ | ❌ |
| `itens_venda` | via NovaVenda | ❌ | happy path only | ❌ |
| `pagamentos_venda` | via PaymentSidebar | ❌ | happy path only | ❌ |
| `purchase_order_items` | via PurchaseOrderForm | ❌ | ❌ | ❌ |
| `purchase_order_payments` | Sim | ❌ | ❌ | ❌ |

**Nota:** Entidades server-managed (`cat_pedidos`, `itens_venda`, `pagamentos_venda`) têm happy path nos integration tests, mas o critério (ii) exige prova de REJEIÇÃO — nenhum teste verifica o comportamento quando o input inválido chega ao DB.

---

## P5-T09 — Teste órfão failing: backfill_contatos_nome

**Severidade:** 🟡 (seed P4-DC04 — já documentado)

**Arquivo:** `tests/integration/backfill_contatos_nome.integration.test.ts`

Chama `supabase.rpc('fn_backfill_contatos_nome')` e queries `backfill_contatos_nome_log` — ambos DROPADOS na migration `20260515070100` (Phase 2).

**Ação:** `git rm tests/integration/backfill_contatos_nome.integration.test.ts`

Após remoção: 89 passing → meta P1-TEST02 de 90 exige +1 novo teste.

---

## P5-T10 — vitest sem CI gate: regressão passa silenciosa

**Severidade:** 🟡 (padrão P4-DC02 — falha invisível; cobertura existente sem garantia de estabilidade)

`vite.config.ts` bloco `test:` não contém bloco `coverage` e não há GitHub Actions workflow. Sem CI gate, toda regressão de cobertura passa silenciosa — nenhum PR é bloqueado quando testes são removidos, quebrados, ou quando cobertura cai. A suíte existente (89 testes) não tem garantia de estabilidade: um PR pode remover testes sem nenhum sinal automático.

**Paralelo a P4-DC02:** AlertasRecompraWidget navega para `/relacionamento` que retorna null — usuário recebe silêncio em vez de erro. Aqui, PR que quebra testes recebe merge em vez de bloqueio.

Consequências:
- `pnpm test --coverage` não roda sem instalar `@vitest/coverage-v8` ou `c8`
- Sem threshold → CI não bloqueia PRs que reduzem cobertura
- Sem reporter → não há relatório de cobertura no build
- Sem workflow → todo o pipeline de testes é manual

**Configuração recomendada:**
```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    thresholds: {
      statements: 60,
      branches: 55,
      functions: 60,
      lines: 60,
    },
    exclude: ['_parked/**', '**/*.test.{ts,tsx}', '**/index.ts', 'src/test/**']
  }
}
```

---

## P5-T11 — Sem __fixtures__/: helpers inline duplicados

**Severidade:** 🟢 (oportunidade de melhoria, sem impacto funcional)

`criarContato(nome)` existe em 3 arquivos de integration test diferentes (com assinaturas e defaults levemente diferentes). Idem para `criarVenda`.

**Risco:** Inconsistências sutis entre arquivos (ex.: `finanseiro.integration` cria contatos com `telefone: '11955550000'`, `vendas.integration` com `'11999990000'`). Se `cleanTestData` não cobrir todos os prefixos, dados podem vazar entre suítes.

**Ação:** Extrair `criarContato`, `criarVenda`, `buscarSaldo` para `tests/__fixtures__/helpers.ts` e importar uniformemente.

---

## P5-T12 — as any em arquivos de teste

**Severidade:** 🟢 (violação da regra CLAUDE.md em test code, removida organicamente)

~20 instâncias de `as unknown as any` nos spec files, causadas pelos mesmos tipos `HomeFinanceiroRow = any` e `PurchaseOrderRow = any` que P3-T01/T02 documentam.

Quando P3-T01/T02 forem corrigidos:
- `cashFlowService.spec.ts` poderá usar `VendaAlerta` tipado
- `dashboardService.spec.ts` poderá usar `Tables<'view_home_financeiro'>` 
- `mappers.spec.ts` poderá usar `PurchaseOrderRow` tipado

Não é ação independente — é consequência automática das correções de Phase 3.

---

## Bônus — Delta de testes entre CLAUDE.md "85" e Phase 5 "89"

**Δ = +4 testes net, com furo de 3 não-reconciliados na decomposição por tipo.**

O CLAUDE.md registrava "85 tests passing, 15 files (38 integration, 43 unit, 4 component)".

**Eventos identificados:**

| Evento | Commit | Impacto |
|---|---|---|
| `PaymentSidebar.test.tsx` adicionado | `50a494f` (2026-05-15) | +5 component tests |
| Migration `20260515070100` dropa `fn_backfill_contatos_nome` | aplicada em `663492dd` (2026-05-09) | backfill (4 testes) vai de passing → failing |

Esses dois eventos explicam: **+5 component − 4 integration = +1 net**. Mas o delta real é +4.

**Breakdown do delta por tipo:**

| Tipo | CLAUDE.md "85" | Phase 5 "89" | Δ | Explicado? |
|---|---|---|---|---|
| Integration | 38 (incl. backfill ×4 passing) | 34 (backfill ×4 failing) | **-4** | ✅ backfill drop |
| Unit | 43 | 46 | **+3** | ❌ furo |
| Component | 4 | 9 | **+5** | ✅ PaymentSidebar |
| **Total passing** | **85** | **89** | **+4** | — |

**Os +3 unit não-reconciliados:** O checkout.integration.test.ts (adicionado em `2bf461e`, 2026-04-05) já continha os 3 testes de cálculo de carrinho quando CLAUDE.md foi escrito. O spec files (cashFlowService, mappers, dashboardService) existem desde `6abfc2e` (2026-04-01). A reclassificação integration→unit do checkout não explica o furo: se checkout tivesse sido contado como 4 integration em CLAUDE.md, o delta de integration seria −7 (não −4). Hipótese mais provável: a contagem "43 unit" no CLAUDE.md foi capturada em snapshot anterior ao estado atual das spec files — possivelmente com algum spec file tendo menos testes na época. **Δ = 3 testes sem trilha de git identificável.**

---

## Log files desta fase

| Arquivo | Conteúdo |
|---|---|
| `suite.log` | Ângulo A: inventário completo, breakdown por tipo, flags de qualidade |
| `rpcs.log` | Ângulo B: cobertura dos 11 SECDEF RPCs + caminhos críticos (a)(c)(d)(e) |
| `services.log` | Ângulo C: cobertura por service (9 em src/) |
| `validation.log` | Ângulo D: Zod schemas + P3-T10 (19 entidades) |
| `quality.log` | Ângulo E: vitest config, fixtures, as any, flaky |
