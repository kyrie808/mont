---
name: tdd-mont-pragmatico
description: TDD practices for Mont project. TRIGGER every time you write, modify, or run tests. Covers __TEST__ namespacing, production Supabase usage, cleanup patterns, and regression policy. Do NOT suggest Docker/isolation as alternative — this is a deliberate project decision.
allowed-tools: Read, Write, Bash, Grep
---

# TDD Pragmático — Mont

## Quando usar

**Toda vez** que você for escrever, modificar ou rodar testes neste projeto. Sem exceção.

## Princípio fundamental

Testes rodam contra **Supabase de produção**. Trade-off consciente: economia de tokens + zero overhead de Docker supera o risco em projeto solo com janela de execução controlada.

**NÃO sugerir:**
- Docker / `supabase start` local como "ambiente isolado"
- Mock total do Supabase client em testes de integração
- CI automático (GitHub Actions, Vercel hooks)

Isso não é gambiarra a ser corrigida — foi decisão deliberada do Luccas.

## Namespacing `__TEST__`

Todo dado criado por teste **DEVE** ter prefixo `__TEST__` em campo identificável da tabela:

| Tabela | Campo a prefixar |
|--------|-----------------|
| `contatos` | `nome` |
| `contas` | `nome` |
| `vendas`, `lancamentos`, `pagamentos_venda` | `observacoes` |
| `produtos` | `codigo` |

### Marcadores permanentes (NÃO criar novos — reusar os existentes)

```
__TEST__Cliente → contatos.id = '63040302-54d5-4213-8b11-9e208e45174b'
__TEST__Conta   → contas.id   = 'd1485f56-e8f5-4a3e-84bb-cb104ba7a695' (ativo=false)
```

Testes que precisam de um contato referenciado: usar `__TEST__Cliente`.
Testes que precisam de conta de destino para pagamento: usar `__TEST__Conta`.

Vendas/lançamentos criados pelo teste: prefixar `observacoes` com `__TEST__<nome_da_suite>__` para rastreabilidade.

## Pré-flight check

Antes de qualquer test run, validar que os marcadores existem:

```typescript
// apps/interno/src/__tests__/setup.ts
async function preflightCheck() {
  const { data: cliente } = await supabase
    .from('contatos')
    .select('id')
    .eq('id', '63040302-54d5-4213-8b11-9e208e45174b')
    .single()

  const { data: conta } = await supabase
    .from('contas')
    .select('id, ativo')
    .eq('id', 'd1485f56-e8f5-4a3e-84bb-cb104ba7a695')
    .single()

  if (!cliente || !conta) {
    throw new Error('__TEST__ markers missing in production. Aborting test run. Re-seed via migration before retrying.')
  }
}
```

## Cleanup por suite

Cada suite mantém array de `createdIds` e limpa em `afterEach` na ordem FK correta:

```
lancamentos → pagamentos_venda → itens_venda → vendas → cat_itens_pedido → cat_pedidos → contatos (extras) → contas (extras)
```

**NÃO deletar** os marcadores permanentes nos cleanups.

```typescript
afterEach(async () => {
  await supabase.from('lancamentos').delete().in('id', createdLancamentoIds)
  await supabase.from('pagamentos_venda').delete().in('id', createdPagamentoIds)
  await supabase.from('itens_venda').delete().in('id', createdItemIds)
  await supabase.from('vendas').delete().in('id', createdVendaIds)
  await supabase.from('cat_itens_pedido').delete().in('id', createdCatItemIds)
  await supabase.from('cat_pedidos').delete().in('id', createdCatPedidoIds)
  // NUNCA incluir '63040302-54d5-4213-8b11-9e208e45174b' nem 'd1485f56-e8f5-4a3e-84bb-cb104ba7a695'
  await supabase.from('contatos').delete().in('id', createdContatoIds)
  await supabase.from('contas').delete().in('id', createdContaIds)
  // Reset arrays
  createdLancamentoIds = []
  createdPagamentoIds = []
  createdItemIds = []
  createdVendaIds = []
  createdCatItemIds = []
  createdCatPedidoIds = []
  createdContatoIds = []
  createdContaIds = []
})
```

## Safety net global

`globalTeardown` roda ao final independente de passes/falhas — captura qualquer vazamento de cleanup específico:

```typescript
// apps/interno/src/__tests__/global-teardown.ts
const MARKER_IDS = [
  '63040302-54d5-4213-8b11-9e208e45174b',  // __TEST__Cliente
  'd1485f56-e8f5-4a3e-84bb-cb104ba7a695',  // __TEST__Conta
]

export default async function teardown() {
  await supabase.from('lancamentos').delete().like('observacoes', '__TEST__%')
  await supabase.from('pagamentos_venda').delete().like('observacoes', '__TEST__%')
  await supabase.from('vendas').delete().like('observacoes', '__TEST__%')
  await supabase
    .from('contatos')
    .delete()
    .like('nome', '__TEST__%')
    .not('id', 'in', `(${MARKER_IDS.map(id => `'${id}'`).join(',')})`)
  await supabase
    .from('contas')
    .delete()
    .like('nome', '__TEST__%')
    .not('id', 'in', `(${MARKER_IDS.map(id => `'${id}'`).join(',')})`)
}
```

## Janela de execução

- ✅ Execução manual pelo Luccas: `pnpm test:integration` ou `pnpm --filter interno test`
- ❌ NUNCA em CI automático (Vercel, GitHub Actions)
- ❌ NUNCA enquanto o Gilmar está logado e usando o sistema (race condition real com dados sendo manipulados simultaneamente)
- Janela ideal: madrugada ou final de semana

## Stack e estrutura de arquivos

```
apps/interno/src/
├── __tests__/
│   ├── setup.ts                          # preflight check + client compartilhado
│   ├── global-teardown.ts                # safety net pós-suite
│   └── integration/
│       ├── vendas.test.ts
│       ├── financeiro.test.ts
│       └── ...
├── components/
│   └── features/.../
│       └── __tests__/
│           └── *.test.tsx                # testes de componente colocalizados
└── services/
    └── __tests__/
        └── *.spec.ts                     # testes unitários de serviço
```

- Supabase client real (`@supabase/supabase-js`) apontado para produção via env vars
- Mocks SÓ de serviços externos não-Supabase (Evolution API, Cloudflare Tunnel, etc.)
- `fileParallelism: false` no vitest.config — obrigatório para evitar race conditions no banco compartilhado

## Política de regressão

Para todo bug crítico em produção:

1. **Escrever teste que reproduz o bug (vai FALHAR)** — antes do fix
2. Implementar o fix
3. Verificar que o teste passa
4. Commit único contendo teste + fix (nunca separado)

Bugs cobertos até agora:
- `PaymentSidebar` race condition → `apps/interno/src/components/features/vendas/__tests__/PaymentSidebar.test.tsx`

## O que NÃO fazer

- ❌ Sugerir Docker / `supabase start` como alternativa
- ❌ Criar novos `__TEST__Cliente` ou `__TEST__Conta` — os marcadores já existem em produção
- ❌ Mockar Supabase client em testes de integração
- ❌ Commitar testes sem `afterEach` de cleanup completo
- ❌ Rodar testes em CI automático
- ❌ Deletar os marcadores permanentes (`63040302-54d5...` e `d1485f56-e8f5...`)
- ❌ Usar `as any` em código de teste (mesma regra do código de produção)
