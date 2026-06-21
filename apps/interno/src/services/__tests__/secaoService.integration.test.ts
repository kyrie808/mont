import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createTestClient } from '@mont/shared/test-utils'

/**
 * Integração (PRODUÇÃO, conta-teste) das seções da vitrine (abas do catálogo).
 *
 * cat_secoes NÃO tem `created_by` → o cleanTestData padrão não cobre. Este teste rastreia os
 * ids que cria e os apaga no afterEach. Só exercita o que é prod-safe: CRUD de seção +
 * reorder_secoes. NÃO testa atribuição/ordem de produtos (mutaria produtos reais).
 *
 * Janela: manual, nunca enquanto o Gilmar está usando o sistema (ver skill tdd-mont-pragmatico).
 */

type Client = Awaited<ReturnType<typeof createTestClient>>

let supabase: Client
const secoesCriadas: string[] = []

async function criarSecao(nome: string) {
    const slug = `${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { data, error } = await supabase
        .from('cat_secoes')
        .insert({ nome, slug, ordem: 0, ativa: true })
        .select('id, nome, ordem')
        .single()
    if (error) throw error
    secoesCriadas.push(data.id)
    return data
}

beforeAll(async () => {
    supabase = await createTestClient()
})

afterEach(async () => {
    if (secoesCriadas.length === 0) return
    const { error } = await supabase.from('cat_secoes').delete().in('id', secoesCriadas)
    if (error) throw error
    secoesCriadas.length = 0
})

describe('secaoService / cat_secoes (integração)', () => {
    it('cria uma seção com os campos esperados', async () => {
        const secao = await criarSecao('Teste Seção')
        expect(secao.id).toBeTruthy()
        expect(secao.nome).toBe('Teste Seção')
    })

    it('reorder_secoes inverte a ordem das seções', async () => {
        const a = await criarSecao('Teste A')
        const b = await criarSecao('Teste B')

        // aplica [b, a] → b.ordem=1, a.ordem=2
        const { error: rpcErr } = await supabase.rpc('reorder_secoes', { p_ids: [b.id, a.id] })
        expect(rpcErr).toBeNull()

        const { data, error } = await supabase
            .from('cat_secoes')
            .select('id, ordem')
            .in('id', [a.id, b.id])
        if (error) throw error

        const ordemPorId = new Map((data ?? []).map((r) => [r.id, r.ordem]))
        expect(ordemPorId.get(b.id)).toBe(1)
        expect(ordemPorId.get(a.id)).toBe(2)
        expect(ordemPorId.get(b.id)!).toBeLessThan(ordemPorId.get(a.id)!)
    })
})
