import { supabase } from '../lib/supabase'
import type { Tables } from '@mont/shared'

export const relatorioService = {
    // ── Clientes ──────────────────────────────────────────────────────────────

    async getLtvPorCliente(): Promise<Tables<'rpt_ltv_por_cliente'>[]> {
        const { data, error } = await supabase
            .from('rpt_ltv_por_cliente')
            .select('*')
            .order('ltv_total', { ascending: false, nullsFirst: false })
        if (error) throw error
        return data ?? []
    },

    // ── Produtos ──────────────────────────────────────────────────────────────

    async getMargemPorSku(): Promise<Tables<'rpt_margem_por_sku'>[]> {
        const { data, error } = await supabase
            .from('rpt_margem_por_sku')
            .select('*')
            .order('margem_pct', { ascending: false, nullsFirst: false })
        if (error) throw error
        return data ?? []
    },

    async getGiroEstoque(): Promise<Tables<'rpt_giro_estoque'>[]> {
        const { data, error } = await supabase
            .from('rpt_giro_estoque')
            .select('*')
            .order('giro_estoque', { ascending: true, nullsFirst: false })
        if (error) throw error
        return data ?? []
    },

    // ── Financeiro ────────────────────────────────────────────────────────────

    async getFaturamentoComparativo(): Promise<Tables<'rpt_faturamento_comparativo'>[]> {
        const { data, error } = await supabase
            .from('rpt_faturamento_comparativo')
            .select('*')
            .order('ano', { ascending: false })
            .order('mes', { ascending: false })
        if (error) throw error
        return data ?? []
    },

    async getDistribuicaoFormaPagamento(): Promise<Tables<'rpt_distribuicao_forma_pagamento'>[]> {
        const { data, error } = await supabase
            .from('rpt_distribuicao_forma_pagamento')
            .select('*')
            .order('faturamento', { ascending: false, nullsFirst: false })
        if (error) throw error
        return data ?? []
    },

    async getProjecaoRecebimentos(): Promise<Tables<'rpt_projecao_recebimentos'>[]> {
        const { data, error } = await supabase
            .from('rpt_projecao_recebimentos')
            .select('*')
            .order('data_prevista_pagamento', { ascending: true, nullsFirst: false })
        if (error) throw error
        return data ?? []
    },

    async getProjecaoPagamentos(): Promise<Tables<'rpt_projecao_pagamentos'>[]> {
        const { data, error } = await supabase
            .from('rpt_projecao_pagamentos')
            .select('*')
            .order('data_vencimento', { ascending: true, nullsFirst: false })
        if (error) throw error
        return data ?? []
    },

    // ── Marketing ─────────────────────────────────────────────────────────────

    async getMarketingPedidos(): Promise<Tables<'vw_marketing_pedidos'>[]> {
        const { data, error } = await supabase
            .from('vw_marketing_pedidos')
            .select('*')
            .order('data_venda', { ascending: false })
        if (error) throw error
        return data ?? []
    },

}
