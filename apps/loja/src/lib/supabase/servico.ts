import { createClient } from '@supabase/supabase-js'
import type { Database } from '@mont/shared'
import { ambiente, ambienteServidor } from '@/lib/ambiente'

/**
 * Cliente com a chave de serviço, para a server action do pedido. Usado só no servidor:
 * a loja grava pela RPC loja_criar_pedido (executável apenas por service_role), nunca direto
 * nas tabelas e nunca com a chave pública.
 */
export function criarClienteServico() {
    return createClient<Database>(ambiente().NEXT_PUBLIC_SUPABASE_URL, ambienteServidor().SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}
