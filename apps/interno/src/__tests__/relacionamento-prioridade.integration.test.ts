import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanTestData, createTestServiceClient } from '@mont/shared/test-utils'

const supabase = createTestServiceClient()

function telefoneUnico() {
    return `1199${Math.floor(Math.random() * 9000000 + 1000000)}`
}

async function criarContato(args?: Partial<{ nome: string; tipo: 'B2B' | 'B2C'; criadoEm: string }>) {
    const { data, error } = await supabase
        .from('contatos')
        .insert({
            nome: args?.nome ?? 'Contato Relacionamento',
            telefone: telefoneUnico(),
            tipo: args?.tipo ?? 'B2C',
            status: 'cliente',
            origem: 'direto',
            criado_em: args?.criadoEm,
        })
        .select('id')
        .single()

    if (error || !data) throw new Error(error?.message ?? 'Falha ao criar contato')
    return data.id
}

async function criarVenda(contatoId: string, args: Partial<{ data: string; forma: string; pago: boolean; status: string }> = {}) {
    const { error } = await supabase.from('vendas').insert({
        contato_id: contatoId,
        data: args.data ?? new Date().toISOString().slice(0, 10),
        total: 100,
        forma_pagamento: args.forma ?? 'pix',
        status: args.status ?? 'entregue',
        pago: args.pago ?? true,
        valor_pago: args.pago === false ? 0 : 100,
    })

    if (error) throw new Error(error.message)
}

beforeEach(async () => {
    await cleanTestData(supabase)
})

afterEach(async () => {
    await cleanTestData(supabase)
})

afterAll(async () => {
    await cleanTestData(supabase)
})

describe('view_relacionamento_kanban prioridade', () => {
    it('cliente sem fiado e sem inatividade fica em recompra', async () => {
        const contatoId = await criarContato({ nome: 'Cliente Recompra' })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual, status_relacionamento')
            .eq('contato_id', contatoId)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('recompra')
        expect(data?.status_relacionamento).toBe('a_contatar')
    })

    it('cliente com fiado em aberto cai em cobranca', async () => {
        const contatoId = await criarContato({ nome: 'Cliente Cobranca' })
        await criarVenda(contatoId, { forma: 'fiado', pago: false, status: 'entregue' })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual')
            .eq('contato_id', contatoId)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('cobranca')
    })

    it('com fiado em aberto + inatividade simultanea, cobranca tem prioridade', async () => {
        const dataAntiga = new Date()
        dataAntiga.setDate(dataAntiga.getDate() - 90)

        const contatoId = await criarContato({
            nome: 'Cliente Prioridade Cobranca',
            criadoEm: dataAntiga.toISOString(),
        })

        await criarVenda(contatoId, {
            forma: 'fiado',
            pago: false,
            status: 'entregue',
            data: dataAntiga.toISOString().slice(0, 10),
        })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual')
            .eq('contato_id', contatoId)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('cobranca')
    })

    it('cliente antigo sem fiado e sem venda recente cai em reativacao', async () => {
        const dataAntiga = new Date()
        dataAntiga.setDate(dataAntiga.getDate() - 90)

        const contatoId = await criarContato({
            nome: 'Cliente Reativacao Sem Venda',
            criadoEm: dataAntiga.toISOString(),
        })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual')
            .eq('contato_id', contatoId)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('reativacao')
    })
})
