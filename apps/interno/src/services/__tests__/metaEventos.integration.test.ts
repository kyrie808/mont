import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createTestClient, cleanTestData } from '@mont/shared/test-utils'

/**
 * Integração (PRODUÇÃO, conta-teste) do trigger de enfileiramento de Purchase → meta_eventos.
 * Migrations: 20260702120000_meta_capi_schema + 20260702120500_meta_capi_enfileira_purchase.
 *
 * Regras cobertas (blueprint §2 / §9.1 / §7):
 *   - venda entregue não-brinde → enfileira Purchase pendente (event_id = 'venda_<id>')
 *   - brinde entregue → NÃO enfileira
 *   - fiado entregue → enfileira (incluído)
 *   - origem 'catalogo' entregue → NÃO enfileira (dedup com o Pixel do catálogo)
 *   - venda pendente → NÃO enfileira
 *   - idempotência: reprocessar a mesma venda não duplica o event_id
 *
 * meta_eventos não tem `created_by`, mas cascateia via venda_id/contato_id (ON DELETE CASCADE),
 * então o cleanTestData padrão (que apaga vendas/contatos da conta-teste) o limpa junto.
 * A leitura de meta_eventos usa a policy de SELECT para admin (a conta-teste é admin).
 *
 * Janela: manual, nunca enquanto o Gilmar está usando o sistema (skill tdd-mont-pragmatico).
 */

type Client = Awaited<ReturnType<typeof createTestClient>>

let supabase: Client

async function criarContato(nome = 'Cliente CAPI Teste') {
    const { data, error } = await supabase
        .from('contatos')
        .insert({ nome, telefone: '11955550000', tipo: 'B2C', status: 'cliente', origem: 'direto' })
        .select('id')
        .single()
    if (error) throw error
    return data
}

interface CriarVendaOpts {
    status?: string
    forma_pagamento?: string
    origem?: string
    total?: number
}

async function criarVenda(contatoId: string, opts: CriarVendaOpts = {}) {
    const hoje = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
        .from('vendas')
        .insert({
            contato_id: contatoId,
            data: hoje,
            status: opts.status ?? 'pendente',
            forma_pagamento: opts.forma_pagamento ?? 'pix',
            total: opts.total ?? 100,
            pago: false,
            origem: opts.origem ?? 'sistema',
        })
        .select('id')
        .single()
    if (error) throw error
    return data
}

async function eventoDaVenda(vendaId: string) {
    const { data, error } = await supabase
        .from('meta_eventos')
        .select('*')
        .eq('event_id', `venda_${vendaId}`)
    if (error) throw error
    return data ?? []
}

beforeAll(async () => {
    supabase = await createTestClient()
})

afterEach(async () => {
    await cleanTestData(supabase)
})

describe('meta_eventos — enfileiramento de Purchase (integração)', () => {
    it('venda entregue não-brinde enfileira 1 Purchase pendente', async () => {
        const contato = await criarContato()
        const venda = await criarVenda(contato.id, { total: 250 })

        // Nasce pendente → nenhum evento ainda
        expect(await eventoDaVenda(venda.id)).toHaveLength(0)

        // Flip para entregue → trigger enfileira
        const { error } = await supabase.from('vendas').update({ status: 'entregue' }).eq('id', venda.id)
        expect(error).toBeNull()

        const eventos = await eventoDaVenda(venda.id)
        expect(eventos).toHaveLength(1)
        const ev = eventos[0]
        expect(ev.evento).toBe('Purchase')
        expect(ev.event_id).toBe(`venda_${venda.id}`)
        expect(ev.status).toBe('pendente')
        expect(Number(ev.valor)).toBe(250)
        expect(ev.moeda).toBe('BRL')
        expect(ev.contato_id).toBe(contato.id)
        expect(ev.venda_id).toBe(venda.id)
        expect(ev.action_source).toBe('physical_store') // sem ctwa_clid
    })

    it('fiado entregue É enfileirado (incluído)', async () => {
        const contato = await criarContato()
        const venda = await criarVenda(contato.id, { forma_pagamento: 'fiado' })
        await supabase.from('vendas').update({ status: 'entregue' }).eq('id', venda.id)

        expect(await eventoDaVenda(venda.id)).toHaveLength(1)
    })

    it('brinde entregue NÃO é enfileirado', async () => {
        const contato = await criarContato()
        const venda = await criarVenda(contato.id, { forma_pagamento: 'brinde' })
        await supabase.from('vendas').update({ status: 'entregue' }).eq('id', venda.id)

        expect(await eventoDaVenda(venda.id)).toHaveLength(0)
    })

    it('origem catalogo entregue NÃO é enfileirado (dedup com o Pixel)', async () => {
        const contato = await criarContato()
        const venda = await criarVenda(contato.id, { origem: 'catalogo' })
        await supabase.from('vendas').update({ status: 'entregue' }).eq('id', venda.id)

        expect(await eventoDaVenda(venda.id)).toHaveLength(0)
    })

    it('venda pendente NÃO é enfileirada', async () => {
        const contato = await criarContato()
        const venda = await criarVenda(contato.id, { status: 'pendente' })

        expect(await eventoDaVenda(venda.id)).toHaveLength(0)
    })

    it('idempotência: reprocessar a mesma venda entregue não duplica o evento', async () => {
        const contato = await criarContato()
        const venda = await criarVenda(contato.id)
        await supabase.from('vendas').update({ status: 'entregue' }).eq('id', venda.id)
        expect(await eventoDaVenda(venda.id)).toHaveLength(1)

        // Segundo update que re-dispara o trigger (muda forma_pagamento numa venda já entregue)
        await supabase.from('vendas').update({ forma_pagamento: 'dinheiro' }).eq('id', venda.id)

        expect(await eventoDaVenda(venda.id)).toHaveLength(1)
    })
})
