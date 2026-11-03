/**
 * Lista de produtos da Nova Venda no celular (03/11/2026, pedido do Gilmar).
 *
 * Ele lança venda na rua: os produtos vêm agrupados pelas seções da tela Catálogo (a mesma
 * fonte da loja, na mesma ordem), com os "Mais vendidos" dos últimos 90 dias no topo. Aqui
 * ficam só as regras, sem banco: quem chama já entrega os produtos à venda e o ranking.
 */

export const LIMITE_MAIS_VENDIDOS = 8
export const DIAS_MAIS_VENDIDOS = 90
export const ID_MAIS_VENDIDOS = 'mais-vendidos'
export const ID_OUTROS = 'outros'

export interface ProdutoLista {
    id: string
    nome: string
    ativo: boolean
    secaoId?: string | null
    ordemVitrine?: number | null
    apelido?: string | null
    codigo?: string | null
    /** "Sempre em Mais vendidos" (edição de produto): entra no topo, vendendo ou não. */
    fixoMaisVendidos?: boolean
}

export interface SecaoLista {
    id: string
    nome: string
    ordem: number
}

export interface GrupoLista<T extends ProdutoLista> {
    id: string
    nome: string
    produtos: T[]
}

/** Uma linha de item vendido: o ranking conta vendas distintas, não quantidade. */
export interface LinhaVendida {
    produtoId: string
    vendaId: string
}

/** Produtos por número de vendas (maior primeiro); empate pelo id, para a ordem não pular. */
export function rankingMaisVendidos(linhas: LinhaVendida[]): string[] {
    const vendas = new Map<string, Set<string>>()
    for (const { produtoId, vendaId } of linhas) {
        let doProduto = vendas.get(produtoId)
        if (!doProduto) {
            doProduto = new Set()
            vendas.set(produtoId, doProduto)
        }
        doProduto.add(vendaId)
    }
    return [...vendas.entries()]
        .sort(([a, va], [b, vb]) => vb.size - va.size || (a < b ? -1 : a > b ? 1 : 0))
        .map(([id]) => id)
}

const porOrdemVitrine = (a: ProdutoLista, b: ProdutoLista) =>
    (a.ordemVitrine ?? 0) - (b.ordemVitrine ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR')

/**
 * Mais vendidos (até 8: primeiro os fixados, pelo nome, depois o ranking sem repetir) + uma
 * seção por seção do Catálogo que tenha produto à venda + "Outros" (sem seção) no fim.
 * Produto inativo nunca entra, venha de onde vier.
 */
export function montarGrupos<T extends ProdutoLista>(
    produtos: T[],
    secoes: SecaoLista[],
    ranking: string[],
): GrupoLista<T>[] {
    const ativos = produtos.filter((p) => p.ativo)
    const porId = new Map(ativos.map((p) => [p.id, p]))
    const grupos: GrupoLista<T>[] = []

    const fixados = ativos
        .filter((p) => p.fixoMaisVendidos)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const idsFixados = new Set(fixados.map((p) => p.id))
    const doRanking = ranking
        .filter((id) => !idsFixados.has(id))
        .map((id) => porId.get(id))
        .filter((p): p is T => p !== undefined)
    const maisVendidos = [...fixados, ...doRanking].slice(0, LIMITE_MAIS_VENDIDOS)
    if (maisVendidos.length > 0) grupos.push({ id: ID_MAIS_VENDIDOS, nome: 'Mais vendidos', produtos: maisVendidos })

    const idsSecao = new Set(secoes.map((s) => s.id))
    for (const secao of [...secoes].sort((a, b) => a.ordem - b.ordem)) {
        const daSecao = ativos.filter((p) => p.secaoId === secao.id).sort(porOrdemVitrine)
        if (daSecao.length > 0) grupos.push({ id: secao.id, nome: secao.nome, produtos: daSecao })
    }

    const outros = ativos
        .filter((p) => !p.secaoId || !idsSecao.has(p.secaoId))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    if (outros.length > 0) grupos.push({ id: ID_OUTROS, nome: 'Outros', produtos: outros })

    return grupos
}

/** Minúsculas e sem acento: "Pão" e "pao" são a mesma busca. */
function normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Nome, apelido ou código: cada palavra digitada precisa aparecer em algum deles. */
export function casaBusca(produto: ProdutoLista, termo: string): boolean {
    const onde = normalizar([produto.nome, produto.apelido ?? '', produto.codigo ?? ''].join(' '))
    return normalizar(termo).split(/\s+/).filter(Boolean).every((palavra) => onde.includes(palavra))
}

/** Busca vira uma lista só, na ordem das seções, sem repetir quem também está nos Mais vendidos. */
export function buscarProdutos<T extends ProdutoLista>(grupos: GrupoLista<T>[], termo: string): T[] {
    const vistos = new Set<string>()
    const achados: T[] = []
    for (const grupo of grupos) {
        if (grupo.id === ID_MAIS_VENDIDOS) continue
        for (const produto of grupo.produtos) {
            if (vistos.has(produto.id) || !casaBusca(produto, termo)) continue
            vistos.add(produto.id)
            achados.push(produto)
        }
    }
    return achados
}

/** Unidades no carrinho (dois combos montados = 2). */
export function contarItens(linhas: { quantidade: number }[]): number {
    return linhas.reduce((total, linha) => total + linha.quantidade, 0)
}
