import { supabase } from '../lib/supabase'
import type { Conta, PlanoConta, Lancamento, ExtratoItem, FluxoResumo, Insert } from '@mont/shared'

export interface ExtratoDeSaldoRow {
    mes: string
    mes_ordem: string
    entradas: number
    saidas: number
    saldo_mes: number
    saldo_acumulado: number
}
import { startOfMonth, endOfMonth, format, startOfDay, differenceInDays, isBefore, isSameDay, addDays } from 'date-fns'
import type { QueryData } from '@supabase/supabase-js'

export type StatusFinanceiro = 'atrasado' | 'hoje' | 'proximo'

const alertasQuery = supabase
    .from('vendas')
    .select(`
        *,
        contato:contatos(id, nome, telefone, origem, indicado_por_id),
        itens:itens_venda(*, produto:produtos(id, nome, codigo))
    `)
    .eq('pago', false)
    .eq('forma_pagamento', 'fiado')
    .neq('status', 'cancelada')
    .order('data_prevista_pagamento', { ascending: true })

export type VendaAlerta = QueryData<typeof alertasQuery>[number]

export interface AlertaFinanceiro {
    venda: VendaAlerta
    diasAtraso: number
    status: StatusFinanceiro
    dataPrevista: Date
}

export interface AlertasFinanceirosResumo {
    alertas: AlertaFinanceiro[]
    totalAtrasado: number
    totalHoje: number
    totalProximo: number
}

export const cashFlowService = {
    // --- Contas ---
    async getContas() {
        const { data, error } = await supabase
            .from('contas')
            .select('id, nome, tipo, banco, ativo, saldo_atual, saldo_inicial, criado_em, atualizado_em')
            .order('nome')
        if (error) throw error
        return data as Conta[]
    },

    async createConta(data: Insert<'contas'>) {
        const { data: created, error } = await supabase
            .from('contas')
            .insert(data)
            .select()
            .single()
        if (error) throw error
        return created as Conta
    },

    // --- Plano de Contas ---
    async getPlanoDeContas() {
        const { data, error } = await supabase
            .from('plano_de_contas')
            .select('id, nome, tipo, categoria, ativo, automatica')
            .eq('ativo', true)
            .eq('automatica', false)
            .order('nome')
        if (error) throw error
        return data as PlanoConta[]
    },

    async getExtratoDeSaldo() {
        const { data, error } = await supabase
            .from('view_extrato_saldo')
            .select('mes, mes_ordem, entradas, saidas, saldo_mes, saldo_acumulado')
            .order('mes_ordem', { ascending: false })
        if (error) throw error
        return data as unknown as ExtratoDeSaldoRow[]
    },

    async createPlanoConta(data: Insert<'plano_de_contas'>) {
        const { data: created, error } = await supabase
            .from('plano_de_contas')
            .insert(data)
            .select()
            .single()
        if (error) throw error
        return created as PlanoConta
    },

    async createTransferencia(data: {
        valor: number
        data: string
        conta_id: string
        conta_destino_id: string
        descricao?: string
    }) {
        // Transferência é um lançamento do tipo 'transferencia'
        // O sistema deve tratar a saída da conta_id e entrada na conta_destino_id
        // Isso pode ser feito no banco (trigger) ou aqui.
        // Pelo schema, temos conta_id e conta_destino_id no mesmo registro.
        const { data: created, error } = await supabase
            .from('lancamentos')
            .insert({
                tipo: 'transferencia',
                valor: Math.round(data.valor * 100) / 100,
                data: data.data,
                conta_id: data.conta_id,
                conta_destino_id: data.conta_destino_id,
                descricao: data.descricao || 'Transferência entre contas',
                origem: 'manual'
            })
            .select()
            .single()
        if (error) throw error
        return created as Lancamento
    },

    // --- Lançamentos Manuais (via RPC com validações no banco) ---
    async registrarDespesaManual(data: {
        valor: number
        descricao?: string | null
        data: string
        conta_id: string
        plano_conta_id: string
    }) {
        const { error } = await supabase.rpc('registrar_despesa_manual', {
            p_valor: Math.round(data.valor * 100) / 100,
            p_descricao: data.descricao ?? '',
            p_data: data.data,
            p_conta_id: data.conta_id,
            p_plano_conta_id: data.plano_conta_id,
        })
        if (error) throw error
    },

    async registrarEntradaManual(data: {
        valor: number
        descricao?: string | null
        data: string
        conta_id: string
        plano_conta_id: string
    }) {
        const { error } = await supabase.rpc('registrar_entrada_manual', {
            p_valor: Math.round(data.valor * 100) / 100,
            p_descricao: data.descricao ?? '',
            p_data: data.data,
            p_conta_id: data.conta_id,
            p_plano_conta_id: data.plano_conta_id,
        })
        if (error) throw error
    },

    // --- Views / Reports ---
    async getExtratoMensal(month: Date) {
        const start = format(startOfMonth(month), 'yyyy-MM-dd')
        const end = format(endOfMonth(month), 'yyyy-MM-dd')

        const { data, error } = await supabase
            .from('view_extrato_mensal')
            .select('id, data, valor, conta_id, categoria_tipo, categoria_nome, origem, descricao, tipo')
            .gte('data', start)
            .lte('data', end)
            .order('data', { ascending: false })

        if (error) throw error
        return data as ExtratoItem[]
    },

    async getFluxoResumo(month: Date) {
        const mes = month.getMonth() + 1
        const ano = month.getFullYear()

        const { data, error } = await supabase
            .from('view_fluxo_resumo')
            .select('mes, ano, total_entradas, total_saidas, total_faturamento, lucro_estimado, total_a_receber')
            .eq('mes', mes)
            .eq('ano', ano)
            .maybeSingle()

        if (error) throw error
        return data as FluxoResumo
    },

    async getContasReceber() {
        // Vendas entregues mas não pagas
        const { data, error } = await supabase
            .from('vendas')
            .select(`
        *,
        contato:contatos(nome)
      `)
            .eq('status', 'entregue')
            .eq('pago', false)
            .order('data_prevista_pagamento', { ascending: true })

        if (error) throw error
        return data
    },

    async getAlertasFinanceiros(): Promise<AlertasFinanceirosResumo> {
        const { data, error } = await alertasQuery

        if (error) throw error

        const vendas = data || []
        return processAlertasFinanceiros(vendas as VendaAlerta[])
    }
}

