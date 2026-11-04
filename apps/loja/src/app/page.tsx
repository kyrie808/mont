import { Suspense } from 'react'
import { Loja } from '@/components/loja/Loja'
import { ambiente } from '@/lib/ambiente'
import { DESCRICAO_LOJA, TITULO_LOJA, metadadosDaPagina } from '@/lib/seo'
import { carregarVitrine } from '@/lib/vitrine/carregar'

export const metadata = metadadosDaPagina('/', TITULO_LOJA, DESCRICAO_LOJA)

export default async function PaginaLoja() {
    const vitrine = await carregarVitrine()
    return (
        <Suspense>
            <Loja vitrine={vitrine} whatsapp={ambiente().NEXT_PUBLIC_WHATSAPP_NUMBER} />
        </Suspense>
    )
}
