import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database'

/**
 * Harness de testes do Mont — arquitetura ÚNICA e segura (ver memory test-layer-mont).
 *
 * Princípio: os testes rodam contra PRODUÇÃO autenticados como uma CONTA-TESTE dedicada
 * (`teste@teste.com`). O trigger `handle_audit_fields` carimba `created_by = auth.uid()`
 * em tudo que ela cria; o cleanup deleta SOMENTE o que tem esse `created_by` (e os filhos
 * ancorados nesses pais). Dado de qualquer outra conta (ex. adm@distribuidora.com.br) é
 * estruturalmente intocável.
 *
 * NÃO usar service_role aqui: com service_role o `auth.uid()` é nulo, `created_by` não é
 * carimbado, e o cleanup-por-conta deixa de funcionar. O login é obrigatório.
 */

/** uid fixo da conta-teste — serve de GUARD: cleanup só roda se a sessão for esta conta. */
export const TEST_USER_ID = '627bc83a-8e02-4949-ab6b-7efae29c4ac5'

type TestClient = SupabaseClient<Database>

function env(key: string): string {
  const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key]
  const fromProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[key]
  const value = fromVite ?? fromProcess
  if (!value) {
    throw new Error(`[test-utils] variável de ambiente ${key} ausente — configure em apps/interno/.env.local`)
  }
  return value
}

/**
 * Client autenticado COMO A CONTA-TESTE (anon key + signIn), apontado pra produção.
 * Falha alto se o login não der ou se a conta logada não for a conta-teste esperada.
 */
export async function createTestClient(): Promise<TestClient> {
  const client = createClient<Database>(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email: env('VITE_TEST_USER_EMAIL'),
    password: env('VITE_TEST_USER_PASSWORD'),
  })
  if (error) {
    throw new Error(`[test-utils] login da conta-teste falhou: ${error.message}`)
  }
  if (data.user?.id !== TEST_USER_ID) {
    throw new Error(
      `[test-utils] conta logada (${data.user?.id}) != conta-teste esperada (${TEST_USER_ID}). Abortando.`,
    )
  }
  return client
}

/**
 * GUARD: confirma que o client está logado como a conta-teste. Sem isso nenhum delete roda.
 * É o que impede um cleanup acidental contra dados reais (mata o footgun do antigo table-wipe).
 */
async function assertTestAccount(client: TestClient): Promise<void> {
  const { data, error } = await client.auth.getUser()
  if (error || data.user?.id !== TEST_USER_ID) {
    throw new Error(
      '[test-utils] cleanTestData ABORTADO: a sessão não é a conta-teste. Recusando deletar qualquer coisa.',
    )
  }
}

async function selectIds(
  client: TestClient,
  table: 'vendas' | 'contatos' | 'cat_pedidos' | 'purchase_orders',
  column: string,
  values: string[],
): Promise<string[]> {
  if (values.length === 0) return []
  const { data, error } = await client.from(table).select('id').in(column, values)
  if (error) throw new Error(`[test-utils] falha lendo ${table}: ${error.message}`)
  return (data ?? []).map((r) => (r as { id: string }).id)
}

async function delIn(client: TestClient, table: string, column: string, values: string[]): Promise<void> {
  if (values.length === 0) return
  // @ts-expect-error tabela dinâmica — limpeza interna de teste
  const { error } = await client.from(table).delete().in(column, values)
  if (error) throw new Error(`[test-utils] falha limpando ${table}: ${error.message}`)
}

async function delByCreator(client: TestClient, table: string): Promise<void> {
  // @ts-expect-error tabela dinâmica — limpeza interna de teste
  const { error } = await client.from(table).delete().eq('created_by', TEST_USER_ID)
  if (error) throw new Error(`[test-utils] falha limpando ${table}: ${error.message}`)
}

/**
 * Limpa SOMENTE o que a conta-teste criou. Ordem respeitando FKs.
 * Tabelas com `created_by`: delete direto. Tabelas-filho sem `created_by`: ancoradas no pai.
 */
export async function cleanTestData(client: TestClient): Promise<void> {
  await assertTestAccount(client)

  // Pais com created_by → coletar ids p/ ancorar os filhos
  const vendaIds = await selectIds(client, 'vendas', 'created_by', [TEST_USER_ID])
  const contatoIds = await selectIds(client, 'contatos', 'created_by', [TEST_USER_ID])
  const catPedidoIds = await selectIds(client, 'cat_pedidos', 'contato_id', contatoIds)
  const purchaseOrderIds = await selectIds(client, 'purchase_orders', 'fornecedor_id', contatoIds)

  // Filhos de vendas
  await delByCreator(client, 'lancamentos') // tem created_by (cobre manual/transfer/venda)
  await delIn(client, 'pagamentos_venda', 'venda_id', vendaIds)
  await delIn(client, 'itens_venda', 'venda_id', vendaIds)
  await delByCreator(client, 'vendas')

  // Filhos de cat_pedidos
  await delIn(client, 'cat_itens_pedido', 'pedido_id', catPedidoIds)
  await delIn(client, 'cat_pedidos_pendentes_vinculacao', 'cat_pedido_id', catPedidoIds)
  await delIn(client, 'cat_pedidos', 'id', catPedidoIds)

  // Filhos de purchase_orders
  await delIn(client, 'purchase_order_payments', 'purchase_order_id', purchaseOrderIds)
  await delIn(client, 'purchase_order_items', 'purchase_order_id', purchaseOrderIds)
  await delIn(client, 'purchase_orders', 'id', purchaseOrderIds)

  // Contas a pagar (têm created_by)
  await delByCreator(client, 'pagamentos_conta_a_pagar')
  await delByCreator(client, 'contas_a_pagar')

  // Contas criadas pelo teste (seed data de outras contas fica intacto — created_by ≠ teste)
  await delByCreator(client, 'contas')

  // Contatos por último (referenciados por cat_pedidos/purchase_orders, já limpos)
  await delByCreator(client, 'contatos')
}
