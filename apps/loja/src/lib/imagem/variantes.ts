// Versões leves das fotos de produto (12/11/2026): a cota de Image Optimization da Vercel acabou
// (/_next/image devolvia 402 e a foto ficava em branco). Em vez de otimizar a cada pedido, cada foto do
// bucket "products" ganha duas versões fixas em webp, geradas uma vez:
//
//   products/<caminho>  →  products/variantes/800/<caminho>.webp   (lado maior até 800 px)
//                          products/variantes/200/<caminho>.webp   (miniatura, lado maior até 200 px)
//
// A mesma convenção está na Edge Function upload-product-image (gera ao subir) e em
// supabase/scripts/gerar-variantes-fotos.mjs (gerou as que já existiam). Mudou aqui, muda lá.

/** Larguras das versões leves (lado maior, em px). */
export const LARGURAS_VARIANTE = [200, 800] as const
export type LarguraVariante = (typeof LARGURAS_VARIANTE)[number]

const FOTO_DO_BUCKET = /^(https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/products\/)(.+)$/

/** Versão leve de uma foto do bucket "products"; null se a foto não é de lá (ou já é uma versão leve). */
export function urlDaVariante(url: string, largura: LarguraVariante): string | null {
    const partes = FOTO_DO_BUCKET.exec(url)
    if (!partes) return null
    const [, base, caminho] = partes
    if (caminho.startsWith('variantes/')) return null
    return `${base}variantes/${largura}/${caminho}.webp`
}

/** Até 256 px na tela (já contando a densidade), a miniatura basta; acima, a de 800. */
export function larguraDaVariante(larguraPedida: number): LarguraVariante {
    return larguraPedida <= 256 ? 200 : 800
}

/**
 * Loader do next/image (next.config: images.loaderFile). Foto do bucket vai para a versão leve;
 * o resto (logo e fotos provisórias em /public, já leves) é servido como está, sem /_next/image.
 */
export function carregarFoto({ src, width }: { src: string; width: number }): string {
    return urlDaVariante(src, larguraDaVariante(width)) ?? `${src}${src.includes('?') ? '&' : '?'}w=${width}`
}
