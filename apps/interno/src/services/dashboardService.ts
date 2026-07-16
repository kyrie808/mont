import { supabase } from '../lib/supabase'

type HomeFinanceiroRow = any
type HomeOperacionalRow = any
type HomeAlertasRow = any

interface BreakdownResult {
    vencidos: number
    vencem_hoje: number
    vencem_semana: number
    sem_data: number
    valor_vencido: number
    valor_hoje: number
    valor_semana: number
    valor_sem_data: number
}

export interface TopIndicador {
    indicadorId: string
    nome: string
    totalIndicados: number
    /** Quantos dos trazidos compraram. Opcional: o JSON do Início passou a trazê-lo,
     *  mas mantemos opcional para tolerar payloads antigos em cache. */
    totalConvertidos?: number
    totalVendasIndicados: number
}

export interface VendaAlerta {
    id: string
    total: number
    status: string
    pago: boolean
    data: string
    contato: {
        nome: string | null
    } | null
    /** A view_home_operacional devolve o nome do cliente NESTE campo (plano). */
    contato_nome?: string | null
}

export interface RawFinanceiroAlerta {
    venda_id: string
    valor: number
    contato_nome: string
    contato_telefone: string
    vencimento: string
}

export interface DashboardMetrics {
    operational: {
        total_vendas: number
        total_itens: number
        entregas_pendentes_total: number
        entregas_hoje_realizadas: number
        clientes_ativos: number
        ranking_indicacoes: TopIndicador[]
        ultimas_vendas: VendaAlerta[]
    },
    financial: {
        faturamento_mes_atual: number
        receita_frete_mes_atual: number
        lucro_mes_atual: number
        ticket_medio_mes_atual: number
        vendas_mes_atual: number
        faturamento_mes_anterior: number
        variacao_percentual: number
        total_a_receber: number
        liquidado_mes: number
        liquidado_mes_count: number
        alertas_financeiros: RawFinanceiroAlerta[]
        a_receber_detalhado?: {
            vencidos: number
            vencem_hoje: number
            vencem_semana: number
            sem_data: number
            valor_vencido: number
            valor_hoje: number
            valor_semana: number
            valor_sem_data: number
        }
    },
    alertas_recompra: {
        contato_id: string
        nome: string
        telefone: string
        data_ultima_compra: string
        dias_sem_compra: number
    }[]
}

