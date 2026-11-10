import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * Item 5 (07/11/2026): telas que só usam AÇÕES (Nova Venda, detalhe da venda, perfil do cliente,
 * seletor de cliente, formulário de contato) chamavam useVendas()/useContatos() sem filtro e
 * baixavam todas as vendas/contatos — cortados em 1000 pelo PostgREST — só para usar as funções.
 * useVendaAcoes/useContatoAcoes dão as mesmas funções SEM buscar lista nenhuma.
 */

vi.mock('../../services/vendaService', () => ({
    vendaService: {
        getVendas: vi.fn().mockResolvedValue([]),
        getTotalAReceber: vi.fn().mockResolvedValue(0),
        calculateKPIs: vi.fn().mockReturnValue({}),
    },
}))
vi.mock('../../services/contatoService', () => ({
    contatoService: { func: vi.fn().mockResolvedValue([]), getById: vi.fn().mockResolvedValue(null) },
}))
vi.mock('../../components/ui/Toast', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }))

import { vendaService } from '../../services/vendaService'
import { contatoService } from '../../services/contatoService'
import { useVendaAcoes, useVendas } from '../useVendas'
import { useContatoAcoes, useContatos } from '../useContatos'

let queryClient: QueryClient
function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('ações sem baixar a lista', () => {
    it('useVendaAcoes não busca vendas e entrega as ações', async () => {
        const { result } = renderHook(() => useVendaAcoes(), { wrapper })
        await new Promise((r) => setTimeout(r, 30))
        expect(vendaService.getVendas).not.toHaveBeenCalled()
        expect(vendaService.getTotalAReceber).not.toHaveBeenCalled()
        for (const f of ['createVenda', 'updateVenda', 'updateVendaStatus', 'deleteVenda', 'cancelVenda', 'getVendaById', 'addPagamento', 'deleteUltimoPagamento'] as const) {
            expect(typeof result.current[f], f).toBe('function')
        }
    })

    it('useContatoAcoes não busca contatos e entrega as ações', async () => {
        const { result } = renderHook(() => useContatoAcoes(), { wrapper })
        await new Promise((r) => setTimeout(r, 30))
        expect(contatoService.func).not.toHaveBeenCalled()
        for (const f of ['createContato', 'updateContato', 'deleteContato', 'searchContatos', 'getContatoById'] as const) {
            expect(typeof result.current[f], f).toBe('function')
        }
    })

    it('controle: useVendas() e useContatos() sem filtro continuam buscando a lista', async () => {
        renderHook(() => useVendas(), { wrapper })
        renderHook(() => useContatos(), { wrapper })
        await vi.waitFor(() => {
            expect(vendaService.getVendas).toHaveBeenCalled()
            expect(contatoService.func).toHaveBeenCalled()
        })
    })
})
