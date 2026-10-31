import { Suspense } from 'react'
import { Loja } from '@/components/loja/Loja'
import { ambiente } from '@/lib/ambiente'
import { carregarVitrine } from '@/lib/vitrine/carregar'

export default async function PaginaLoja() {
    const vitrine = await carregarVitrine()
    return (
        <Suspense>
            <Loja vitrine={vitrine} whatsapp={ambiente().NEXT_PUBLIC_WHATSAPP_NUMBER} />
        </Suspense>
    )
}
