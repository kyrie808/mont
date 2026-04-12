import { supabase } from '../lib/supabase'
import type { VendaInsert, VendaUpdate, ItemVendaInsert } from '@mont/shared'
import type { DomainVenda, CreateVenda, UpdateVenda, VendasMetrics } from '../types/domain'
import { toDomainVenda, type VendaRowWithRelations } from './mappers'
import { isToday } from 'date-fns'

/**
 * Sincroniza alterações da tabela `vendas` → `cat_pedidos`.
 * Chamado após toda ação de status/pagamento no sistema interno.
 * Se a venda não for de origem catálogo, não faz nada.
 * Erros são logados mas nunca bloqueiam a operação principal.
 */
async function _syncCatPedido(
    vendaId: string,
    update: { status?: string; status_pagamento?: string }
): Promise<void> {
    try {
        // Buscar cat_pedido_id da venda
        const { data: venda, error: fetchErr } = await supabase
            .from('vendas')
            .select('cat_pedido_id, origem')
            .eq('id', vendaId)
            .single()

        if (fetchErr || !venda?.cat_pedido_id || venda.origem !== 'catalogo') return

        // Mapear status interno → catálogo (cancelada → cancelado)
        const catUpdate: Record<string, string> = {}
        if (update.status) {
            catUpdate.status = update.status === 'cancelada' ? 'cancelado' : update.status
        }
        if (update.status_pagamento) {
            catUpdate.status_pagamento = update.status_pagamento
        }

        const { error: syncErr } = await supabase
            .from('cat_pedidos')
            .update(catUpdate)
            .eq('id', venda.cat_pedido_id)

        if (syncErr) {
            console.error('[sync cat_pedidos] Falha ao sincronizar:', syncErr, { vendaId, catPedidoId: venda.cat_pedido_id, update: catUpdate })
        }
    } catch (err) {
        console.error('[sync cat_pedidos] Erro inesperado:', err)
    }
}

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

        // Sync status change to cat_pedidos if applicable
        if (data.status) {
            await _syncCatPedido(id, { status: data.status })
        }
        if (data.pago !== undefined) {
            await _syncCatPedido(id, { status_pagamento: data.pago ? 'pago' : 'pendente' })
        }

        return this.getVendaById(id)
    },

    async cancelVenda(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('vendas')
            .update({ status: 'cancelada', pago: false })
            .eq('id', id)

        if (error) throw error

        // Sync: cancelada (feminino) → cancelado (masculino) in cat_pedidos
        await _syncCatPedido(id, { status: 'cancelada' })

        return true
    },

    async deleteVenda(id: string): Promise<boolean> {
        // 1. Capturar cat_pedido_id ANTES de deletar (SET NULL na FK apagaria o vínculo)
        const { data: vendaRow } = await supabase
            .from('vendas')
            .select('cat_pedido_id, origem')
            .eq('id', id)
            .single()

        const catPedidoId = vendaRow?.origem === 'catalogo' ? vendaRow.cat_pedido_id : null

        // 2. Deletar lancamentos primeiro (FK sem CASCADE)
        const { error: lancError } = await supabase.from('lancamentos').delete().eq('venda_id', id)
        if (lancError) throw lancError

        // 3. vendas DELETE cascadeia para itens_venda e pagamentos_venda
        const { error } = await supabase.from('vendas').delete().eq('id', id)
        if (error) throw error

        // 4. Limpar cat_pedidos se era venda de catálogo
        if (catPedidoId) {
            try {
                // cat_pedidos_pendentes_vinculacao tem NO ACTION — limpar primeiro
                await supabase.from('cat_pedidos_pendentes_vinculacao').delete().eq('cat_pedido_id', catPedidoId)
                // cat_itens_pedido tem CASCADE — deletar cat_pedidos basta
                const { error: catErr } = await supabase.from('cat_pedidos').delete().eq('id', catPedidoId)
                if (catErr) {
                    console.error('[deleteVenda] Falha ao deletar cat_pedidos:', catErr, { catPedidoId })
                }
            } catch (err) {
                console.error('[deleteVenda] Erro inesperado ao limpar cat_pedidos:', err)
            }
        }

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

        // After payment, DB trigger may have set pago=true. Check and sync.
        const { data: updatedVenda } = await supabase
            .from('vendas')
            .select('pago')
            .eq('id', vendaId)
            .single()

        if (updatedVenda?.pago) {
            await _syncCatPedido(vendaId, { status_pagamento: 'pago' })
        }

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

        // After removing payment, DB trigger may have set pago=false. Check and sync.
        const { data: updatedVenda } = await supabase
            .from('vendas')
            .select('pago')
            .eq('id', vendaId)
            .single()

        if (updatedVenda && !updatedVenda.pago) {
            await _syncCatPedido(vendaId, { status_pagamento: 'pendente' })
        }

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
