import type { Metadata } from 'next'
import { Dados } from '@/components/checkout/Dados'
import { ambiente } from '@/lib/ambiente'
import { carregarVitrine } from '@/lib/vitrine/carregar'

/** Sacola e checkout não vão para o Google (o robots.txt também os bloqueia). */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function PaginaDados() {
    const vitrine = await carregarVitrine()
    return <Dados vitrine={vitrine} whatsapp={ambiente().NEXT_PUBLIC_WHATSAPP_NUMBER} />
}
