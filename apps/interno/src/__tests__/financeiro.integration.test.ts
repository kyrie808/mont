import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { createTestServiceClient, cleanTestData } from '@mont/shared/test-utils'

const supabase = createTestServiceClient()

let contaId: string

beforeAll(async () => {
    const { data } = await supabase
        .from('contas')
        .select('id')
        .eq('nome', 'Caixa Teste')
        .single()

    contaId = data!.id
})

afterEach(async () => {
    await cleanTestData(supabase)
})

afterAll(async () => {
    await cleanTestData(supabase)
})

async function criarContato(nome = 'Cliente Financeiro') {
    const { data } = await supabase
        .from('contatos')
        .insert({
            nome,
            telefone: '11955550000',
            tipo: 'B2C',
            status: 'cliente',
            origem: 'direto',
        })
        .select('id')
        .single()
    return data!
}

async function criarVenda(contatoId: string, total: number, opts: {
    pago?: boolean
    formaPagamento?: string
    status?: string
    valorPago?: number
} = {}) {
    const { data } = await supabase
        .from('vendas')
        .insert({
            contato_id: contatoId,
            data: new Date().toISOString(),
            total,
            forma_pagamento: opts.formaPagamento ?? 'pix',
            status: opts.status ?? 'entregue',
            pago: opts.pago ?? false,
            valor_pago: opts.valorPago ?? 0,
        })
        .select('id')
        .single()
    return data!
}

describe('Faturamento exclui brindes', () => {
    it('vendas brinde não aparecem no total a receber', async () => {
        const contato = await criarContato()

        // Venda normal (paga)
        await criarVenda(contato.id, 200, { pago: true, valorPago: 200 })

        // Venda normal (não paga — deve aparecer no a receber)
        await criarVenda(contato.id, 150, { pago: false, status: 'entregue' })

        // Venda brinde (forma_pagamento = 'brinde', pago = false)
        await criarVenda(contato.id, 50, {
            pago: false,
            formaPagamento: 'brinde',
            status: 'entregue',
        })

        // Total a receber deve ser 150 (exclui brinde e já paga)
        const { data } = await supabase.rpc('rpc_total_a_receber_dashboard')
        const result = data as any
        expect(result.total_a_receber).toBe(150)
        expect(result.total_vendas_abertas).toBe(1)
    })
})

describe('Pagamento parcial', () => {
    it('atualiza valor_pago e status corretamente', async () => {
        const contato = await criarContato('Cliente Parcial')
        const venda = await criarVenda(contato.id, 100)

        // Pagamento parcial
        await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: venda.id,
            p_valor: 60,
            p_metodo: 'pix',
            p_data: new Date().toISOString().split('T')[0],
            p_conta_id: contaId,
        })

        const { data: parcial } = await supabase
            .from('vendas')
            .select('valor_pago, pago')
            .eq('id', venda.id)
            .single()

        expect(parcial!.valor_pago).toBe(60)
        expect(parcial!.pago).toBe(false)

        // Pagamento restante
        await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: venda.id,
            p_valor: 40,
            p_metodo: 'dinheiro',
            p_data: new Date().toISOString().split('T')[0],
            p_conta_id: contaId,
        })

        const { data: completo } = await supabase
            .from('vendas')
            .select('valor_pago, pago')
            .eq('id', venda.id)
            .single()

        expect(completo!.valor_pago).toBe(100)
        expect(completo!.pago).toBe(true)
    })
})

describe('Lançamentos financeiros', () => {
    it('registrar_pagamento_venda cria lançamento no fluxo de caixa', async () => {
        const contato = await criarContato('Cliente Lançamento')
        const venda = await criarVenda(contato.id, 80)

        await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: venda.id,
            p_valor: 80,
            p_metodo: 'pix',
            p_data: new Date().toISOString().split('T')[0],
            p_conta_id: contaId,
        })

        // Verificar que lançamento foi criado
        const { data: lancamentos } = await supabase
            .from('lancamentos')
            .select('valor, tipo, venda_id, conta_id')
            .eq('venda_id', venda.id)

        expect(lancamentos).toHaveLength(1)
        expect(lancamentos![0].valor).toBe(80)
        expect(lancamentos![0].tipo).toBe('entrada')
        expect(lancamentos![0].conta_id).toBe(contaId)
    })
})
