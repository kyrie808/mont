import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useContatos } from '../useContatos'

/**
 * Regressão (19/08/2026): o Gilmar tentou cadastrar a "Najla" e levou só
 * "Erro ao criar contato" — sem pista nenhuma. O número já era do contato
 * "♡ Cadonhoto ♡", que a secretária de WhatsApp tinha criado sozinha dois dias
 * antes com o push name do aparelho.
 *
 * O `contatoService` JÁ montava a mensagem útil ("Este WhatsApp já está
 * cadastrado para X") consultando quem é o dono do número. O `catch` do hook
 * descartava o erro inteiro e jogava um título fixo na tela — o trabalho de
 * traduzir o conflito existia e nunca chegava no operador.
 */

const erroToast = vi.fn()

vi.mock('../../components/ui/Toast', () => ({
    useToast: () => ({
        error: erroToast,
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    }),
}))

vi.mock('../../services/contatoService', () => ({
    contatoService: {
        func: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        getById: vi.fn(),
    },
}))

import { contatoService } from '../../services/contatoService'

const MSG_DUPLICADO = 'Este WhatsApp já está cadastrado para "♡ Cadonhoto ♡".'

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

async function montar() {
    const hook = renderHook(() => useContatos(), { wrapper })
    await waitFor(() => expect(hook.result.current).toBeTruthy())
    return hook
}

const payload = { nome: 'Najla', telefone: '17991158429' } as never

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contatoService.func).mockResolvedValue([])
    queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
})

describe('useContatos — o motivo da recusa tem que chegar na tela', () => {
    it('criar: mostra QUEM já tem o telefone, não um título genérico', async () => {
        vi.mocked(contatoService.create).mockRejectedValue(new Error(MSG_DUPLICADO))
        const { result } = await montar()

        await act(async () => {
            await result.current.createContato(payload)
        })

        expect(erroToast).toHaveBeenCalledWith(MSG_DUPLICADO)
    })

    it('editar: mesma regra na atualização', async () => {
        vi.mocked(contatoService.update).mockRejectedValue(new Error(MSG_DUPLICADO))
        const { result } = await montar()

        await act(async () => {
            await result.current.updateContato('c-1', payload)
        })

        expect(erroToast).toHaveBeenCalledWith(MSG_DUPLICADO)
    })

    it('erro sem mensagem cai no título genérico (nunca um toast vazio)', async () => {
        vi.mocked(contatoService.create).mockRejectedValue(new Error('   '))
        const { result } = await montar()

        await act(async () => {
            await result.current.createContato(payload)
        })

        expect(erroToast).toHaveBeenCalledWith('Erro ao criar contato')
    })

    it('criar segue devolvendo null pro chamador (não vira sucesso)', async () => {
        vi.mocked(contatoService.create).mockRejectedValue(new Error(MSG_DUPLICADO))
        const { result } = await montar()

        let retorno: unknown = 'nao-executou'
        await act(async () => {
            retorno = await result.current.createContato(payload)
        })

        expect(retorno).toBeNull()
    })
})
