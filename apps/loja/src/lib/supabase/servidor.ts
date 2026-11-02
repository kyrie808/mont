import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@mont/shared'
import { ambiente } from '@/lib/ambiente'

/**
 * Cliente Supabase para Server Components, com a chave pública (anon).
 * A loja só LÊ por aqui; as policies deixam anon ver apenas o que está visível/ativo.
 * Escrita (Fase 2) vai por server action chamando RPC — nunca por este cliente.
 */
export async function criarClienteServidor() {
    const cookieStore = await cookies()
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = ambiente()

    return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(lista) {
                try {
                    lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                } catch {
                    // Server Component não pode gravar cookie; a loja não tem sessão, então não há o que gravar.
                }
            },
        },
    })
}
