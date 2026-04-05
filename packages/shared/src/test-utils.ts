import { createClient } from '@supabase/supabase-js'
import type { Database } from './database'

const LOCAL_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/** Client com role anon — respeita RLS */
export function createTestClient() {
    const url = process.env.SUPABASE_URL || LOCAL_URL
    const key = process.env.SUPABASE_ANON_KEY || LOCAL_ANON_KEY
    return createClient<Database>(url, key)
}

/** Client com role service_role — bypassa RLS */
export function createTestServiceClient() {
    const url = process.env.SUPABASE_URL || LOCAL_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || LOCAL_SERVICE_KEY
    return createClient<Database>(url, key)
}

/** Limpa dados de teste respeitando FK constraints */
export async function cleanTestData(client: ReturnType<typeof createTestServiceClient>) {
    const nil = '00000000-0000-0000-0000-000000000000'
    await client.from('lancamentos').delete().neq('id', nil)
    await client.from('pagamentos_venda').delete().neq('id', nil)
    await client.from('itens_venda').delete().neq('id', nil)
    await client.from('purchase_order_payments').delete().neq('id', nil)
    await client.from('purchase_order_items').delete().neq('id', nil)
    await client.from('purchase_orders').delete().neq('id', nil)
    await client.from('pagamentos_conta_a_pagar').delete().neq('id', nil)
    await client.from('contas_a_pagar').delete().neq('id', nil)
    await client.from('cat_itens_pedido').delete().neq('id', nil)
    await client.from('cat_pedidos_pendentes_vinculacao').delete().neq('id', nil)
    await client.from('vendas').delete().neq('id', nil)
    await client.from('cat_pedidos').delete().neq('id', nil)
    await client.from('contatos').delete().neq('id', nil)
    // NÃO limpar produtos e contas — são seed data
}
