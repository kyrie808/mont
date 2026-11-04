import { describe, it, expect, vi } from 'vitest'

/**
 * Contador do menu (Parte G, 04/11/2026): conta só os pedidos da LOJA esperando confirmação,
 * sem trazer as linhas (head + count). Unit (jsdom, sem banco): supabase mockado.
 */

const filtros: [string, string][] = []
let opcoes: unknown = null

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: (tabela: string) => {
            filtros.push(['from', tabela])
            return {
                select: (_colunas: string, opts: unknown) => {
                    opcoes = opts
                    const consulta = {
                        eq: (coluna: string, valor: string) => {
                            filtros.push([coluna, valor])
                            return filtros.length >= 3 ? Promise.resolve({ count: 4, error: null }) : consulta
                        },
                    }
                    return consulta
                },
            }
        },
    },
}))

import { pedidosLojaService } from '../pedidosLojaService'

describe('pedidosLojaService.contarPendentes', () => {
    it('conta cat_pedidos da loja com status pendente, sem baixar as linhas', async () => {
        const total = await pedidosLojaService.contarPendentes()

        expect(total).toBe(4)
        expect(opcoes).toEqual({ count: 'exact', head: true })
        expect(filtros).toEqual([
            ['from', 'cat_pedidos'],
            ['canal', 'loja'],
            ['status', 'pendente'],
        ])
    })
})
