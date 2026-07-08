import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createTestClient, cleanTestData } from '@mont/shared/test-utils'

/**
 * Integração (PRODUÇÃO, conta-teste) da reconciliação de saldo via registrar_ajuste_saldo.
 *
 * Garante que a RPC calibra o saldo do sistema ao saldo real inserindo UM lançamento
 * origem='ajuste' (entrada se falta, saída se sobra), que o trigger leva saldo_atual ao
 * real, e que um ajuste sem diferença é no-op. Nunca escreve saldo_atual na mão (Regra #3).
 *
 * A conta-teste é admin (admin_users) → passa no guard is_admin() da RPC.
 * Cleanup automático por created_by (contas + lancamentos). Janela: manual, nunca com o
 * Gilmar usando (ver skill tdd-mont-pragmatico).
 */

type Client = Awaited<ReturnType<typeof createTestClient>>

let supabase: Client

async function criarConta() {
    const { data, error } = await supabase
        .from('contas')
        .insert({ nome: `Conta Ajuste ${Date.now()}`, tipo: 'dinheiro', ativo: true })
        .select('id, saldo_atual').single()
    if (error) throw error
    return data
}

async function saldoDe(contaId: string) {
    const { data, error } = await supabase.from('contas').select('saldo_atual').eq('id', contaId).single()
    if (error) throw error
    return Number(data.saldo_atual ?? 0)
}

beforeAll(async () => {
    supabase = await createTestClient()
})

afterEach(async () => {
    await cleanTestData(supabase)
})

describe('registrar_ajuste_saldo — reconciliação (integração)', () => {
    it('calibra o saldo para o valor real (entrada quando falta, saída quando sobra)', async () => {
        const conta = await criarConta()
        expect(Number(conta.saldo_atual ?? 0)).toBe(0)

        // falta dinheiro no sistema → ajuste de ENTRADA
        const { data: id1, error: e1 } = await supabase.rpc('registrar_ajuste_saldo', {
            p_conta_id: conta.id, p_saldo_real: 500,
        })
        expect(e1).toBeNull()
        expect(id1).toBeTruthy()
        expect(await saldoDe(conta.id as string)).toBe(500)

        // sobra dinheiro no sistema → ajuste de SAÍDA
        const { data: id2, error: e2 } = await supabase.rpc('registrar_ajuste_saldo', {
            p_conta_id: conta.id, p_saldo_real: 300,
        })
        expect(e2).toBeNull()
        expect(id2).toBeTruthy()
        expect(await saldoDe(conta.id as string)).toBe(300)

        // dois lançamentos origem='ajuste' vinculados à conta
        const { data: lcs } = await supabase
            .from('lancamentos').select('tipo, valor, origem').eq('conta_id', conta.id).eq('origem', 'ajuste')
        expect(lcs).toHaveLength(2)
        const entrada = lcs!.find((l) => l.tipo === 'entrada')
        const saida = lcs!.find((l) => l.tipo === 'saida')
        expect(Number(entrada!.valor)).toBe(500)
        expect(Number(saida!.valor)).toBe(200)
    })

    it('ajuste sem diferença é no-op (retorna null, não lança)', async () => {
        const conta = await criarConta()
        await supabase.rpc('registrar_ajuste_saldo', { p_conta_id: conta.id, p_saldo_real: 250 })
        expect(await saldoDe(conta.id as string)).toBe(250)

        // mesmo saldo real → nada a ajustar
        const { data: id, error } = await supabase.rpc('registrar_ajuste_saldo', {
            p_conta_id: conta.id, p_saldo_real: 250,
        })
        expect(error).toBeNull()
        expect(id).toBeNull()

        const { data: lcs } = await supabase
            .from('lancamentos').select('id').eq('conta_id', conta.id).eq('origem', 'ajuste')
        expect(lcs).toHaveLength(1) // só o primeiro ajuste
    })
})
