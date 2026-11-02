import { Sacola } from '@/components/sacola/Sacola'
import { carregarVitrine } from '@/lib/vitrine/carregar'

export default async function PaginaSacola() {
    const vitrine = await carregarVitrine()
    return <Sacola vitrine={vitrine} />
}
