import { describe, expect, it } from 'vitest'
import type { LinhaSacola } from '@/lib/sacola/calculo'
import { cartaoTemOutroPreco, sacolaTemCartaoDiferente } from './cartao'
import type { ProdutoLoja } from './tipos'

function produto(preco: number, precoCredito: number | null): ProdutoLoja {
    return {
        id: 'p',
        slug: 'p',
        nome: 'p',
        subtitulo: null,
        descricao: null,
        imagemUrl: null,
        fotos: [],
        categoria: null,
        selo: null,
        beneficios: [],
        preparo: [],
        preco,
        precoDe: null,
        precoCredito,
        disponivel: true,
    }
}

describe('preço do cartão (decisão de 05/11/2026: igual ao Pix na Black)', () => {
    it('cartão igual ao Pix, ou fora da campanha (sem preço de cartão): mesmo preço', () => {
        expect(cartaoTemOutroPreco(produto(65, 65))).toBe(false)
        expect(cartaoTemOutroPreco(produto(75, null))).toBe(false)
    })

    it('se o cartão voltar a ter outro preço, a diferença aparece', () => {
        expect(cartaoTemOutroPreco(produto(65, 68))).toBe(true)
    })

    it('sacola: só conta item à venda', () => {
        const linha = (p: ProdutoLoja, vendavel: boolean): LinhaSacola => ({ tipo: 'produto', produto: p, quantidade: 1, subtotal: p.preco, vendavel })
        expect(sacolaTemCartaoDiferente([linha(produto(65, 65), true), linha(produto(30, 30), true)])).toBe(false)
        expect(sacolaTemCartaoDiferente([linha(produto(65, 68), false)])).toBe(false)
        expect(sacolaTemCartaoDiferente([linha(produto(65, 65), true), linha(produto(65, 68), true)])).toBe(true)
    })
})
