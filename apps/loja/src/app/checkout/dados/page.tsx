import { Dados } from '@/components/checkout/Dados'
import { ambiente } from '@/lib/ambiente'
import { carregarVitrine } from '@/lib/vitrine/carregar'

export default async function PaginaDados() {
    const vitrine = await carregarVitrine()
    return <Dados vitrine={vitrine} whatsapp={ambiente().NEXT_PUBLIC_WHATSAPP_NUMBER} />
}
