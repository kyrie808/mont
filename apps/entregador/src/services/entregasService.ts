import { supabase } from '../lib/supabase'
import type { Database } from '@mont/shared'

/** Uma entrega curada, exatamente como a RPC entregador_minhas_entregas devolve. */
export type Entrega = Database['public']['Functions']['entregador_minhas_entregas']['Returns'][number]

export const entregasService = {
    async listar(): Promise<Entrega[]> {
        const { data, error } = await supabase.rpc('entregador_minhas_entregas')
        if (error) throw error
        return data ?? []
    },

    /** Baixa "recebido em dinheiro" (única escrita financeira do entregador). */
    async marcarRecebidoDinheiro(vendaId: string): Promise<void> {
        const { error } = await supabase.rpc('entregador_marcar_recebido_dinheiro', { p_venda_id: vendaId })
        if (error) throw error
    },

    /** Confirma a entrega → vira status='entregue' de verdade no sistema. */
    async marcarEntregue(vendaId: string): Promise<void> {
        const { error } = await supabase.rpc('entregador_marcar_entregue', { p_venda_id: vendaId })
        if (error) throw error
    },

    /** Perfil do entregador logado (lê a própria linha — policy own-row do Stage 0). */
    async meuPerfil(): Promise<{ nome: string; repasse_por_entrega: number } | null> {
        const { data: userData } = await supabase.auth.getUser()
        const uid = userData.user?.id
        if (!uid) return null
        const { data, error } = await supabase
            .from('entregadores')
            .select('nome, repasse_por_entrega')
            .eq('user_id', uid)
            .maybeSingle()
        if (error) throw error
        return data
    },
}
