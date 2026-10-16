import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { startOfMonth, endOfMonth } from 'date-fns'

/**
 * Regressão (16/10/2026): o filtro de mês da lista de Vendas mandava as fronteiras
 * como `toISOString().split('T')[0]`. No aparelho em Brasília, endOfMonth(outubro) =
 * 31/10 23:59:59 local = 01/11 02:59Z → `data <= 2026-11-01`, e o dia 1º do mês
 * seguinte entrava na lista de outubro. As fronteiras são de calendário LOCAL
 * (startOfMonth/endOfMonth), então o inverso certo é formatar no calendário local.
 */

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const TZ_ORIGINAL = env.TZ
env.TZ = 'America/Sao_Paulo'

const chamadas: Array<[string, string, string]> = []
const or = vi.fn()

function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.order = () => b
    b.eq = () => b
    b.neq = () => b
    b.gte = (col: string, val: string) => { chamadas.push(['gte', col, val]); return b }
    b.lte = (col: string, val: string) => { chamadas.push(['lte', col, val]); return b }
    b.or = (filtro: string) => { or(filtro); return b }
    b.then = (resolve: (r: { data: unknown[]; error: null }) => unknown) => resolve({ data: [], error: null })
    return b
}

vi.mock('../../lib/supabase', () => ({
    supabase: { from: () => builder(), rpc: vi.fn() },
}))

const { vendaService } = await import('../vendaService')

const outubro = new Date(2026, 9, 16)

beforeEach(() => {
    chamadas.length = 0
    or.mockClear()
})
afterAll(() => {
    env.TZ = TZ_ORIGINAL
})

describe('vendaService.getVendas — fronteiras do mês em Brasília', () => {
    it('outubro vai de 2026-10-01 a 2026-10-31 (não 2026-11-01)', async () => {
        await vendaService.getVendas(startOfMonth(outubro), endOfMonth(outubro))
        expect(chamadas).toEqual([
            ['gte', 'data', '2026-10-01'],
            ['lte', 'data', '2026-10-31'],
        ])
    })

    it('com pendentes: o and(...) do or também fecha em 31/10', async () => {
        await vendaService.getVendas(startOfMonth(outubro), endOfMonth(outubro), true)
        expect(or.mock.calls[0][0]).toContain('and(data.gte.2026-10-01,data.lte.2026-10-31)')
    })
})
