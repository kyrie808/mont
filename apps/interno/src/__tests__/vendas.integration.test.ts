import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createTestServiceClient, cleanTestData } from '@mont/shared'

const supabase = createTestServiceClient()

let produtoA: { id: string; preco: number; custo: number }
let produtoB: { id: string; preco: number; custo: number }
let contaId: string

beforeAll(async () => {
    // Buscar seed data
    const { data: produtos } = await supabase
        .from('produtos')
        .select('id, preco, custo')
        .in('codigo', ['PDQ001', 'BPV001'])
        .order('codigo')

    expect(produtos).toHaveLength(2)
    // BPV001 comes first alphabetically
    produtoB = produtos![0]
    produtoA = produtos![1]

    const { data: contas } = await supabase
        .from('contas')
        .select('id')
        .eq('nome', 'Caixa Teste')
        .single()

    contaId = contas!.id
})

afterEach(async () => {
    await cleanTestData(supabase)
})

afterAll(async () => {
    await cleanTestData(supabase)
})

async function criarContato(nome = 'Cliente Teste') {
    const { data, error } = await supabase
        .from('contatos')
        .insert({
            nome,
            telefone: '11999990000',
            tipo: 'B2C',
            status: 'cliente',
            origem: 'direto',
        })
        .select('id')
        .single()

    if (error) throw error
    return data!
}

describe('Criação de venda completa', () => {
    it('cria venda com itens e calcula total corretamente', async () => {
        const contato = await criarContato()

        // Criar venda
        const { data: venda, error: vendaError } = await supabase
            .from('vendas')
            .insert({
                contato_id: contato.id,
                data: new Date().toISOString(),
                total: produtoA.preco * 2 + produtoB.preco * 3,
                custo_total: produtoA.custo * 2 + produtoB.custo * 3,
                forma_pagamento: 'pix',
                status: 'entregue',
                pago: false,
                valor_pago: 0,
            })
            .select('id, total, custo_total')
            .single()

        expect(vendaError).toBeNull()
        expect(venda!.total).toBe(produtoA.preco * 2 + produtoB.preco * 3) // 25*2 + 15*3 = 95
        expect(venda!.custo_total).toBe(produtoA.custo * 2 + produtoB.custo * 3) // 13*2 + 7.5*3 = 48.5

        // Criar itens
        const { error: itensError } = await supabase.from('itens_venda').insert([
            {
                venda_id: venda!.id,
                produto_id: produtoA.id,
                quantidade: 2,
                preco_unitario: produtoA.preco,
                custo_unitario: produtoA.custo,
                subtotal: produtoA.preco * 2,
            },
            {
                venda_id: venda!.id,
                produto_id: produtoB.id,
                quantidade: 3,
                preco_unitario: produtoB.preco,
                custo_unitario: produtoB.custo,
                subtotal: produtoB.preco * 3,
            },
        ])

        expect(itensError).toBeNull()

        // Verificar itens criados
        const { data: itens } = await supabase
            .from('itens_venda')
            .select('preco_unitario, custo_unitario, quantidade, subtotal')
            .eq('venda_id', venda!.id)
            .order('quantidade')

        expect(itens).toHaveLength(2)
        expect(itens![0].preco_unitario).toBe(produtoA.preco)
        expect(itens![0].custo_unitario).toBe(produtoA.custo)
        expect(itens![1].preco_unitario).toBe(produtoB.preco)
    })

    it('registra pagamento parcial e completo corretamente', async () => {
        const contato = await criarContato('Cliente Pagamento')
        const total = 100

        // Criar venda
        const { data: venda } = await supabase
            .from('vendas')
            .insert({
                contato_id: contato.id,
                data: new Date().toISOString(),
                total,
                forma_pagamento: 'pix',
                status: 'entregue',
                pago: false,
                valor_pago: 0,
            })
            .select('id')
            .single()

        // Pagamento parcial via RPC
        const { error: pagError1 } = await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: venda!.id,
            p_valor: 60,
            p_metodo: 'pix',
            p_data: new Date().toISOString().split('T')[0],
            p_conta_id: contaId,
        })

        expect(pagError1).toBeNull()

        // Verificar estado parcial
        const { data: vendaParcial } = await supabase
            .from('vendas')
            .select('valor_pago, pago')
            .eq('id', venda!.id)
            .single()

        expect(vendaParcial!.valor_pago).toBe(60)
        expect(vendaParcial!.pago).toBe(false)

        // Pagamento do restante
        const { error: pagError2 } = await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: venda!.id,
            p_valor: 40,
            p_metodo: 'dinheiro',
            p_data: new Date().toISOString().split('T')[0],
            p_conta_id: contaId,
        })

        expect(pagError2).toBeNull()

        // Verificar estado final
        const { data: vendaFinal } = await supabase
            .from('vendas')
            .select('valor_pago, pago')
            .eq('id', venda!.id)
            .single()

        expect(vendaFinal!.valor_pago).toBe(100)
        expect(vendaFinal!.pago).toBe(true)
    })

    it('calcula margem de lucro corretamente', async () => {
        const contato = await criarContato('Cliente Margem')

        const custoTotal = produtoA.custo * 1 + produtoB.custo * 2 // 13 + 15 = 28
        const totalVenda = produtoA.preco * 1 + produtoB.preco * 2 // 25 + 30 = 55

        const { data: venda } = await supabase
            .from('vendas')
            .insert({
                contato_id: contato.id,
                data: new Date().toISOString(),
                total: totalVenda,
                custo_total: custoTotal,
                forma_pagamento: 'pix',
                status: 'entregue',
                pago: true,
                valor_pago: totalVenda,
            })
            .select('total, custo_total')
            .single()

        expect(venda!.total).toBe(55)
        expect(venda!.custo_total).toBe(28)
        // Margem = total - custo_total = 27
        expect(venda!.total - (venda!.custo_total ?? 0)).toBe(27)
    })
})
