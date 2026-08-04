import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useVendas } from '../useVendas'

/**
 * Regressão: o selo Lead/Cliente/VIP vem da view `contato_compras_resumo`
 * (hook `useContatosResumo`, chave `contatos-resumo`), que conta vendas
 * ENTREGUES. Toda mutação que mexe em venda muda esse resumo — mas a chave
 * não era invalidada por NINGUÉM. Com `staleTime` de 15min e
 * `refetchOnWindowFocus: false`, o selo só corrigia com F5.
 * Caso real: "Seu chofer de luxo" seguiu Lead depois da 1ª compra (04/08/2026).
 */

vi.mock('../../services/vendaService', () => ({
    vendaService: {
        getVendas: vi.fn().mockResolvedValue([]),
        getTotalAReceber: vi.fn().mockResolvedValue(0),
        calculateKPIs: vi.fn().mockReturnValue({}),
        createVenda: vi.fn().mockResolvedValue({ id: 'venda-1' }),
        updateVenda: vi.fn().mockResolvedValue({ id: 'venda-1' }),
        deleteVenda: vi.fn().mockResolvedValue(true),
        cancelVenda: vi.fn().mockResolvedValue(true),
        getVendaById: vi.fn().mockResolvedValue(null),
        addPagamento: vi.fn().mockResolvedValue(true),
        deleteUltimoPagamento: vi.fn().mockResolvedValue(true),
    },
}))

let queryClient: QueryClient
let invalidateSpy: ReturnType<typeof vi.spyOn>

function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Todas as chaves passadas ao `invalidateQueries` até agora, achatadas. */
function chavesInvalidadas(): string[] {
    return invalidateSpy.mock.calls
        .map(([arg]) => (arg as { queryKey?: unknown[] } | undefined)?.queryKey?.[0])
        .filter((k): k is string => typeof k === 'string')
}

beforeEach(() => {
    queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
})

describe('useVendas — invalidação do resumo que alimenta o segmento', () => {
    async function montar() {
        const hook = renderHook(() => useVendas({ enabled: false }), { wrapper })
        await waitFor(() => expect(hook.result.current).toBeTruthy())
        invalidateSpy.mockClear()
        return hook
    }

    it('marcar a venda como entregue invalida `contatos-resumo`', async () => {
        const { result } = await montar()

        await act(async () => {
            await result.current.updateVendaStatus('venda-1', 'entregue')
        })

        expect(chavesInvalidadas()).toContain('contatos-resumo')
    })

    it('criar venda invalida `contatos-resumo`', async () => {
        const { result } = await montar()

        await act(async () => {
            await result.current.createVenda(
                {
                    contatoId: 'c-1',
                    data: '2026-08-04',
                    formaPagamento: 'venda',
                    taxaEntrega: 0,
                    itens: [],
                },
                'idem-1',
            )
        })

        expect(chavesInvalidadas()).toContain('contatos-resumo')
    })

    it('editar a venda invalida `contatos-resumo`', async () => {
        const { result } = await montar()

        await act(async () => {
            await result.current.updateVenda('venda-1', { status: 'entregue' })
        })

        expect(chavesInvalidadas()).toContain('contatos-resumo')
    })

    it('excluir a venda invalida `contatos-resumo`', async () => {
        const { result } = await montar()

        await act(async () => {
            await result.current.deleteVenda('venda-1')
        })

        expect(chavesInvalidadas()).toContain('contatos-resumo')
    })

    it('cancelar a venda invalida `contatos-resumo` (sai da contagem de compras)', async () => {
        const { result } = await montar()

        await act(async () => {
            await result.current.cancelVenda('venda-1')
        })

        expect(chavesInvalidadas()).toContain('contatos-resumo')
    })

    it('registrar pagamento NÃO invalida `contatos-resumo` (o resumo ignora `pago`)', async () => {
        const { result } = await montar()

        await act(async () => {
            await result.current.addPagamento('venda-1', {
                valor: 50,
                metodo: 'pix',
                data: '2026-08-04',
                conta_id: 'conta-1',
            })
        })

        expect(chavesInvalidadas()).not.toContain('contatos-resumo')
    })
})
