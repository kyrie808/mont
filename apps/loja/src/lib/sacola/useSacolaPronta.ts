'use client'

import { useSyncExternalStore } from 'react'
import { useSacola } from './store'

function assinar(avisar: () => void): () => void {
    const parar = useSacola.persist.onFinishHydration(avisar)
    // A sacola usa skipHydration: a primeira tela que assina dispara a leitura do localStorage.
    if (!useSacola.persist.hasHydrated()) void useSacola.persist.rehydrate()
    return parar
}

/**
 * true depois que a sacola foi lida do localStorage.
 * No servidor (e no primeiro render do cliente) é false: a tela mostra a sacola vazia, o mesmo HTML do servidor.
 */
export function useSacolaPronta(): boolean {
    return useSyncExternalStore(
        assinar,
        () => useSacola.persist.hasHydrated(),
        () => false,
    )
}
