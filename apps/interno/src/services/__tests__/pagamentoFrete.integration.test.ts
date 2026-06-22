import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createTestClient, cleanTestData } from '@mont/shared/test-utils'

/**
 * Integração (PRODUÇÃO, conta-teste) do split de frete em registrar_pagamento_venda.
 *
 * Verifica que o pagamento de uma venda COM frete gera DOIS lançamentos —
 * produto (RECEBIMENTO_VENDA) + frete (RECEBIMENTO_FRETE) — proporcionalmente,
 * e que uma venda SEM frete segue gerando um único lançamento.
 *
 * Cleanup automático por created_by (cobre contas/contatos/vendas/lancamentos/
 * pagamentos_venda). Janela: manual, nunca com o Gilmar usando (ver tdd-mont-pragmatico).
 */

type Client = Awaited<ReturnType<typeof createTestClient>>

let supabase: Client

const hoje = () => new Date().toISOString().slice(0, 10)

async function criarConta() {
    const { data, error } = await supabase
        .from('contas')
        .insert({ nome: `Conta Teste ${Date.now()}`, tipo: 'dinheiro', ativo: true })
        .select('id').single()
    if (error) throw error
    return data.id as string
}

async function criarContato() {
    const { data, error } = await supabase
        .from('contatos')
        .insert({ nome: 'Cliente Teste Frete', telefone: '11955550000', tipo: 'B2C', status: 'cliente', origem: 'direto' })
        .select('id').single()
    if (error) throw error
    return data.id as string
}

async function criarVenda(total: number, taxaEntrega: number) {
    const contatoId = await criarContato()
    const { data, error } = await supabase
        .from('vendas')
        .insert({
            contato_id: contatoId, data: hoje(), total, taxa_entrega: taxaEntrega,
            status: 'entregue', pago: false, forma_pagamento: 'venda', custo_total: 0,
        })
        .select('id').single()
    if (error) throw error
    return data.id as string
}

async function lancamentosDaVenda(vendaId: string) {
    const { data, error } = await supabase
        .from('lancamentos')
        .select('valor, pagamento_id, plano:plano_de_contas(codigo)')
        .eq('venda_id', vendaId)
    if (error) throw error
    return (data ?? []).map((l) => ({
        valor: Number(l.valor),
        pagamentoId: l.pagamento_id as string | null,
        codigo: (l.plano as unknown as { codigo: string } | null)?.codigo ?? null,
    }))
}

beforeAll(async () => {
    supabase = await createTestClient()
})

afterEach(async () => {
    await cleanTestData(supabase)
})

describe('registrar_pagamento_venda — split de frete (integração)', () => {
    it('venda COM frete, pagamento integral → 2 lançamentos (produto + frete) somando o valor', async () => {
        const contaId = await criarConta()
        const vendaId = await criarVenda(100, 10) // produto 90 + frete 10

        const { error } = await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: vendaId, p_valor: 100, p_metodo: 'pix', p_data: hoje(), p_conta_id: contaId,
        })
        expect(error).toBeNull()

        const lcs = await lancamentosDaVenda(vendaId)
        expect(lcs).toHaveLength(2)

        const produto = lcs.find((l) => l.codigo === 'RECEBIMENTO_VENDA')
        const frete = lcs.find((l) => l.codigo === 'RECEBIMENTO_FRETE')
        expect(produto?.valor).toBe(90)
        expect(frete?.valor).toBe(10)
        // soma exata + link explícito ao pagamento
        expect((produto?.valor ?? 0) + (frete?.valor ?? 0)).toBe(100)
        expect(produto?.pagamentoId).toBeTruthy()
        expect(frete?.pagamentoId).toBeTruthy()
        expect(produto?.pagamentoId).toBe(frete?.pagamentoId)
    })

    it('venda COM frete, pagamento PARCIAL → split proporcional, soma exata', async () => {
        const contaId = await criarConta()
        const vendaId = await criarVenda(100, 10)

        // paga 50 de 100 → frete = round(50 * 10/100) = 5, produto = 45
        const { error } = await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: vendaId, p_valor: 50, p_metodo: 'pix', p_data: hoje(), p_conta_id: contaId,
        })
        expect(error).toBeNull()

        const lcs = await lancamentosDaVenda(vendaId)
        const produto = lcs.find((l) => l.codigo === 'RECEBIMENTO_VENDA')
        const frete = lcs.find((l) => l.codigo === 'RECEBIMENTO_FRETE')
        expect(frete?.valor).toBe(5)
        expect(produto?.valor).toBe(45)
        expect((produto?.valor ?? 0) + (frete?.valor ?? 0)).toBe(50)
    })

    it('venda SEM frete → 1 lançamento único (RECEBIMENTO_VENDA)', async () => {
        const contaId = await criarConta()
        const vendaId = await criarVenda(100, 0)

        const { error } = await supabase.rpc('registrar_pagamento_venda', {
            p_venda_id: vendaId, p_valor: 100, p_metodo: 'pix', p_data: hoje(), p_conta_id: contaId,
        })
        expect(error).toBeNull()

        const lcs = await lancamentosDaVenda(vendaId)
        expect(lcs).toHaveLength(1)
        expect(lcs[0].codigo).toBe('RECEBIMENTO_VENDA')
        expect(lcs[0].valor).toBe(100)
        expect(lcs[0].pagamentoId).toBeTruthy()
    })
})
