'use client'

import { useEffect } from 'react'
import { guardarOrigemDaUrl } from '@/lib/medicao/origem'

/** Guarda UTMs/fbclid da URL de entrada para irem com o pedido (ver lib/medicao/origem.ts). */
export function CapturaOrigem() {
    useEffect(() => {
        guardarOrigemDaUrl()
    }, [])
    return null
}
