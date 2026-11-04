import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { MontarCombo } from '@/components/combo/MontarCombo'
import { catalogoDa } from '@/lib/sacola/calculo'
import { metadadosDoProduto } from '@/lib/seo'
import { vitrineDaRequisicao } from '@/lib/vitrine/carregar'

type Parametros = { params: Promise<{ slug: string }> }

async function comboDoSlug(slug: string) {
    const vitrine = await vitrineDaRequisicao()
    return [...catalogoDa(vitrine).combos.values()].find((c) => c.slug === slug)
}

export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
    const { slug } = await params
    const combo = await comboDoSlug(slug)
    return combo ? metadadosDoProduto(combo, `/combo/${combo.slug}`) : {}
}

export default async function PaginaCombo({ params }: Parametros) {
    const { slug } = await params
    const combo = await comboDoSlug(slug)
    if (!combo) notFound()
    return (
        <Suspense>
            <MontarCombo combo={combo} />
        </Suspense>
    )
}
