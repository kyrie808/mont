import { supabase } from '../lib/supabase'
import type { Database } from '@mont/shared'

type ContaAPagarRow = Database['public']['Tables']['contas_a_pagar']['Row']
type ContaAPagarInsert = Database['public']['Tables']['contas_a_pagar']['Insert']
type PagamentoRow = Database['public']['Tables']['pagamentos_conta_a_pagar']['Row']

export interface ContaAPagarWithCategoria extends ContaAPagarRow {
    plano_de_contas: { nome: string } | null
}

export const contasAPagarService = {
    async getContasAPagar(): Promise<ContaAPagarWithCategoria[]> {
        const { data, error } = await (supabase
            .from('contas_a_pagar') as any)
            .select('*, plano_de_contas(nome)')
            .order('data_vencimento', { ascending: true })

        if (error) throw error
        return data || []
    },

    async createContaAPagar(payload: ContaAPagarInsert): Promise<ContaAPagarRow> {
        const { data, error } = await (supabase
            .from('contas_a_pagar') as any)
            .insert(payload)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async criarObrigacaoParcelada(params: {
        descricao: string
        credor: string
        valor_total: number
        data_vencimento: string
        plano_conta_id: string
        total_parcelas: number
        referencia?: string
        observacao?: string
    }): Promise<string[]> {
        const { data, error } = await (supabase as any).rpc('criar_obrigacao_parcelada', {
            p_descricao: params.descricao,
            p_credor: params.credor,
            p_valor_total: params.valor_total,
            p_data_vencimento: params.data_vencimento,
            p_plano_conta_id: params.plano_conta_id,
            p_total_parcelas: params.total_parcelas,
            p_referencia: params.referencia,
            p_observacao: params.observacao,
        })

        if (error) throw error
        return data as string[]
    },

    async getProjecaoPagamentos() {
        const { data, error } = await (supabase
            .from('rpt_projecao_pagamentos') as any)
            .select('*')

        if (error) throw error
        return data || []
    },

    async registrarPagamento(params: {
        contaAPagarId: string
        valor: number
        dataPagamento: string
        contaId: string
        metodoPagamento?: string
        observacao?: string
        contaCredorId?: string
    }): Promise<string> {
        const { data, error } = await (supabase as any).rpc('registrar_pagamento_conta_a_pagar', {
            p_conta_a_pagar_id: params.contaAPagarId,
            p_valor: Math.round(params.valor * 100) / 100,
            p_data_pagamento: params.dataPagamento,
            p_conta_id: params.contaId,
            p_metodo_pagamento: params.metodoPagamento ?? 'pix',
            p_observacao: params.observacao,
            p_conta_credor_id: params.contaCredorId,
        })

        if (error) throw error
        return data as string
    },

    async deleteContaAPagar(id: string): Promise<void> {
        const { error } = await (supabase
            .from('contas_a_pagar') as any)
            .delete()
            .eq('id', id)

        if (error) throw error
    },

    async getPagamentos(contaAPagarId: string): Promise<PagamentoRow[]> {
        const { data, error } = await (supabase
            .from('pagamentos_conta_a_pagar') as any)
            .select('*')
            .eq('conta_a_pagar_id', contaAPagarId)
            .order('data_pagamento', { ascending: false })

        if (error) throw error
        return data || []
    },
}
