import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { createTestServiceClient, cleanTestData } from '@mont/shared/test-utils'

const supabase = createTestServiceClient()

let produtoA: { id: string; nome: string; preco: number; custo: number }
let produtoB: { id: string; nome: string; preco: number; custo: number }

beforeAll(async () => {
    const { data: produtos } = await supabase
        .from('produtos')
        .select('id, nome, preco, custo')
        .in('codigo', ['PDQ001', 'BPV001'])
        .order('codigo')

    expect(produtos).toHaveLength(2)
    produtoB = produtos![0]
    produtoA = produtos![1]
})

afterEach(async () => {
    await cleanTestData(supabase)
})

afterAll(async () => {
    await cleanTestData(supabase)
})

describe('Sync bidirecional cat_pedidos <-> vendas', () => {
    it('RPC criar_pedido cria cat_pedidos + venda + itens_venda', async () => {
        const itens = [
            {
                product_id: produtoA.id,
                product_name: produtoA.nome,
                quantity: 2,
                unit_price: produtoA.preco,
                total: produtoA.preco * 2,
            },
            {
                product_id: produtoB.id,
                product_name: produtoB.nome,
                quantity: 1,
                unit_price: produtoB.preco,
                total: produtoB.preco * 1,
            },
        ]

        const totalPedido = produtoA.preco * 2 + produtoB.preco * 1 // 50 + 15 = 65

        const { data, error } = await supabase.rpc('criar_pedido', {
            p_nome_cliente: 'Teste Sync',
            p_telefone_cliente: '11988880001',
            p_endereco_entrega: 'Rua Teste, 123',
            p_metodo_entrega: 'entrega',
            p_metodo_pagamento: 'pix',
            p_subtotal: totalPedido,
            p_frete: 5,
            p_total: totalPedido + 5,
            p_observacoes: 'Teste integração',
            p_indicado_por: '',
            p_itens: itens as any,
            p_cep: '01310100',
            p_logradouro: 'Rua Teste',
            p_numero: '123',
            p_complemento: '',
            p_bairro: 'Centro',
            p_cidade: 'São Paulo',
            p_uf: 'SP',
        })

        expect(error).toBeNull()
        const pedidoId = (data as any).id

        // 1. Verificar cat_pedidos criado
        const { data: pedido } = await supabase
            .from('cat_pedidos')
            .select('total, subtotal, frete, status')
            .eq('id', pedidoId)
            .single()

        expect(pedido!.total).toBe(totalPedido + 5)
        expect(pedido!.subtotal).toBe(totalPedido)
        expect(pedido!.frete).toBe(5)
        expect(pedido!.status).toBe('pendente')

        // 2. Verificar cat_itens_pedido criados
        const { data: catItens } = await supabase
            .from('cat_itens_pedido')
            .select('preco_unitario, total, quantidade')
            .eq('pedido_id', pedidoId)
            .order('quantidade')

        expect(catItens).toHaveLength(2)
        expect(catItens![0].preco_unitario).toBe(produtoB.preco) // qty 1
        expect(catItens![1].preco_unitario).toBe(produtoA.preco) // qty 2

        // 3. Verificar venda criada automaticamente pelo RPC
        const { data: venda } = await supabase
            .from('vendas')
            .select('id, total, custo_total, origem, cat_pedido_id, pago')
            .eq('cat_pedido_id', pedidoId)
            .single()

        expect(venda).not.toBeNull()
        expect(venda!.total).toBe(totalPedido + 5)
        expect(venda!.origem).toBe('catalogo')
        expect(venda!.pago).toBe(false)
        // Custo: produtoA.custo*2 + produtoB.custo*1 = 13*2 + 7.5*1 = 33.5
        expect(venda!.custo_total).toBe(produtoA.custo * 2 + produtoB.custo * 1)

        // 4. Verificar itens_venda criados com preço E custo
        const { data: itensVenda } = await supabase
            .from('itens_venda')
            .select('preco_unitario, custo_unitario, quantidade')
            .eq('venda_id', venda!.id)
            .order('quantidade')

        expect(itensVenda).toHaveLength(2)
        expect(itensVenda![0].custo_unitario).toBe(produtoB.custo)
        expect(itensVenda![1].custo_unitario).toBe(produtoA.custo)
        // Valores em reais — sem conversão
        expect(itensVenda![1].preco_unitario).toBe(produtoA.preco)
    })

    it('trigger cria venda quando cat_pedido muda para entregue', async () => {
        // Criar pedido via RPC (status = pendente, SEM venda automática)
        const itens = [
            {
                product_id: produtoA.id,
                product_name: produtoA.nome,
                quantity: 1,
                unit_price: produtoA.preco,
                total: produtoA.preco * 1,
            },
        ]

        const { data, error } = await supabase.rpc('criar_pedido', {
            p_nome_cliente: 'Teste Trigger',
            p_telefone_cliente: '11977770001',
            p_endereco_entrega: 'Rua Trigger, 50',
            p_metodo_entrega: 'entrega',
            p_metodo_pagamento: 'pix',
            p_subtotal: produtoA.preco,
            p_frete: 0,
            p_total: produtoA.preco,
            p_observacoes: '',
            p_indicado_por: '',
            p_itens: itens as any,
            p_cep: '01310100',
            p_logradouro: 'Rua Trigger',
            p_numero: '50',
            p_complemento: '',
            p_bairro: 'Centro',
            p_cidade: 'São Paulo',
            p_uf: 'SP',
        })

        expect(error).toBeNull()
        const pedidoId = (data as any).id

        // RPC criar_pedido já cria a venda — deletar para testar o trigger isoladamente
        await supabase.from('itens_venda').delete().eq(
            'venda_id',
            (await supabase.from('vendas').select('id').eq('cat_pedido_id', pedidoId).single()).data!.id,
        )
        await supabase.from('lancamentos').delete().eq(
            'venda_id',
            (await supabase.from('vendas').select('id').eq('cat_pedido_id', pedidoId).single()).data!.id,
        )
        await supabase.from('vendas').delete().eq('cat_pedido_id', pedidoId)

        // Resetar status para pendente
        await supabase.from('cat_pedidos').update({ status: 'pendente' }).eq('id', pedidoId)

        // Agora simular admin marcando como entregue — dispara trigger
        const { error: updateError } = await supabase
            .from('cat_pedidos')
            .update({ status: 'entregue' })
            .eq('id', pedidoId)

        expect(updateError).toBeNull()

        // Verificar que trigger criou a venda
        const { data: venda } = await supabase
            .from('vendas')
            .select('id, total, origem, cat_pedido_id, pago')
            .eq('cat_pedido_id', pedidoId)
            .single()

        expect(venda).not.toBeNull()
        expect(venda!.total).toBe(produtoA.preco)
        expect(venda!.origem).toBe('catalogo')
        expect(venda!.pago).toBe(true)

        // Verificar que NÃO caiu na tabela de pendentes
        const { data: pendentes } = await supabase
            .from('cat_pedidos_pendentes_vinculacao')
            .select('id')
            .eq('cat_pedido_id', pedidoId)

        expect(pendentes).toHaveLength(0)
    })

    it('sync venda status → cat_pedidos via trigger', async () => {
        // Criar pedido via RPC (cria cat_pedidos + venda vinculada)
        const itens = [
            {
                product_id: produtoB.id,
                product_name: produtoB.nome,
                quantity: 2,
                unit_price: produtoB.preco,
                total: produtoB.preco * 2,
            },
        ]

        const { data, error } = await supabase.rpc('criar_pedido', {
            p_nome_cliente: 'Teste Reverse Sync',
            p_telefone_cliente: '11966660002',
            p_endereco_entrega: 'Rua Reverse, 200',
            p_metodo_entrega: 'entrega',
            p_metodo_pagamento: 'pix',
            p_subtotal: produtoB.preco * 2,
            p_frete: 0,
            p_total: produtoB.preco * 2,
            p_observacoes: '',
            p_indicado_por: '',
            p_itens: itens as any,
            p_cep: '01310100',
            p_logradouro: 'Rua Reverse',
            p_numero: '200',
            p_complemento: '',
            p_bairro: 'Centro',
            p_cidade: 'São Paulo',
            p_uf: 'SP',
        })

        expect(error).toBeNull()
        const pedidoId = (data as any).id

        // Buscar venda vinculada
        const { data: venda } = await supabase
            .from('vendas')
            .select('id')
            .eq('cat_pedido_id', pedidoId)
            .single()

        expect(venda).not.toBeNull()

        // Cancelar a venda no interno — trigger deve sincronizar para cat_pedidos
        await supabase
            .from('vendas')
            .update({ status: 'cancelada' })
            .eq('id', venda!.id)

        const { data: pedidoCancelado } = await supabase
            .from('cat_pedidos')
            .select('status, status_pagamento')
            .eq('id', pedidoId)
            .single()

        expect(pedidoCancelado!.status).toBe('cancelado')

        // Atualizar pago na venda — trigger deve sincronizar status_pagamento
        await supabase
            .from('vendas')
            .update({ status: 'entregue', pago: true })
            .eq('id', venda!.id)

        const { data: pedidoPago } = await supabase
            .from('cat_pedidos')
            .select('status, status_pagamento')
            .eq('id', pedidoId)
            .single()

        expect(pedidoPago!.status).toBe('entregue')
        expect(pedidoPago!.status_pagamento).toBe('pago')
    })
})
