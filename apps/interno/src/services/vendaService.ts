import { supabase } from '../lib/supabase'
import type { VendaInsert, VendaUpdate, ItemVendaInsert } from '@mont/shared'
import type { DomainVenda, CreateVenda, UpdateVenda, VendasMetrics } from '../types/domain'
import { toDomainVenda, type VendaRowWithRelations } from './mappers'
import { isToday } from 'date-fns'


export const vendaService = {
    async getVendas(startDate?: Date, endDate?: Date, includePending = false, search?: string, excludeCatalogo = false): Promise<DomainVenda[]> {
        let query = supabase
            .from('vendas')
            .select(`
                *,
                contato:contatos(id, nome, telefone, origem, indicado_por_id, status),
                itens:itens_venda(*, produto:produtos(id, nome, codigo)),
                pagamentos:pagamentos_venda(*)
            `)
            .order('criado_em', { ascending: false })

        if (excludeCatalogo) {
            query = query.neq('origem', 'catalogo')
        }

        if (search) {
            query = query.textSearch('fts', search, { type: 'websearch', config: 'simple' })
        }

        if (includePending && (startDate || endDate)) {
            const conditions: string[] = []
            if (startDate && endDate) {
                const startStr = startDate.toISOString().split('T')[0]
                const endStr = endDate.toISOString().split('T')[0]
                conditions.push(`and(data.gte.${startStr},data.lte.${endStr})`)
            }
            conditions.push(`status.eq.pendente`)
            conditions.push(`pago.eq.false`)
            query = query.or(conditions.join(','))
        } else {
            if (startDate) query = query.gte('data', startDate.toISOString().split('T')[0])
            if (endDate) query = query.lte('data', endDate.toISOString().split('T')[0])
        }

        const { data, error } = await query
        if (error) throw error

        return (data || []).map((v: any) => toDomainVenda(v as unknown as VendaRowWithRelations))
    },

    async getVendaById(id: string): Promise<DomainVenda> {
        const { data, error } = await supabase
            .from('vendas')
            .select(`
                *,
                contato:contatos(id, nome, telefone, tipo, status),
                itens:itens_venda(*, produto:produtos(id, nome, codigo, preco, unidade)),
                pagamentos:pagamentos_venda(*)
            `)
            .eq('id', id)
            .single()

        if (error) throw error
        return toDomainVenda(data as unknown as VendaRowWithRelations)
    },

    async createVenda(data: CreateVenda): Promise<DomainVenda> {
        // 1. Buscar custos dos produtos para cálculo de lucro
        const produtoIds = data.itens.map(it => it.produtoId)
        const { data: produtos } = await supabase
            .from('produtos')
            .select('id, custo')
            .in('id', produtoIds)

        const custoPorProduto = Object.fromEntries(
            (produtos || []).map((p: any) => [p.id, p.custo || 0])
        )

        // 2. Calcular custo total da venda
        const custoTotal = data.itens.reduce((acc, it) =>
            acc + (custoPorProduto[it.produtoId] || 0) * it.quantidade, 0
        )

        const vInsert: VendaInsert = {
            contato_id: data.contatoId,
            data: data.data,
            status: 'pendente',
            total: data.itens.reduce((acc, item) => acc + item.subtotal, 0) + (data.taxaEntrega || 0),
            pago: false,
            forma_pagamento: data.formaPagamento,
            taxa_entrega: data.taxaEntrega || 0,
            data_prevista_pagamento: data.dataPrevistaPagamento,
            custo_total: custoTotal
        }

        const { data: vendaData, error: vendaError } = await supabase.from('vendas').insert(vInsert).select().single()
        if (vendaError) throw vendaError

        if (data.itens.length > 0) {
            const iInserts: ItemVendaInsert[] = data.itens.map(it => ({
                venda_id: vendaData.id,
                produto_id: it.produtoId,
                quantidade: it.quantidade,
                preco_unitario: it.precoUnitario,
                subtotal: it.subtotal,
                custo_unitario: custoPorProduto[it.produtoId] || 0
            }))
            const { error: itensError } = await supabase.from('itens_venda').insert(iInserts)
            if (itensError) throw itensError
        }

        return this.getVendaById(vendaData.id)
    },

    async updateVenda(id: string, data: UpdateVenda): Promise<DomainVenda> {
        const vUpdate: VendaUpdate = {}
        if (data.contatoId) vUpdate.contato_id = data.contatoId
        if (data.data) vUpdate.data = data.data
        if (data.formaPagamento) vUpdate.forma_pagamento = data.formaPagamento
        if (data.taxaEntrega !== undefined) vUpdate.taxa_entrega = data.taxaEntrega
        if (data.status) vUpdate.status = data.status
        if (data.pago !== undefined) vUpdate.pago = data.pago

        const { error } = await supabase.from('vendas').update(vUpdate).eq('id', id)
        if (error) throw error

        return this.getVendaById(id)
    },

    async cancelVenda(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('vendas')
            .update({ status: 'cancelada', pago: false })
            .eq('id', id)

        if (error) throw error
        return true
    },

    async deleteVenda(id: string): Promise<boolean> {
        // Deletar lancamentos primeiro (FK sem CASCADE)
        const { error: lancError } = await supabase.from('lancamentos').delete().eq('venda_id', id)
        if (lancError) throw lancError

        // vendas DELETE cascadeia para itens_venda e pagamentos_venda
        const { error } = await supabase.from('vendas').delete().eq('id', id)
        if (error) throw error
        return true
    },

    async addPagamento(vendaId: string, valor: number, metodo: string, data: string, contaId: string, observacao?: string): Promise<boolean> {
        // RPC atômica: pagamento + lançamento em uma única transação.
        // Se qualquer parte falhar, nada é commitado.
        const dataDate = data.includes('T') ? data.split('T')[0] : data
        const { error } = await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: vendaId,
            p_valor: valor,
            p_metodo: metodo,
            p_data: dataDate,
            p_conta_id: contaId,
            p_observacao: observacao ?? undefined
        })

        if (error) throw error
        return true
    },

    async getTotalAReceber(): Promise<number> {
        const { data, error } = await supabase.rpc('rpc_total_a_receber_dashboard')
        if (error) return 0
        return Number(data) || 0
    },

    calculateKPIs(vendas: DomainVenda[]): VendasMetrics {
        const totalVendas = vendas.length
        const faturamentoTotal = vendas.filter(v => v.pago).reduce((acc, v) => acc + v.total, 0)
        const faturamentoDia = vendas.filter(v => isToday(new Date(v.data)) && v.pago).reduce((acc, v) => acc + v.total, 0)

        const produtosVendidos = vendas.reduce((acc: any, v: DomainVenda) => {
            v.itens?.forEach((item: any) => {
                acc.total += item.quantidade
                if (item.produto?.nome.includes('1kg')) acc.pote1kg += item.quantidade
                if (item.produto?.nome.includes('4kg')) acc.pote4kg += item.quantidade
            })
            return acc
        }, { total: 0, pote1kg: 0, pote4kg: 0 })

        return {
            faturamentoTotal,
            faturamentoDia,
            faturamentoMes: faturamentoTotal,
            totalVendas,
            vendasMes: totalVendas,
            ticketMedio: totalVendas > 0 ? faturamentoTotal / totalVendas : 0,
            produtosVendidos,
            recebido: faturamentoTotal,
            aReceber: vendas.filter(v => !v.pago && v.status !== 'cancelada' && v.formaPagamento !== 'brinde').reduce((acc, v) => acc + v.total, 0),
            entregasPendentes: vendas.filter(v => v.status === 'pendente').length,
            entregasRealizadas: vendas.filter(v => v.status === 'entregue').length,
            lucroMes: vendas.filter(v => v.pago).reduce((acc, v) => acc + (v.total - (v.custoTotal || 0)), 0)
        }
    },

    async deleteUltimoPagamento(vendaId: string): Promise<boolean> {
        // 1. Buscar último pagamento
        const { data: pagamento, error: fetchError } = await supabase
            .from('pagamentos_venda')
            .select('id, valor')
            .eq('venda_id', vendaId)
            .order('criado_em', { ascending: false })
            .limit(1)
            .single()

        if (fetchError || !pagamento) throw fetchError || new Error('Nenhum pagamento encontrado')

        // 2. Buscar lançamento correspondente por ID e deletar
        const { data: lancamento } = await supabase
            .from('lancamentos')
            .select('id')
            .eq('venda_id', vendaId)
            .eq('origem', 'venda')
            .eq('valor', pagamento.valor)
            .order('criado_em', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (lancamento) {
            const { error: lancError } = await supabase
                .from('lancamentos')
                .delete()
                .eq('id', lancamento.id)

            if (lancError) console.error('Erro ao deletar lançamento:', lancError)
        }

        // 3. Deletar o pagamento — trigger recalcula valor_pago e pago
        const { error: delError } = await supabase
            .from('pagamentos_venda')
            .delete()
            .eq('id', pagamento.id)

        if (delError) throw delError
        return true
    },

    async quitarVenda(id: string, metodo: string, contaId: string, observacao?: string): Promise<DomainVenda> {
        // Busca a venda para calcular saldo restante
        const venda = await this.getVendaById(id)
        const saldo = venda.total - venda.valorPago
        if (saldo <= 0) return venda

        // Registra pagamento do saldo restante — o trigger cuida de marcar pago=true
        const dataPagamento = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0]
        await this.addPagamento(id, saldo, metodo, dataPagamento, contaId, observacao)

        return this.getVendaById(id)
    }
}
