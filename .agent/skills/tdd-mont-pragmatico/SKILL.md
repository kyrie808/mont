---
name: tdd-mont-pragmatico
description: TDD practices for Mont project. TRIGGER every time you write, modify, or run tests. Integration tests run against PRODUCTION authenticated as a dedicated test account (teste@teste.com); cleanup is scoped by created_by. Do NOT suggest Docker, service_role, __TEST__ prefixes, or CI — deliberate project decisions.
allowed-tools: Read, Write, Bash, Grep
---

# TDD Pragmático — Mont

## Quando usar

**Toda vez** que você for escrever, modificar ou rodar testes neste projeto. Sem exceção.

## Princípio fundamental

Testes de integração rodam contra **Supabase de produção**, autenticados como uma **conta-teste dedicada** (`teste@teste.com`, uid `627bc83a-8e02-4949-ab6b-7efae29c4ac5`). Decisão consciente: sem Docker, sem CI. A segurança vem do **escopo por `created_by`**, não de isolamento de ambiente.

**NÃO sugerir / NÃO usar:**
- Docker / `supabase start` local como "ambiente isolado".
- `service_role` nos testes (bypassa o `auth.uid()` → `created_by` fica nulo → o cleanup-por-conta para de funcionar). **Sempre logar como a conta-teste.**
- Mock total do Supabase client em testes de integração.
- CI automático (GitHub Actions, Vercel hooks).
- Prefixos `__TEST__` / marcadores permanentes / preflight / global-teardown — **arquitetura ANTIGA, abolida** (06/06/2026). Não recriar.

## Como funciona (modelo conta-teste)

O trigger `handle_audit_fields` carimba `created_by = auth.uid()` em todo insert. Como os testes logam como a conta-teste, **tudo que eles criam fica marcado com o uid dela**. O cleanup deleta SOMENTE esse `created_by` (e os filhos ancorados nesses pais). Dado de qualquer outra conta (ex. `adm@distribuidora.com.br`, uid `e9cbd39c-...`) é **estruturalmente intocável**.

**Garantia de segurança:** `cleanTestData` tem um GUARD — aborta com erro se a sessão não for a conta-teste. É impossível apagar dado real por acidente.

## Harness (`@mont/shared/test-utils`)

```typescript
import { createTestClient, cleanTestData, TEST_USER_ID } from '@mont/shared/test-utils'

let supabase: Awaited<ReturnType<typeof createTestClient>>

beforeAll(async () => {
  supabase = await createTestClient()   // anon + signIn como conta-teste; valida uid
})

afterEach(async () => {
  await cleanTestData(supabase)          // deleta só o created_by da conta-teste
})
```

- `createTestClient()` — **async**. Cria client anon, loga como a conta-teste, valida que `auth.uid() === TEST_USER_ID`. Aponta pra produção via env.
- `cleanTestData(client)` — guard + deletes escopados em ordem FK. Cobre o grafo vendas/checkout/compras/contas-a-pagar.

**Cobertura do cleanup** (não precisa prefixar nada — o `created_by` é automático):
- **6 tabelas com `created_by`** (delete direto): `contas`, `contatos`, `vendas`, `lancamentos`, `contas_a_pagar`, `pagamentos_conta_a_pagar`.
- **Filhas sem `created_by`** (ancoradas no pai): `itens_venda`/`pagamentos_venda` (via `vendas`), `cat_pedidos`/`cat_itens_pedido` (via `contatos`), `purchase_orders`/itens/payments (via `contatos`).

## Credenciais

Em `apps/interno/.env.local` (gitignored), nunca no git:
```
VITE_TEST_USER_EMAIL=teste@teste.com
VITE_TEST_USER_PASSWORD=...
```

## Padrão de teste

Cada teste **cria seus próprios dados** logado como a conta-teste (contato, conta, venda…) — todos ganham `created_by` da conta-teste automaticamente — faz as asserções, e o `afterEach` chama `cleanTestData`. Não reusar dados de outras contas; não há mais marcadores permanentes.

```typescript
async function criarContato(nome = 'Cliente Teste') {
  const { data, error } = await supabase
    .from('contatos')
    .insert({ nome, telefone: '11955550000', tipo: 'B2C', status: 'cliente', origem: 'direto' })
    .select('id').single()
  if (error) throw error
  return data
}
```

## Janela de execução

- ✅ Execução manual: `pnpm --filter interno test`.
- ❌ NUNCA em CI automático.
- ❌ NUNCA enquanto o Gilmar está logado e usando o sistema (asserções podem ler dado mudando ao vivo — agora não há risco de PERDA de dado, mas há de teste flaky).
- Janela ideal: madrugada ou final de semana.
- `fileParallelism: false` no vitest.config — obrigatório (banco compartilhado).

## Camada unit/component (jsdom, sem banco)

Testes de função pura e de componente (`*.spec.ts`, `*.test.tsx`) NÃO usam o harness, NÃO tocam o banco (mockam ou são puros). Rodam sempre, seguros. Ex.: `PaymentSidebar.test.tsx` (regressão de race condition), `mappers.spec.ts`. Mantê-los.

## Política de regressão

Para todo bug crítico em produção:
1. **Escrever teste que reproduz o bug (vai FALHAR)** — antes do fix.
2. Implementar o fix.
3. Verificar que o teste passa.
4. Commit único contendo teste + fix.

## O que NÃO fazer

- ❌ Docker / `supabase start` como alternativa.
- ❌ `service_role` em teste de integração (quebra o `created_by`).
- ❌ Mockar Supabase client em teste de integração.
- ❌ Commitar teste sem `afterEach(cleanTestData)`.
- ❌ Rodar em CI automático.
- ❌ Recriar prefixos `__TEST__` / marcadores permanentes (arquitetura abolida).
- ❌ Inserir contas de CLIENTE em `admin_users` (a conta-teste é exceção interna autorizada; clientes, nunca — ver o gate da área do cliente).
- ❌ `as any` em código de teste (mesma regra do código de produção).
