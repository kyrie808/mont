import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { MontarCombo } from '@/components/combo/MontarCombo'
import { carregarVitrine } from '@/lib/vitrine/carregar'

export default async function PaginaCombo({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const vitrine = await carregarVitrine()
    const combo = vitrine.combos.find((c) => c.slug === slug)
    if (!combo) notFound()
    return (
        <Suspense>
            <MontarCombo combo={combo} />
        </Suspense>
    )
}
