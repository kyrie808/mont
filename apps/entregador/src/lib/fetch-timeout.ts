// fetch com timeout via AbortController — o entregador usa no campo (manhã, sinal
// possivelmente fraco). Sem isto, um request preso trava o app em silêncio. Mesma
// lição da blindagem da Nova Venda no interno.

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
