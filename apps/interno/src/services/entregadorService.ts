import { supabase } from '../lib/supabase'
import type { Database } from '@mont/shared'

export interface EntregadorOption {
    id: string
    nome: string
}

/** Uma linha do extrato de repasse (RPC admin_extrato_entregadores). */
export type ExtratoEntregador = Database['public']['Functions']['admin_extrato_entregadores']['Returns'][number]

export const entregadorService = {
    /** Entregadores ativos, para o seletor de atribuição no checkout. Admin lê via RLS. */
    async listAtivos(): Promise<EntregadorOption[]> {
        const { data, error } = await supabase
            .from('entregadores')
            .select('id, nome')
            .eq('ativo', true)
            .order('nome', { ascending: true })
        if (error) throw error
        return (data ?? []) as EntregadorOption[]
    },

    /** Extrato de repasse por entregador no período (devido/pago/saldo). Admin-only. */
    async getExtrato(inicio: string, fim: string): Promise<ExtratoEntregador[]> {
        const { data, error } = await supabase.rpc('admin_extrato_entregadores', {
            p_inicio: inicio,
            p_fim: fim,
        })
        if (error) throw error
        return data ?? []
    },
}
