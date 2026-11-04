import type { ProdutoLoja } from './tipos'

// "Leve junto" da página do produto: a mesma regra do catálogo antigo (/produtos/[slug]).
// 1. quem comprou este produto também comprou (RPC produtos_comprados_juntos, por pontuação);
// 2. se vierem menos de 4, completa com a mesma categoria do cadastro e depois com qualquer um;
// 3. no máximo 8. Só entra o que está à venda na loja agora (visível e sem "Esgotado").

export const MINIMO_JUNTOS = 4
export const MAXIMO_JUNTOS = 8

export function compradosJuntos(produto: ProdutoLoja, coCompra: string[], vitrine: ProdutoLoja[]): ProdutoLoja[] {
    const aVenda = vitrine.filter((p) => p.disponivel && p.id !== produto.id)
    const porId = new Map(aVenda.map((p) => [p.id, p]))
    const escolhidos: ProdutoLoja[] = []
    const vistos = new Set<string>()
    const incluir = (p: ProdutoLoja | undefined) => {
        if (!p || vistos.has(p.id) || escolhidos.length >= MAXIMO_JUNTOS) return
        escolhidos.push(p)
        vistos.add(p.id)
    }

    for (const id of coCompra) incluir(porId.get(id))
    if (escolhidos.length < MINIMO_JUNTOS && produto.categoria) {
        for (const p of aVenda) {
            if (escolhidos.length >= MINIMO_JUNTOS) break
            if (p.categoria === produto.categoria) incluir(p)
        }
    }
    for (const p of aVenda) {
        if (escolhidos.length >= MINIMO_JUNTOS) break
        incluir(p)
    }
    return escolhidos
}
