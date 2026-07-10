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
}
