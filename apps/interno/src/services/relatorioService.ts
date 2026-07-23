import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Database, Tables } from '@mont/shared'

type Fn<T extends keyof Database['public']['Functions']> = Database['public']['Functions'][T]['Returns']

/** Período dos relatórios: um mês específico OU geral (todos os tempos). */
export type PeriodoRel = { tipo: 'geral' } | { tipo: 'mes'; ano: number; mes: number }

/** Converte o período no intervalo [desde, ate] (yyyy-MM-dd). Geral = null/null. */
export function rangeDoPeriodo(p: PeriodoRel): { desde: string | null; ate: string | null } {
    if (p.tipo === 'geral') return { desde: null, ate: null }
    const first = new Date(p.ano, p.mes - 1, 1)
    const last = new Date(p.ano, p.mes, 0) // dia 0 do mês seguinte = último dia deste mês
    return { desde: format(first, 'yyyy-MM-dd'), ate: format(last, 'yyyy-MM-dd') }
}

export const relatorioService = {
    // ── Clientes ──────────────────────────────────────────────────────────────

    async getLtvPorCliente(pDesde: string | null, pAte: string | null): Promise<Fn<'rpt_ltv_por_cliente_periodo'>> {
        const { data, error } = await supabase.rpc('rpt_ltv_por_cliente_periodo', { p_desde: pDesde ?? undefined, p_ate: pAte ?? undefined })
        if (error) throw error
        return data ?? []
    },

    // ── Produtos ──────────────────────────────────────────────────────────────

    async getMargemPorSku(pDesde: string | null, pAte: string | null): Promise<Fn<'rpt_margem_por_sku_periodo'>> {
        const { data, error } = await supabase.rpc('rpt_margem_por_sku_periodo', { p_desde: pDesde ?? undefined, p_ate: pAte ?? undefined })
        if (error) throw error
        return data ?? []
    },

    async getGiroEstoque(pDesde: string | null, pAte: string | null): Promise<Fn<'rpt_giro_estoque_periodo'>> {
        const { data, error } = await supabase.rpc('rpt_giro_estoque_periodo', { p_desde: pDesde ?? undefined, p_ate: pAte ?? undefined })
        if (error) throw error
        return data ?? []
    },

    // ── Financeiro ────────────────────────────────────────────────────────────
    //   O comparativo é mensal (view canônica, reconcilia com o Início). A aba recorta
    //   as linhas client-side pelo mês/geral selecionado.

    async getFaturamentoComparativo(): Promise<Tables<'rpt_faturamento_comparativo'>[]> {
        const { data, error } = await supabase
            .from('rpt_faturamento_comparativo')
            .select('*')
            .order('ano', { ascending: false })
            .order('mes', { ascending: false })
        if (error) throw error
        return data ?? []
    },

    async getDistribuicaoFormaPagamento(pDesde: string | null, pAte: string | null): Promise<Fn<'rpt_distribuicao_forma_pagamento_periodo'>> {
        const { data, error } = await supabase.rpc('rpt_distribuicao_forma_pagamento_periodo', { p_desde: pDesde ?? undefined, p_ate: pAte ?? undefined })
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

    async getMarketingPedidos(pDesde: string | null, pAte: string | null): Promise<Fn<'rpt_marketing_pedidos_periodo'>> {
        const { data, error } = await supabase.rpc('rpt_marketing_pedidos_periodo', { p_desde: pDesde ?? undefined, p_ate: pAte ?? undefined })
        if (error) throw error
        return data ?? []
    },

    /** Aquisição mensal por origem (view vitalícia; a aba recorta client-side). */
    async getAquisicaoMensal(): Promise<Tables<'rpt_aquisicao_mensal'>[]> {
        const { data, error } = await supabase.from('rpt_aquisicao_mensal').select('*')
        if (error) throw error
        return data ?? []
    },

    /** Alavancas: brindes doados + descontos concedidos no período. */
    async getPromocoes(pDesde: string | null, pAte: string | null): Promise<Fn<'rpt_promocoes_periodo'>> {
        const { data, error } = await supabase.rpc('rpt_promocoes_periodo', { p_desde: pDesde ?? undefined, p_ate: pAte ?? undefined })
        if (error) throw error
        return data ?? []
    },

    /** Ranking de indicações completo (embaixadores) — vitalício. */
    async getRankingIndicacoes(): Promise<Tables<'ranking_indicacoes'>[]> {
        const { data, error } = await supabase
            .from('ranking_indicacoes')
            .select('*')
            .order('total_vendas_indicados', { ascending: false })
        if (error) throw error
        return data ?? []
    },

    /** Campanhas de AQUISIÇÃO (anúncio): leads/conversão/receita — vitalício. */
    async getCampanhas(): Promise<Tables<'rpt_campanhas'>[]> {
        const { data, error } = await supabase
            .from('rpt_campanhas')
            .select('*')
            .order('leads', { ascending: false })
        if (error) throw error
        return data ?? []
    },

    /** ROAS por campanha × mês (Meta): gasto/receita/leads — vitalício; a UI recorta por período. */
    async getCampanhasRoasMensal(): Promise<Tables<'rpt_campanhas_roas_mensal'>[]> {
        const { data, error } = await supabase
            .from('rpt_campanhas_roas_mensal')
            .select('*')
        if (error) throw error
        return data ?? []
    },

    /** Campanhas de PROMOÇÃO (ofertas): participantes/compraram/receita — vitalício. */
    async getCampanhasPromocao(): Promise<Tables<'rpt_campanhas_promocao'>[]> {
        const { data, error } = await supabase
            .from('rpt_campanhas_promocao')
            .select('*')
            .order('participantes', { ascending: false })
        if (error) throw error
        return data ?? []
    },

    /** Leads por fonte de anúncio (meta/google/tiktok) — vitalício. */
    async getAquisicaoFonte(): Promise<Tables<'rpt_aquisicao_fonte'>[]> {
        const { data, error } = await supabase
            .from('rpt_aquisicao_fonte')
            .select('*')
            .order('leads', { ascending: false })
        if (error) throw error
        return data ?? []
    },

    /** Esforço de contato (tentativas × resposta) no período. */
    async getRelacionamentoEsforco(pDesde: string | null, pAte: string | null): Promise<Fn<'rpt_relacionamento_esforco_periodo'>> {
        const { data, error } = await supabase.rpc('rpt_relacionamento_esforco_periodo', { p_desde: pDesde ?? undefined, p_ate: pAte ?? undefined })
        if (error) throw error
        return data ?? []
    },

    /** Funil de trabalho do kanban + base não-alcançável — vitalício. */
    async getRelacionamentoFunil(): Promise<Tables<'rpt_relacionamento_funil'>[]> {
        const { data, error } = await supabase.from('rpt_relacionamento_funil').select('*')
        if (error) throw error
        return data ?? []
    },

}
