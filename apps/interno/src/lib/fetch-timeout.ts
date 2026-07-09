// fetch com timeout via AbortController.
//
// Sem isto, um request em sinal fraco/morto trava indefinidamente (era a causa
// do "Processando..." eterno na Nova Venda, que fazia a venda "sumir" sem erro).
// Abortamos após REQUEST_TIMEOUT_MS e o erro vira algo tratável na camada de cima.
// Encadeia com um AbortSignal do chamador (ex.: cancelamento de query do React
// Query) quando existir.
//
// Extraído da criação do client Supabase para poder ser testado sem depender das
// env vars (ver lib/supabase.ts).

export const REQUEST_TIMEOUT_MS = 15000

export const fetchComTimeout: typeof fetch = (input, init) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(
        () => controller.abort(new DOMException('Tempo de conexão esgotado', 'TimeoutError')),
        REQUEST_TIMEOUT_MS,
    )

    const callerSignal = init?.signal
    if (callerSignal) {
        if (callerSignal.aborted) {
            controller.abort(callerSignal.reason)
        } else {
            callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), { once: true })
        }
    }

    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId))
}
