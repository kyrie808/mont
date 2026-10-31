import type { DomainItemVenda } from '../types/domain'

/**
 * Blocos do recibo da venda. Combo da Black é gravado em itens próprios (fixos + sabores, com o
 * preço do combo rateado), e o rateio por item não diz nada a quem vende: o recibo mostra o
 * COMBO, com o total dele, e os itens listados embaixo. Avulso segue uma linha por item.
 */
export type BlocoRecibo =
    | { tipo: 'avulso'; item: DomainItemVenda }
    | { tipo: 'combo'; comboId: string; instancia: string; total: number; itens: DomainItemVenda[] }

export function agruparItensVenda(itens: DomainItemVenda[]): BlocoRecibo[] {
    const blocos: BlocoRecibo[] = []
    const porInstancia = new Map<string, Extract<BlocoRecibo, { tipo: 'combo' }>>()

    for (const item of itens) {
        if (!item.comboId || !item.comboInstancia) {
            blocos.push({ tipo: 'avulso', item })
            continue
        }
        let bloco = porInstancia.get(item.comboInstancia)
        if (!bloco) {
            bloco = { tipo: 'combo', comboId: item.comboId, instancia: item.comboInstancia, total: 0, itens: [] }
            porInstancia.set(item.comboInstancia, bloco)
            blocos.push(bloco)
        }
        bloco.itens.push(item)
        bloco.total = Math.round(bloco.total * 100 + item.subtotal * 100) / 100
    }

    return blocos
}
