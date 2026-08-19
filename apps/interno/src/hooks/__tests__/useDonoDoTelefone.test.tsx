import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDonoDoTelefone } from '../useDonoDoTelefone'

/**
 * O aviso "Este WhatsApp já é do contato X" tem duas maneiras silenciosas de errar:
 * gritar quando não devia (o contato encontrando a si mesmo na edição) e consultar o
 * banco a cada tecla com número pela metade — que sempre responderia "ninguém" e faria
 * o aviso piscar.
 */

// O debounce real (400ms) atrasaria o teste sem testar nada: o que importa aqui é a
// decisão de consultar ou não, e de quem é o número encontrado.
vi.mock('../useDebounce', () => ({ useDebounce: (v: string) => v }))

vi.mock('../../services/contatoService', () => ({
    contatoService: { donoDoTelefone: vi.fn() },
}))

import { contatoService } from '../../services/contatoService'

const CADONHOTO = { id: 'c-cadonhoto', nome: '♡ Cadonhoto ♡' }

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('useDonoDoTelefone', () => {
    it('acha o dono quando o número está completo', async () => {
        vi.mocked(contatoService.donoDoTelefone).mockResolvedValue(CADONHOTO)

        const { result } = renderHook(() => useDonoDoTelefone('(17) 99115-8429'), { wrapper })

        await waitFor(() => expect(result.current.dono).toEqual(CADONHOTO))
    })

    it('não consulta o banco com número incompleto', async () => {
        const { result } = renderHook(() => useDonoDoTelefone('(17) 991'), { wrapper })

        await waitFor(() => expect(result.current.dono).toBeNull())
        expect(contatoService.donoDoTelefone).not.toHaveBeenCalled()
    })

    it('na edição, o contato encontrando a si mesmo NÃO é colisão', async () => {
        vi.mocked(contatoService.donoDoTelefone).mockResolvedValue(CADONHOTO)

        const { result } = renderHook(
            () => useDonoDoTelefone('(17) 99115-8429', 'c-cadonhoto'),
            { wrapper },
        )

        await waitFor(() => expect(contatoService.donoDoTelefone).toHaveBeenCalled())
        expect(result.current.dono).toBeNull()
    })

    it('número livre não gera aviso', async () => {
        vi.mocked(contatoService.donoDoTelefone).mockResolvedValue(null)

        const { result } = renderHook(() => useDonoDoTelefone('(11) 95552-2314'), { wrapper })

        await waitFor(() => expect(contatoService.donoDoTelefone).toHaveBeenCalled())
        expect(result.current.dono).toBeNull()
    })
})
