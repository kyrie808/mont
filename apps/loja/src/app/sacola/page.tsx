import { Sacola } from '@/components/sacola/Sacola'
import { ambiente } from '@/lib/ambiente'
import { carregarBairros, carregarVitrine } from '@/lib/vitrine/carregar'

export default async function PaginaSacola() {
    const [vitrine, bairros] = await Promise.all([carregarVitrine(), carregarBairros()])
    return <Sacola vitrine={vitrine} bairros={bairros} whatsapp={ambiente().NEXT_PUBLIC_WHATSAPP_NUMBER} />
}