export const dashboardService = {
    async getDashboardMetrics(month: number, year: number): Promise<DashboardMetrics> {
        const [
            { data: financialData, error: finError },
            { data: operationalData, error: opError },
            { data: alertsData, error: alrError },
            { data: breakdownData, error: breakdownError }
        ] = await Promise.all([
            supabase
                .from('view_home_financeiro')
                .select('faturamento, receita_frete, ticket_medio, lucro_estimado, total_a_receber, liquidado_mes, liquidado_mes_count, faturamento_anterior, variacao_faturamento_percentual, alertas_financeiros')
                .eq('mes', month)
                .eq('ano', year)
                .maybeSingle(),
            supabase
                .from('view_home_operacional')
                .select('total_vendas, total_itens, pedidos_pendentes, pedidos_entregues_hoje, clientes_ativos, ranking_indicacoes, ultimas_vendas')
                .eq('mes', month)
                .eq('ano', year)
                .maybeSingle(),
            supabase
                .from('view_home_alertas')
                .select('contato_id, nome, telefone, data_ultima_compra, dias_sem_compra')
                .limit(10),
            supabase.rpc('get_areceber_breakdown').maybeSingle()
        ])

        if (finError) throw finError
        if (opError) throw opError
        if (alrError) throw alrError
        if (breakdownError) throw breakdownError

        return mapDashboardMetrics(
            financialData as HomeFinanceiroRow,
            operationalData as HomeOperacionalRow,
            alertsData as HomeAlertasRow[],
            breakdownData as BreakdownResult
        )
    },

    async getLucroLiquido(mes: Date): Promise<{
        receita_bruta: number
        receita_frete: number
        custo_produtos: number
        lucro_bruto: number
        despesas_operacionais: number
        custo_fabrica: number
        lucro_liquido: number
        margem_liquida_pct: number
    }> {
        const ano = mes.getFullYear()
        const mesNum = mes.getMonth() + 1
        const inicio = `${ano}-${String(mesNum).padStart(2, '0')}-01`
        const fimMes = new Date(ano, mesNum, 0).getDate()
        const fim = `${ano}-${String(mesNum).padStart(2, '0')}-${fimMes}`

        const { data, error } = await supabase
            .from('view_lucro_liquido_mensal')
            .select('receita_bruta, receita_frete, custo_produtos, lucro_bruto, despesas_operacionais, custo_fabrica, lucro_liquido, margem_liquida_pct')
            .gte('mes', inicio)
            .lte('mes', fim)
            .maybeSingle()

        if (error || !data) return {
            receita_bruta: 0, receita_frete: 0, custo_produtos: 0, lucro_bruto: 0,
            despesas_operacionais: 0, custo_fabrica: 0,
            lucro_liquido: 0, margem_liquida_pct: 0
        }

        return {
            receita_bruta: Number(data.receita_bruta) || 0,
            receita_frete: Number(data.receita_frete) || 0,
            custo_produtos: Number(data.custo_produtos) || 0,
            lucro_bruto: Number(data.lucro_bruto) || 0,
            despesas_operacionais: Number(data.despesas_operacionais) || 0,
            custo_fabrica: Number(data.custo_fabrica) || 0,
            lucro_liquido: Number(data.lucro_liquido) || 0,
            margem_liquida_pct: Number(data.margem_liquida_pct) || 0,
        }
    },

    async getLiquidadoMes(mes: Date): Promise<{
        vendas_liquidadas: number
        total_liquidado: number
    }> {
        const ano = mes.getFullYear()
        const mesNum = mes.getMonth() + 1
        const inicio = `${ano}-${String(mesNum).padStart(2, '0')}-01`
        const fimMes = new Date(ano, mesNum, 0).getDate()
        const fim = `${ano}-${String(mesNum).padStart(2, '0')}-${fimMes}`

        const { data, error } = await supabase
            .from('view_liquidado_mensal')
            .select('vendas_liquidadas, total_liquidado')
            .gte('mes', inicio)
            .lte('mes', fim)
            .maybeSingle()

        if (error || !data) return {
            vendas_liquidadas: 0,
            total_liquidado: 0
        }

        return {
            vendas_liquidadas: Number(data.vendas_liquidadas) || 0,
            total_liquidado: Number(data.total_liquidado) || 0
        }
    },

    async getContasAPagarDashboard(): Promise<{
        total_a_pagar: number
        total_vencido: number
        qtd_pendentes: number
        qtd_vencidas: number
    }> {
        const { data, error } = await supabase
            .from('view_contas_a_pagar_dashboard')
            .select('total_a_pagar, total_vencido, qtd_pendentes, qtd_vencidas')
            .maybeSingle()

        if (error || !data) return { total_a_pagar: 0, total_vencido: 0, qtd_pendentes: 0, qtd_vencidas: 0 }

        return {
            total_a_pagar: Number(data.total_a_pagar) || 0,
            total_vencido: Number(data.total_vencido) || 0,
            qtd_pendentes: Number(data.qtd_pendentes) || 0,
            qtd_vencidas: Number(data.qtd_vencidas) || 0,
        }
    },

    async getProximosVencimentos(): Promise<{
        conta_a_pagar_id: string
        credor: string
        descricao: string
        saldo_devedor: number
        data_vencimento: string
        situacao: string
        dias_atraso: number
        parcela_atual: number | null
        total_parcelas: number | null
    }[]> {
        const { data, error } = await supabase
            .from('rpt_projecao_pagamentos')
            .select('conta_a_pagar_id, credor, descricao, saldo_devedor, data_vencimento, situacao, dias_atraso, parcela_atual, total_parcelas')
            .in('situacao', ['vencido', 'vence_hoje', 'proximos_7_dias', 'proximos_30_dias'])
            .order('data_vencimento', { ascending: true })
            .limit(5)

        if (error || !data) return []

        return data.map(d => ({
            conta_a_pagar_id: d.conta_a_pagar_id ?? '',
            credor: d.credor ?? '',
            descricao: d.descricao ?? '',
            saldo_devedor: Number(d.saldo_devedor) || 0,
            data_vencimento: d.data_vencimento ?? '',
            situacao: d.situacao ?? '',
            dias_atraso: Number(d.dias_atraso) || 0,
            parcela_atual: d.parcela_atual,
            total_parcelas: d.total_parcelas,
        }))
    },

    /**
     * A Receber. O `total_a_receber` é de TODOS os meses de propósito — dívida não tem
     * mês, e 62% dela está fora do mês corrente (a mais antiga é de jan/2026). O mês
     * (`a_receber_mes`) vem como contexto, nunca como o número principal.
     */
    async getTotalAReceber(ano?: number, mes?: number): Promise<{
        total_a_receber: number
        total_contatos_abertos: number
        a_receber_mes: number
    }> {
        const vazio = { total_a_receber: 0, total_contatos_abertos: 0, a_receber_mes: 0 }
        const { data, error } = await supabase.rpc('rpc_total_a_receber_dashboard', {
            p_ano: ano ?? undefined,
            p_mes: mes ?? undefined,
        })
        if (error || !data) return vazio
        const result = data as { total_a_receber: number; total_contatos_abertos: number; a_receber_mes: number }
        return {
            total_a_receber: Number(result.total_a_receber) || 0,
            total_contatos_abertos: Number(result.total_contatos_abertos) || 0,
            a_receber_mes: Number(result.a_receber_mes) || 0,
        }
    },

    /**
     * Metas = MÉDIA histórica de cada KPI mensal dos meses CONCLUÍDOS
     * (desde o zero-day do tracking, 2026-05, excluindo o mês corrente parcial).
     * Serve de "meta" das barras de KPI até haver meta real. Frontend-only.
     */
    async getMetasMedia(): Promise<{
        faturamento: number
        receitaFrete: number
        ticketMedio: number
        liquidado: number
        lucroBruto: number
        lucroLiquido: number
        vendas: number
        itens: number
        meses: number
    }> {
        const now = new Date()
        const startOrd = 2026 * 12 + 5 // maio/2026 (zero-day do tracking financeiro)
        const curOrd = now.getFullYear() * 12 + (now.getMonth() + 1)

        const [{ data: finRows }, { data: lucroRows }, { data: opRows }] = await Promise.all([
            supabase.from('view_home_financeiro').select('faturamento, ticket_medio, receita_frete, liquidado_mes, mes, ano'),
            supabase.from('view_lucro_liquido_mensal').select('lucro_bruto, lucro_liquido, mes'),
            supabase.from('view_home_operacional').select('total_vendas, total_itens, mes, ano'),
        ])

        const media = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
        const inWindowMesAno = (r: { mes: number | string | null; ano: number | string | null }) => {
            const ord = Number(r.ano) * 12 + Number(r.mes)
            return ord >= startOrd && ord < curOrd
        }
        const inWindowDate = (r: { mes: string | null }) => {
            const [y, m] = String(r.mes).slice(0, 7).split('-').map(Number) // 'YYYY-MM' local-safe
            return y * 12 + m >= startOrd && y * 12 + m < curOrd
        }

        const fin = (finRows ?? []).filter(inWindowMesAno)
        const lucro = (lucroRows ?? []).filter(inWindowDate)
        const op = (opRows ?? []).filter(inWindowMesAno)

        return {
            faturamento: media(fin.map((r) => Number(r.faturamento) || 0)),
            receitaFrete: media(fin.map((r) => Number(r.receita_frete) || 0)),
            ticketMedio: media(fin.map((r) => Number(r.ticket_medio) || 0)),
            liquidado: media(fin.map((r) => Number(r.liquidado_mes) || 0)),
            lucroBruto: media(lucro.map((r) => Number(r.lucro_bruto) || 0)),
            lucroLiquido: media(lucro.map((r) => Number(r.lucro_liquido) || 0)),
            vendas: media(op.map((r) => Number(r.total_vendas) || 0)),
            itens: media(op.map((r) => Number(r.total_itens) || 0)),
            meses: Math.max(fin.length, lucro.length, op.length),
        }
    }
}

