import type { SeloVariant } from '@mont/shared'

// Label do selo (badge) do card, a partir do campo produtos.selo (curado no interno).
// Único lugar que mapeia valor → texto; importado por ProdutoCard e FeaturedCarousel.
const SELO_LABEL: Record<SeloVariant, string> = {
    mais_vendido: 'Mais vendido',
    oferta: 'Oferta',
    queridinho: 'Queridinho',
}

/** Retorna o label do selo, ou null se vazio/desconhecido (não renderiza badge). */
export function seloLabel(selo: string | null | undefined): string | null {
    if (!selo) return null
    return SELO_LABEL[selo as SeloVariant] ?? null
}