// Pure business logic extracted for testing
export function processAlertasFinanceiros(vendas: VendaAlerta[]): AlertasFinanceirosResumo {
    const hoje = startOfDay(new Date())
    const limiteProximo = addDays(hoje, 3)
    const alertasProcessados: AlertaFinanceiro[] = []

    vendas.forEach(venda => {
        if (!venda.data_prevista_pagamento) return
        const dataPrevista = startOfDay(new Date(venda.data_prevista_pagamento))
        let status: StatusFinanceiro | null = null

        if (isBefore(dataPrevista, hoje)) {
            status = 'atrasado'
        } else if (isSameDay(dataPrevista, hoje)) {
            status = 'hoje'
        } else if (isBefore(dataPrevista, limiteProximo) || isSameDay(dataPrevista, limiteProximo)) {
            status = 'proximo'
        }

        if (status) {
            alertasProcessados.push({
                venda,
                diasAtraso: differenceInDays(hoje, dataPrevista),
                status,
                dataPrevista
            })
        }
    })

    const totalAtrasado = alertasProcessados.filter(a => a.status === 'atrasado').reduce((acc, curr) => acc + curr.venda.total, 0)
    const totalHoje = alertasProcessados.filter(a => a.status === 'hoje').reduce((acc, curr) => acc + curr.venda.total, 0)
    const totalProximo = alertasProcessados.filter(a => a.status === 'proximo').reduce((acc, curr) => acc + curr.venda.total, 0)

    return {
        alertas: alertasProcessados,
        totalAtrasado,
        totalHoje,
        totalProximo
    }
}
