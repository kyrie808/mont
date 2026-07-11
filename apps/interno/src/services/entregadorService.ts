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

/** Uma entrega atribuída (lista do hub admin, com posição na rota). */
export interface EntregaLista {
    id: string
    clienteNome: string
    entregadorNome: string
    status: string
    data: string
    ordemRota: number | null
    enderecoCurto: string
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

    /** Entregas atribuídas a um entregador (ou todos), na ordem da rota. Admin lê via RLS.
     *  Período (inicio/fim) recorta no padrão COALESCE(data_entrega, data), como o extrato. */
    async getEntregas(
        opts: { entregadorId?: string; incluirEntregues?: boolean; inicio?: string; fim?: string } = {},
    ): Promise<EntregaLista[]> {
        let q = supabase
            .from('vendas')
            .select('id, status, data, data_entrega, ordem_rota, contato:contatos(nome, logradouro, numero, bairro), entregador:entregadores!entregador_id(nome)')
            .not('entregador_id', 'is', null)
        if (opts.entregadorId) q = q.eq('entregador_id', opts.entregadorId)
        if (opts.inicio && opts.fim) {
            // COALESCE(data_entrega, data) dentro do período (mesma semântica do extrato).
            q = q.or(
                `and(data_entrega.gte.${opts.inicio},data_entrega.lte.${opts.fim}),` +
                `and(data_entrega.is.null,data.gte.${opts.inicio},data.lte.${opts.fim})`,
            )
        }
        q = opts.incluirEntregues
            ? q.neq('status', 'cancelada')
            : q.not('status', 'in', '(entregue,cancelada)')
        q = q.order('ordem_rota', { ascending: true, nullsFirst: false }).order('data', { ascending: true })

        const { data, error } = await q
        if (error) throw error
        return (data ?? []).map((v) => ({
            id: v.id as string,
            status: v.status as string,
            data: (v.data_entrega ?? v.data) as string,
            ordemRota: (v.ordem_rota as number | null) ?? null,
            clienteNome: v.contato?.nome ?? '—',
            entregadorNome: v.entregador?.nome ?? '—',
            enderecoCurto: [
                [v.contato?.logradouro, v.contato?.numero].filter(Boolean).join(', '),
                v.contato?.bairro,
            ].filter(Boolean).join(' · '),
        }))
    },
}
