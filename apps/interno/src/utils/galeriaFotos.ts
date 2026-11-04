/** No máximo 12 fotos por produto (o banco recusa acima disso). */
export const MAXIMO_FOTOS = 12

/** "Tornar capa": a foto vai para o 1º lugar; as outras mantêm a ordem entre si. */
export function tornarCapa(fotos: string[], url: string): string[] {
    return fotos.includes(url) ? [url, ...fotos.filter((f) => f !== url)] : fotos
}

/** Arrastar: tira a foto de `de` e põe em `para`. */
export function moverFoto(fotos: string[], de: number, para: number): string[] {
    if (de === para || de < 0 || para < 0 || de >= fotos.length || para >= fotos.length) return fotos
    const nova = [...fotos]
    const [foto] = nova.splice(de, 1)
    nova.splice(para, 0, foto!)
    return nova
}

/** Quantas fotos novas ainda cabem na galeria. */
export function vagasNaGaleria(fotos: string[]): number {
    return Math.max(0, MAXIMO_FOTOS - fotos.length)
}
