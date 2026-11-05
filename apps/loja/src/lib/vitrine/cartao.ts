import type { LinhaSacola } from '@/lib/sacola/calculo'
import type { ProdutoLoja } from './tipos'

// Preço do cartão na loja. Decisão de 05/11/2026: na Black o cartão tem o MESMO preço do Pix
// (loja_precos.preco_credito_1x = preco_pix), sem repassar a taxa. Os textos seguem o dado: se um
// dia o cartão voltar a ter outro preço, os avisos de "preço do cartão" voltam sozinhos.

/** O cartão tem outro preço que o Pix neste item (só na campanha; fora dela, preço único). */
export function cartaoTemOutroPreco(p: Pick<ProdutoLoja, 'preco' | 'precoCredito'>): boolean {
    return p.precoCredito !== null && Math.round(p.precoCredito * 100) !== Math.round(p.preco * 100)
}

/** Algum item à venda na sacola tem outro preço no cartão. */
export function sacolaTemCartaoDiferente(linhas: LinhaSacola[]): boolean {
    return linhas.some((l) => l.vendavel && cartaoTemOutroPreco(l.tipo === 'produto' ? l.produto : l.combo))
}

export const MESMO_PRECO = 'Mesmo preço no Pix, dinheiro ou cartão.'