// Pure business logic extracted for testing
export function mapDashboardMetrics(
    financialData: HomeFinanceiroRow | null,
    operationalData: HomeOperacionalRow | null,
    alertsData: HomeAlertasRow[] | null,
    breakdownData?: BreakdownResult
): DashboardMetrics {
    const fin = financialData || {
        faturamento: 0,
        receita_frete: 0,
        ticket_medio: 0,
        lucro_estimado: 0,
        total_a_receber: 0,
        liquidado_mes: 0,
        liquidado_mes_count: 0,
        faturamento_anterior: 0,
        variacao_faturamento_percentual: 0,
        alertas_financeiros: []
    }

    const op = operationalData || {
        total_vendas: 0,
        total_itens: 0,
        pedidos_pendentes: 0,
        pedidos_entregues_hoje: 0,
        clientes_ativos: 0,
        ranking_indicacoes: [],
        ultimas_vendas: []
    }

    return {
        operational: {
            total_vendas: op.total_vendas ?? 0,
            total_itens: op.total_itens ?? 0,
            entregas_pendentes_total: op.pedidos_pendentes ?? 0,
            entregas_hoje_realizadas: op.pedidos_entregues_hoje ?? 0,
            clientes_ativos: op.clientes_ativos ?? 0,
            ranking_indicacoes: (op.ranking_indicacoes as unknown as TopIndicador[]) ?? [],
            ultimas_vendas: (op.ultimas_vendas as VendaAlerta[]) ?? [],
        },
        financial: {
            faturamento_mes_atual: fin.faturamento ?? 0,
            receita_frete_mes_atual: fin.receita_frete ?? 0,
            lucro_mes_atual: fin.lucro_estimado ?? 0,
            ticket_medio_mes_atual: fin.ticket_medio ?? 0,
            vendas_mes_atual: op.total_vendas ?? 0,
            faturamento_mes_anterior: fin.faturamento_anterior ?? 0,
            variacao_percentual: fin.variacao_faturamento_percentual ?? 0,
            total_a_receber: fin.total_a_receber ?? 0,
            liquidado_mes: fin.liquidado_mes ?? 0,
            liquidado_mes_count: fin.liquidado_mes_count ?? 0,
            alertas_financeiros: (fin.alertas_financeiros as RawFinanceiroAlerta[]) ?? [],
            a_receber_detalhado: breakdownData ? {
                vencidos: Number(breakdownData.vencidos || 0),
                vencem_hoje: Number(breakdownData.vencem_hoje || 0),
                vencem_semana: Number(breakdownData.vencem_semana || 0),
                sem_data: Number(breakdownData.sem_data || 0),
                valor_vencido: Number(breakdownData.valor_vencido || 0),
                valor_hoje: Number(breakdownData.valor_hoje || 0),
                valor_semana: Number(breakdownData.valor_semana || 0),
                valor_sem_data: Number(breakdownData.valor_sem_data || 0),
            } : undefined
        },
        alertas_recompra: (alertsData || []).map((a) => ({
            contato_id: a.contato_id ?? '',
            nome: a.nome ?? 'Cliente sem nome',
            telefone: a.telefone ?? '',
            data_ultima_compra: a.data_ultima_compra ?? '',
            dias_sem_compra: a.dias_sem_compra ?? 0
        }))
    }
}
