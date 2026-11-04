import type { Metadata } from 'next'
import { Enviado } from '@/components/checkout/Enviado'

/** Sacola e checkout não vão para o Google (o robots.txt também os bloqueia). */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function PaginaEnviado() {
    return <Enviado />
}
