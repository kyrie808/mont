import type { Metadata } from 'next'
import { Sacola } from '@/components/sacola/Sacola'
import { carregarVitrine } from '@/lib/vitrine/carregar'

/** Sacola e checkout não vão para o Google (o robots.txt também os bloqueia). */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function PaginaSacola() {
    const vitrine = await carregarVitrine()
    return <Sacola vitrine={vitrine} />
}
