import type { ResumoSacola } from '@/lib/sacola/calculo'
import type { ItemGA4 } from './dataLayer'

/** Só o que está à venda entra na medição (igual ao total mostrado na tela 05). */
function linhasVendaveis(resumo: ResumoSacola) {
    return resumo.linhas
        .filter((l) => l.vendavel)
        .map((l) =>
            l.tipo === 'produto'
                ? { id: l.produto.id, nome: l.produto.nome, quantidade: l.quantidade, preco: l.produto.preco }
                : { id: l.combo.id, nome: l.combo.nome, quantidade: 1, preco: l.combo.preco },
        )
}

/** Itens do `begin_checkout` no dataLayer (formato GA4, igual ao catálogo antigo). */
export function itensGA4(resumo: ResumoSacola): ItemGA4[] {
    return linhasVendaveis(resumo).map((l) => ({ item_id: l.id, item_name: l.nome, price: l.preco, quantity: l.quantidade }))
}

/** `custom_data` do InitiateCheckout pelo servidor (mesmo formato do catálogo antigo). */
export function dadosDoCheckout(resumo: ResumoSacola) {
    const linhas = linhasVendaveis(resumo)
    return {
        currency: 'BRL',
        value: resumo.totalPix,
        content_type: 'product',
        content_ids: linhas.map((l) => l.id),
        contents: linhas.map((l) => ({ id: l.id, quantity: l.quantidade, item_price: l.preco })),
        num_items: linhas.reduce((s, l) => s + l.quantidade, 0),
    }
}
