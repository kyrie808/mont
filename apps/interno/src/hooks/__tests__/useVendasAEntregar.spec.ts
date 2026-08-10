import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

interface LinhaVenda {
    id: string
    data: string
    total: number
    contato: { nome: string | null } | null
}

let linhas: LinhaVenda[] = []
const eqSpy = vi.fn()

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: (col: string, val: unknown) => {
                    eqSpy(col, val)
                    return {
                        order: () => Promise.resolve({ data: linhas, error: null }),
                    }
                },
            }),
        }),
    },
}))

const { useVendasAEntregar, DIAS_PARA_ALERTAR } = await import('../useVendasAEntregar')

/** Data 'YYYY-MM-DD' de N dias atrás, no fuso local. */
function diasAtras(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return createElement(QueryClientProvider, { client }, children)
}

/*
 * O alerta é a rede de proteção do tipo "Entrego depois": a venda nasce pendente,
 * e sem isto ela apodrece. Em 08/08/2026 havia 12 vendas paradas há 8+ dias e 7
 * contatos aparecendo como Lead mesmo tendo comprado.
 */
describe('useVendasAEntregar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        linhas = []
    })

    it('consulta apenas vendas pendentes', async () => {
        renderHook(() => useVendasAEntregar(), { wrapper })
        await waitFor(() => expect(eqSpy).toHaveBeenCalled())
        expect(eqSpy).toHaveBeenCalledWith('status', 'pendente')
    })

    it('inclui a venda parada além do limiar e calcula os dias', async () => {
        linhas = [
            { id: 'v1', data: diasAtras(DIAS_PARA_ALERTAR + 1), total: 95, contato: { nome: 'Vilma' } },
        ]

        const { result } = renderHook(() => useVendasAEntregar(), { wrapper })
        await waitFor(() => expect(result.current.count).toBe(1))

        expect(result.current.alertas[0]).toMatchObject({
            venda_id: 'v1',
            nome: 'Vilma',
            total: 95,
            dias_parada: DIAS_PARA_ALERTAR + 1,
        })
    })

    it('ignora venda recente — vender e entregar no mesmo dia é o fluxo normal', async () => {
        linhas = [{ id: 'v2', data: diasAtras(0), total: 35, contato: { nome: 'Juliana' } }]

        const { result } = renderHook(() => useVendasAEntregar(), { wrapper })
        await waitFor(() => expect(result.current.alertas).toEqual([]))
        expect(result.current.count).toBe(0)
    })

    it('ordena da mais parada para a menos', async () => {
        linhas = [
            { id: 'nova', data: diasAtras(DIAS_PARA_ALERTAR), total: 10, contato: { nome: 'B' } },
            { id: 'velha', data: diasAtras(30), total: 20, contato: { nome: 'A' } },
        ]

        const { result } = renderHook(() => useVendasAEntregar(), { wrapper })
        await waitFor(() => expect(result.current.count).toBe(2))

        expect(result.current.alertas.map((a) => a.venda_id)).toEqual(['velha', 'nova'])
    })

    it('não quebra quando o contato veio nulo', async () => {
        linhas = [{ id: 'v3', data: diasAtras(10), total: 50, contato: null }]

        const { result } = renderHook(() => useVendasAEntregar(), { wrapper })
        await waitFor(() => expect(result.current.count).toBe(1))

        expect(result.current.alertas[0].nome).toBe('Cliente')
    })
})
