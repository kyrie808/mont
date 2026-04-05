import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { createTestServiceClient, cleanTestData, formatCurrency } from '@mont/shared'

const supabase = createTestServiceClient()

let produtoA: { id: string; nome: string; preco: number }
let produtoB: { id: string; nome: string; preco: number }

beforeAll(async () => {
    const { data: produtos } = await supabase
        .from('produtos')
        .select('id, nome, preco')
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

describe('Checkout do catálogo', () => {
    it('RPC criar_pedido cria pedido com valores corretos em reais', async () => {
        // Simular carrinho: 3x Pão de Queijo + 2x Biscoito
        const itens = [
            {
                product_id: produtoA.id,
                product_name: produtoA.nome,
                quantity: 3,
                unit_price: produtoA.preco,
                total: produtoA.preco * 3,
            },
            {
                product_id: produtoB.id,
                product_name: produtoB.nome,
                quantity: 2,
                unit_price: produtoB.preco,
                total: produtoB.preco * 2,
            },
        ]

        const subtotal = produtoA.preco * 3 + produtoB.preco * 2 // 75 + 30 = 105
        const frete = 8.5
        const total = subtotal + frete

        const { data, error } = await supabase.rpc('criar_pedido', {
            p_nome_cliente: 'Cliente Checkout',
            p_telefone_cliente: '11966660001',
            p_endereco_entrega: 'Rua Checkout, 100',
            p_metodo_entrega: 'entrega',
            p_metodo_pagamento: 'pix',
            p_subtotal: subtotal,
            p_frete: frete,
            p_total: total,
            p_observacoes: '',
            p_indicado_por: '',
            p_itens: itens as any,
            p_cep: '01310100',
            p_logradouro: 'Rua Checkout',
            p_numero: '100',
            p_complemento: '',
            p_bairro: 'Centro',
            p_cidade: 'São Paulo',
            p_uf: 'SP',
        })

        expect(error).toBeNull()
        const resultado = data as any

        expect(resultado.total).toBe(total) // 113.5
        expect(resultado.status).toBe('pendente')

        // Verificar que os itens no banco estão em reais
        const { data: catItens } = await supabase
            .from('cat_itens_pedido')
            .select('preco_unitario, total')
            .eq('pedido_id', resultado.id)
            .order('total', { ascending: false })

        expect(catItens).toHaveLength(2)
        expect(catItens![0].preco_unitario).toBe(produtoA.preco) // 25.00
        expect(catItens![0].total).toBe(produtoA.preco * 3) // 75.00
        expect(catItens![1].preco_unitario).toBe(produtoB.preco) // 15.00
        expect(catItens![1].total).toBe(produtoB.preco * 2) // 30.00
    })
})

describe('Cálculos do carrinho (unit)', () => {
    it('calcula subtotal = soma(preco * quantidade)', () => {
        const items = [
            { preco: 25, quantity: 3 },
            { preco: 15, quantity: 2 },
            { preco: 42.5, quantity: 1 },
        ]

        const subtotal = items.reduce((acc, item) => acc + item.preco * item.quantity, 0)
        expect(subtotal).toBe(25 * 3 + 15 * 2 + 42.5 * 1) // 75 + 30 + 42.5 = 147.5
    })

    it('formatCurrency exibe valores monetários corretamente', () => {
        // Intl pode usar non-breaking space — normalizar para comparar
        const normalize = (s: string) => s.replace(/\u00a0/g, ' ')
        expect(normalize(formatCurrency(25))).toBe('R$ 25,00')
        expect(normalize(formatCurrency(1234.5))).toBe('R$ 1.234,50')
        expect(normalize(formatCurrency(0))).toBe('R$ 0,00')
        expect(normalize(formatCurrency(99.99))).toBe('R$ 99,99')
    })

    it('total com frete = subtotal + frete', () => {
        const subtotal = 105
        const frete = 8.5
        expect(subtotal + frete).toBe(113.5)
    })
})
