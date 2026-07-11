import { supabase } from '../lib/supabase'
import type { Database } from '@mont/shared'

export interface EntregadorOption {
    id: string
    nome: string
}

/** Uma linha do extrato de repasse (RPC admin_extrato_entregadores). */
export type ExtratoEntregador = Database['public']['Functions']['admin_extrato_entregadores']['Returns'][number]

/** Uma venda com dinheiro recolhido pelo entregador e ainda não acertado com a Mont. */
export interface DinheiroAAcertar {
    id: string
    total: number
    recebidoEm: string | null
    clienteNome: string
}

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

    /** Vendas com dinheiro recolhido pelo entregador e ainda não acertado com a Mont. */
    async getDinheiroAAcertar(): Promise<DinheiroAAcertar[]> {
        const { data, error } = await supabase
            .from('vendas')
            .select('id, total, recebido_em, contato:contatos(nome)')
            .not('recebido_por_entregador_id', 'is', null)
            .is('dinheiro_acertado_em', null)
            .order('recebido_em', { ascending: true })
        if (error) throw error
        return (data ?? []).map((v) => ({
            id: v.id as string,
            total: Number(v.total),
            recebidoEm: v.recebido_em as string | null,
            clienteNome: v.contato?.nome ?? '—',
        }))
    },

    /** Confirma que a Mont recebeu de volta o dinheiro que o entregador coletou. */
    async confirmarDinheiroAcertado(vendaId: string): Promise<void> {
        const { error } = await supabase
            .from('vendas')
            .update({ dinheiro_acertado_em: new Date().toISOString() })
            .eq('id', vendaId)
        if (error) throw error
    },
}
