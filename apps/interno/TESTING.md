# Testing — apps/interno

## Resumo da suíte

| Métrica | Valor |
|---|---|
| Arquivos de teste | 15 |
| Total de testes | 85 |
| Duração (suíte completa) | ~25s |
| Duração (camada sem Docker) | ~13s |

**Distribuição por tipo:**

| Tipo | Arquivos | Testes | Requer Docker |
|---|---|---|---|
| Integration (Supabase) | 8 | 38 | Sim |
| Unit (puro) | 5 | 43 | Não |
| Component (jsdom + Testing Library) | 2 | 4 | Não |

---

## Pré-requisitos

Para a suíte completa (integration tests incluídos):

1. **Docker Desktop** rodando
2. **Supabase local iniciado** (aplica as migrations e o seed automaticamente):
   ```bash
   pnpm exec supabase start
   ```
3. **Nenhuma env var** — as credenciais do Supabase local estão hardcoded em `packages/shared/src/test-utils.ts`. São os JWTs públicos padrão que todo projeto Supabase local usa (`eyJhbGci...` — anon e service_role). Não são secrets.

Para a camada unit + component: nenhum pré-requisito.

---

## Comandos

```bash
# Suíte completa (requer Docker + supabase start)
pnpm --filter interno test

# Apenas unit + component (sem Docker)
pnpm --filter interno exec vitest run src/utils src/components src/services/__tests__

# Um arquivo específico
pnpm --filter interno exec vitest run src/utils/fiado.test.ts
```

---

## Inventário de arquivos

### Integration — requerem Supabase local (`127.0.0.1:54321`)

| Arquivo | Testes | O que cobre |
|---|---|---|
| `src/__tests__/checkout.integration.test.ts` | 4 | RPC `criar_pedido`, cálculos do carrinho |
| `src/__tests__/financeiro.integration.test.ts` | 3 | Brindes, pagamento parcial, lançamentos |
| `src/__tests__/relacionamento-prioridade.integration.test.ts` | 4 | View `view_relacionamento_kanban`, regras de prioridade |
| `src/__tests__/sync.integration.test.ts` | 3 | Sync bidirecional `cat_pedidos ↔ vendas` |
| `src/__tests__/vendas.integration.test.ts` | 3 | Criação de venda, pagamentos, margem |
| `tests/integration/backfill_contatos_nome.integration.test.ts` | 1 | `fn_backfill_contatos_nome`, snapshot |
| `tests/integration/criar_pedido.integration.test.ts` | 4 | Enriquecimento de nome no `criar_pedido` |
| `tests/integration/name_helpers.integration.test.ts` | 16 | `fn_count_words`, `fn_capitalize_name` |

### Unit — sem dependências externas

| Arquivo | Testes | O que cobre |
|---|---|---|
| `src/utils/fiado.test.ts` | 15 | `getFiadoStatus` — todos os estados de fiado |
| `src/utils/vendaBadge.test.ts` | 11 | `getVendaBadgeStatus` — delegação para fiado, brinde, pix |
| `src/services/__tests__/mappers.spec.ts` | 8 | Mappers de domínio (`toDomainVenda`, `toDomainContato`, etc.) |
| `src/services/__tests__/cashFlowService.spec.ts` | 5 | `processAlertasFinanceiros` |
| `src/services/__tests__/dashboardService.spec.ts` | 4 | `mapDashboardMetrics` |

### Component — jsdom + Testing Library

| Arquivo | Testes | O que cobre |
|---|---|---|
| `src/components/features/vendas/VendaCard.test.tsx` | 2 | Badge de pagamento no `VendaCard` |
| `src/components/features/contatos/detalhe/VendasHistory.test.tsx` | 2 | Badge de pagamento no `VendasHistory` |

---

## Pattern dos integration tests

```ts
// 1. Client aponta para localhost:54321 (hardcoded em test-utils)
const supabase = createTestServiceClient()  // service_role — bypassa RLS

// 2. beforeAll carrega seed quando o teste precisa de produtos/contatos existentes
beforeAll(async () => {
    const { data: produtos } = await supabase.from('produtos').select(...)
    expect(produtos).toHaveLength(2)
})

// 3. Cleanup após cada teste e ao final do arquivo
afterEach(async () => { await cleanTestData(supabase) })
afterAll(async () => { await cleanTestData(supabase) })

// 4. Testes chamam RPC ou tabelas diretamente
it('...', async () => {
    const { data, error } = await supabase.rpc('criar_pedido', { ... })
    expect(error).toBeNull()
})
```

**`cleanTestData` respeita a ordem das FKs:**
```
lancamentos → pagamentos_venda → itens_venda
→ purchase_order_payments → purchase_order_items → purchase_orders
→ pagamentos_conta_a_pagar → contas_a_pagar
→ cat_itens_pedido → cat_pedidos_pendentes_vinculacao
→ vendas → cat_pedidos → contatos
```
`produtos` e `contas` **não são limpos** — são seed data preservados entre testes.

**`fileParallelism: false`** no `vite.config.ts` — desabilitado intencionalmente porque todos os integration tests compartilham o mesmo banco local.

---

## Política do projeto

- **Nenhum teste novo** será adicionado até o brownfield analysis informar prioridades.
- **TDD ad-hoc** autorizado somente para correção de bugs identificados pelo brownfield: red (reproduz o bug) → green (correção mínima) → refactor.
- **Não escrever testes para aumentar cobertura** sem direcionamento explícito do projeto.

---

## Achados laterais — a tratar em sessão futura

Registrados aqui para não perder. Nenhum bloqueia a suíte atual.

1. **`environment: 'jsdom'` para todos os testes** — o config atual aplica jsdom globalmente, inclusive nos integration tests que fazem HTTP com Supabase. Funciona porque jsdom não bloqueia `fetch`, mas o ambiente canônico para integration tests seria `node`. Separar via [Vitest project config](https://vitest.dev/guide/workspace) exigiria revisar quais testes dependem de globals do jsdom.

2. **Duas pastas de integration tests** — `src/__tests__/` e `tests/integration/` coexistem sem separação formal. Funcional, mas inconsistente. Unificar quando a estrutura for reorganizada.

3. **`.env.example` legacy** — `apps/interno/.env.example` é artefato de outro projeto (AIOS). Não é usado pelos testes do Mont. Pode ser removido.
