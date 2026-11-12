// Produto esgotado na loja (wireframe Esgotado): esgotados no fim da seção e o "Me avisa quando chegar".
// O aviso é só um WhatsApp para a Mont; o "já pedi" fica no aparelho (nada vai para o banco).

/** Em cada seção, o que está à venda vem primeiro; os esgotados vão para o fim, depois do divisor. */
export function separarEsgotados<T extends { disponivel: boolean }>(itens: readonly T[]): { aVenda: T[]; esgotados: T[] } {
    return {
        aVenda: itens.filter((p) => p.disponivel),
        esgotados: itens.filter((p) => !p.disponivel),
    }
}

/** Texto que abre no WhatsApp da Mont ao tocar em "Me avisa quando chegar". */
export function mensagemAviso(nomeProduto: string): string {
    return `Oi! Pode me avisar quando chegar mais ${nomeProduto}?`
}

/** Chave no localStorage: ids dos produtos em que a pessoa já tocou "Me avisa". */
export const CHAVE_AVISOS = 'mont-loja-avisos'

/** Lê o que está guardado no aparelho. Qualquer coisa fora do formato (lista de ids) vira lista vazia. */
export function interpretarAvisos(texto: string | null): string[] {
    if (!texto) return []
    try {
        const lido: unknown = JSON.parse(texto)
        return Array.isArray(lido) ? lido.filter((id): id is string => typeof id === 'string') : []
    } catch {
        return []
    }
}
