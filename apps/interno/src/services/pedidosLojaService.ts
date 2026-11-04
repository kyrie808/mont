import { supabase } from '../lib/supabase'
import type { ItemPedidoLoja } from '../utils/pedidosLoja'

/* PEDIDOS DA LOJA — o pedido que o cliente mandou pela loja (apps/loja → WhatsApp) e que só
   vira venda quando confirmado aqui (RPC loja_confirmar_pedido, idempotente). 02/11/2026. */

export type FormaPagamentoLoja = 'pix' | 'dinheiro' | 'cartao'

export interface PedidoLoja {
    id: string
    numero: number
    nome: string
    telefone: string
    endereco: string
    logradouro: string | null
    numeroEndereco: string | null
    total: number
    criadoEm: string
    ofertasWhatsapp: boolean
    /** Cliente já cadastrado com este telefone (ligado na hora do pedido). */
    cadastro: { id: string; nome: string; logradouro: string | null; numero: string | null; endereco: string | null } | null
    itens: ItemPedidoLoja[]
}

export interface ConfirmarPedidoLoja {
    frete: number
    dataEntrega: string
    forma: FormaPagamentoLoja
    atualizarEndereco: boolean
}

export const pedidosLojaService = {
    /** Quantos pedidos da loja esperam confirmação (contador do menu). */
    async contarPendentes(): Promise<number> {
        const { count, error } = await supabase
            .from('cat_pedidos')
            .select('id', { count: 'exact', head: true })
            .eq('canal', 'loja')
            .eq('status', 'pendente')
        if (error) throw error
        return count ?? 0
    },

    /** Fila de pedidos da loja esperando confirmação, mais novos primeiro. */
    async listarPendentes(): Promise<PedidoLoja[]> {
        const { data, error } = await supabase
            .from('cat_pedidos')
            .select(`
                id, numero_pedido, nome_cliente, telefone_cliente, endereco_entrega, logradouro, numero,
                total, criado_em, ofertas_whatsapp,
                cadastro:contatos(id, nome, logradouro, numero, endereco),
                itens:cat_itens_pedido(id, produto_id, nome_produto, quantidade, total, combo_id, combo_instancia)
            `)
            .eq('canal', 'loja')
            .eq('status', 'pendente')
            .order('criado_em', { ascending: false })
        if (error) throw error

        return (data || []).map((p) => ({
            id: p.id,
            numero: p.numero_pedido,
            nome: p.nome_cliente,
            telefone: p.telefone_cliente,
            endereco: p.endereco_entrega ?? '',
            logradouro: p.logradouro,
            numeroEndereco: p.numero,
            total: Number(p.total ?? 0),
            criadoEm: p.criado_em ?? '',
            ofertasWhatsapp: p.ofertas_whatsapp,
            cadastro: p.cadastro,
            itens: p.itens.map((i) => ({
                id: i.id,
                produtoId: i.produto_id,
                nome: i.nome_produto,
                quantidade: i.quantidade,
                total: Number(i.total ?? 0),
                comboId: i.combo_id,
                comboInstancia: i.combo_instancia,
            })),
        }))
    },

    /** Vira venda pendente (origem 'loja'). Tocar duas vezes devolve a mesma venda. */
    async confirmar(pedidoId: string, dados: ConfirmarPedidoLoja): Promise<{ vendaId: string; total: number }> {
        const { data: vendaId, error } = await supabase.rpc('loja_confirmar_pedido', {
            p_pedido_id: pedidoId,
            p_taxa_entrega: dados.frete,
            p_data_entrega: dados.dataEntrega,
            p_forma_pagamento: dados.forma,
            p_atualizar_endereco: dados.atualizarEndereco,
        })
        if (error) throw error
        const { data: venda, error: erroVenda } = await supabase.from('vendas').select('total').eq('id', vendaId).single()
        if (erroVenda) throw erroVenda
        return { vendaId, total: Number(venda.total) }
    },

    async descartar(pedidoId: string): Promise<void> {
        const { error } = await supabase.rpc('loja_descartar_pedido', { p_pedido_id: pedidoId })
        if (error) throw error
    },
}
