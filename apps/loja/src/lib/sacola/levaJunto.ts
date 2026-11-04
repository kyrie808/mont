import type { ProdutoLoja } from '@/lib/vitrine/tipos'
import type { Catalogo } from './calculo'
import type { ItemSacola } from './esquema'

// "Leva junto?" automático: o produto mais comprado junto com o que está na sacola, pelas vendas
// reais (função produtos_comprados_juntos, a mesma dos "Recomendados" do catálogo antigo).

export interface Indicacao {
    produto_id: string
    score: number
}

/** Produtos que estão na sacola: avulsos, itens fixos e sabores escolhidos dos combos. */
export function idsDaSacola(itens: ItemSacola[], catalogo: Catalogo): string[] {
    const ids = new Set<string>()
    for (const i of itens) {
        if (i.tipo === 'produto') {
            ids.add(i.produtoId)
            continue
        }
        for (const f of catalogo.combos.get(i.comboId)?.fixos ?? []) ids.add(f.produtoId)
        for (const e of i.escolhas) ids.add(e.produtoId)
    }
    return [...ids]
}

/** Soma as indicações de cada produto da sacola; os mais indicados primeiro. */
export function somarIndicacoes(listas: Indicacao[][]): string[] {
    const pontos = new Map<string, number>()
    for (const lista of listas) {
        for (const { produto_id, score } of lista) pontos.set(produto_id, (pontos.get(produto_id) ?? 0) + score)
    }
    return [...pontos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id)
}

/** O primeiro indicado que é avulso da loja, não está esgotado e ainda não está na sacola. */
export function escolherLevaJunto(ranking: string[], catalogo: Catalogo, naSacola: Set<string>): ProdutoLoja | null {
    for (const id of ranking) {
        const p = catalogo.produtos.get(id)
        if (p && p.disponivel && !naSacola.has(id)) return p
    }
    return null
}
