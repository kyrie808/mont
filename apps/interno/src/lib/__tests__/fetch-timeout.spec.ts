import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchComTimeout, REQUEST_TIMEOUT_MS } from '../fetch-timeout'

/**
 * Regressão da causa-raiz: o cliente Supabase não tinha timeout, então um request
 * em sinal fraco/morto travava indefinidamente (o "Processando..." eterno da Nova
 * Venda, que fazia a venda "sumir" sem erro). fetchComTimeout aborta após o limite
 * e transforma isso numa falha tratável.
 */
describe('fetchComTimeout', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('aborta o request quando estoura o timeout (sinal fraco/morto)', async () => {
        // fetch que nunca resolve sozinho, mas rejeita se o signal abortar (como o real).
        const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () =>
                    reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError')))
            }),
        )
        vi.stubGlobal('fetch', fetchMock)

        const promise = fetchComTimeout('https://exemplo.test/rest')
        const assertion = expect(promise).rejects.toMatchObject({ name: 'TimeoutError' })

        await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

        await assertion
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('resolve normalmente quando o fetch responde antes do timeout', async () => {
        // sentinela (evita depender do global Response no ambiente de teste)
        const resp = { ok: true } as unknown as Response
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(resp)))

        await expect(fetchComTimeout('https://exemplo.test/rest')).resolves.toBe(resp)
    })
})
