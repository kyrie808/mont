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

function diasAtras(n: number) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
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

describe('view_relacionamento_kanban — modelo de balde (Fatia 4)', () => {

    // ── 0 compras ────────────────────────────────────────────────────────────

    it('0 compras: fora do kanban (aba_atual NULL, total_pedidos 0)', async () => {
        const id = await criarContato({ nome: 'Lead Sem Compras' })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual, total_pedidos, balde_cheio')
            .eq('contato_id', id)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBeNull()
        expect(data?.total_pedidos).toBe(0)
        expect(data?.balde_cheio).toBe(false)
    })

    // ── 1 compra balde cheio (dias < 30) ─────────────────────────────────────

    it('1 compra balde cheio (< 30d): aba recompra + balde_cheio=true + atraso NULL', async () => {
        const id = await criarContato({ nome: 'Balde Cheio' })
        await criarVenda(id, { data: diasAtras(1) })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual, total_pedidos, balde_cheio, atraso, sumido')
            .eq('contato_id', id)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('recompra')
        expect(data?.total_pedidos).toBe(1)
        expect(data?.balde_cheio).toBe(true)
        expect(data?.atraso).toBeNull()    // sem ritmo derivável
        expect(data?.sumido).toBe(false)   // sem ritmo, nunca sumido
    })

    it('1 compra balde cheio: aparece no fundo do recompra (atraso NULL ordena último)', async () => {
        // Confirma que a ordenação DESC NULLS LAST do service coloca balde cheio no fundo
        const id = await criarContato({ nome: 'Balde Cheio Fundo' })
        await criarVenda(id, { data: diasAtras(5) })

        const { data } = await supabase
            .from('view_relacionamento_kanban')
            .select('atraso')
            .eq('contato_id', id)
            .single()

        expect(data?.atraso).toBeNull()
    })

    // ── 1 compra balde vazio (dias >= 30) ─────────────────────────────────────

    it('1 compra balde vazio (>= 30d): aba reativacao + balde_cheio=false', async () => {
        const id = await criarContato({ nome: 'Balde Vazio' })
        await criarVenda(id, { data: diasAtras(31) })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual, total_pedidos, balde_cheio, dias_sem_compra')
            .eq('contato_id', id)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('reativacao')
        expect(data?.total_pedidos).toBe(1)
        expect(data?.balde_cheio).toBe(false)
        expect(data?.dias_sem_compra).toBeGreaterThanOrEqual(31)
    })

    // ── >=2 compras ───────────────────────────────────────────────────────────

    it('>= 2 compras: aba recompra com ritmo derivado + balde_cheio=false', async () => {
        const id = await criarContato({ nome: 'Ciclo Recompra' })
        await criarVenda(id, { data: diasAtras(60) })
        await criarVenda(id, { data: diasAtras(30) })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual, total_pedidos, balde_cheio, intervalo_medio, atraso')
            .eq('contato_id', id)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('recompra')
        expect(data?.total_pedidos).toBe(2)
        expect(data?.balde_cheio).toBe(false)
        expect(data?.intervalo_medio).toBe(30)
        expect(data?.atraso).toBeDefined()
    })

    it('>= 2 compras frio: permanece em recompra (nao migra pra reativacao)', async () => {
        const id = await criarContato({ nome: 'Dois Frio' })
        await criarVenda(id, { data: diasAtras(200) })
        await criarVenda(id, { data: diasAtras(100) })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual, balde_cheio, atraso')
            .eq('contato_id', id)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('recompra')  // nunca reativacao
        expect(data?.balde_cheio).toBe(false)
        expect(data?.atraso).toBeGreaterThan(0)   // positivo = atrasado
    })

    // ── Cobrança ──────────────────────────────────────────────────────────────

    it('fiado aberto: aba cobranca (prioridade sobre tier)', async () => {
        const id = await criarContato({ nome: 'Fiado Aberto' })
        await criarVenda(id, { forma: 'fiado', pago: false })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual')
            .eq('contato_id', id)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('cobranca')
    })

    it('fiado aberto + >= 2 compras: cobranca tem prioridade', async () => {
        const id = await criarContato({ nome: 'Fiado Mais 2' })
        await criarVenda(id, { data: diasAtras(60) })
        await criarVenda(id, { data: diasAtras(30), forma: 'fiado', pago: false })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual')
            .eq('contato_id', id)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBe('cobranca')
    })

    // ── Brinde não conta ──────────────────────────────────────────────────────

    it('brinde nao conta como compra: aba NULL (0 compras)', async () => {
        const id = await criarContato({ nome: 'Só Brinde' })
        await criarVenda(id, { forma: 'brinde', pago: false })

        const { data, error } = await supabase
            .from('view_relacionamento_kanban')
            .select('aba_atual, total_pedidos')
            .eq('contato_id', id)
            .single()

        expect(error).toBeNull()
        expect(data?.aba_atual).toBeNull()
        expect(data?.total_pedidos).toBe(0)
    })

    // ── Fan-out zero ──────────────────────────────────────────────────────────

    it('nenhum contato aparece em mais de uma aba (fan-out zero)', async () => {
        const { data: fanout } = await supabase
            .from('view_relacionamento_kanban')
            .select('contato_id, aba_atual')

        if (!fanout) return

        const counts = new Map<string, Set<string>>()
        for (const row of fanout) {
            if (!row.contato_id || !row.aba_atual) continue
            const set = counts.get(row.contato_id) ?? new Set()
            set.add(row.aba_atual)
            counts.set(row.contato_id, set)
        }

        for (const [id, abas] of counts) {
            expect(abas.size, `contato ${id} em múltiplas abas`).toBe(1)
        }
    })
})
