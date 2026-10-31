import { describe, it, expect } from 'vitest'
import {
    precoNaTabela,
    tabelaDaVenda,
    totalNaTabela,
    escolhasCompletas,
    faltamNoGrupo,
    resumoEscolhas,
    avisoTabelaNoPagamento,
    type MapaPrecos,
} from './tabelaPreco'

/**
 * Preço da Black na Nova Venda (30/10/2026). Pix/dinheiro → preço Black, cartão → tabela de
 * cartão, fiado (e brinde) → preço normal. A tela mostra o mesmo número que o servidor grava
 * (`precos_vigentes` × `preco_tabela`); estes testes travam a parte que mora no navegador.
 */

const BALDE = 'balde'
const FAMILIA = 'familia'

const MAPA: MapaPrecos = new Map([
    [BALDE, { normal: 75, pix: 65, cartao: 68 }],
    [FAMILIA, { normal: 199, pix: 199, cartao: 206 }],
])

describe('precoNaTabela', () => {
    it('usa a tabela escolhida', () => {
        expect(precoNaTabela(MAPA, BALDE, 75, 'pix')).toBe(65)
        expect(precoNaTabela(MAPA, BALDE, 75, 'cartao')).toBe(68)
        expect(precoNaTabela(MAPA, BALDE, 75, 'normal')).toBe(75)
    })

    it('produto fora do mapa (ainda carregando) cai no preço do cadastro', () => {
        expect(precoNaTabela(MAPA, 'outro', 30, 'pix')).toBe(30)
    })
})

describe('tabelaDaVenda', () => {
    it('fiado e brinde sempre no preço normal, mesmo com Pix escolhido', () => {
        expect(tabelaDaVenda('fiado', null, 'pix')).toBe('normal')
        expect(tabelaDaVenda('brinde', 'pix', 'cartao')).toBe('normal')
    })

    it('a forma de pagamento já escolhida manda na tabela', () => {
        expect(tabelaDaVenda('venda', 'pix', 'cartao')).toBe('pix')
        expect(tabelaDaVenda('venda', 'dinheiro', 'cartao')).toBe('pix')
        expect(tabelaDaVenda('venda', 'cartao', 'pix')).toBe('cartao')
    })

    it('sem forma definida ("receber depois"), vale a tabela escolhida no carrinho', () => {
        expect(tabelaDaVenda('venda', null, 'cartao')).toBe('cartao')
        expect(tabelaDaVenda('venda', null, 'pix')).toBe('pix')
    })
})

describe('totalNaTabela', () => {
    it('soma preço × quantidade de avulsos e combos', () => {
        const itens = [
            { produtoId: BALDE, precoCadastro: 75, quantidade: 2 },
            { produtoId: FAMILIA, precoCadastro: 199, quantidade: 1 },
        ]
        expect(totalNaTabela(MAPA, itens, 'pix')).toBe(329)
        expect(totalNaTabela(MAPA, itens, 'cartao')).toBe(342)
        expect(totalNaTabela(MAPA, itens, 'normal')).toBe(349)
    })
})

const GRUPO = { id: 'g6', titulo: 'Escolha 6 doces de 680 g', quantidade: 6, permiteRepetir: true }

describe('escolhas de combo', () => {
    it('completo só quando cada grupo fecha a quantidade exata', () => {
        const cinco = [{ grupoId: 'g6', produtoId: 'dl', quantidade: 5 }]
        const seis = [...cinco, { grupoId: 'g6', produtoId: 'coco', quantidade: 1 }]
        expect(escolhasCompletas([GRUPO], cinco)).toBe(false)
        expect(faltamNoGrupo(GRUPO, cinco)).toBe(1)
        expect(escolhasCompletas([GRUPO], seis)).toBe(true)
        expect(faltamNoGrupo(GRUPO, seis)).toBe(0)
    })

    it('combo sem grupos (Dupla Zero) já nasce completo', () => {
        expect(escolhasCompletas([], [])).toBe(true)
    })

    it('resumo legível para o carrinho, com quantidade só quando repete', () => {
        const nomes = new Map([['dl', 'Doce de Leite Tradicional 680g'], ['coco', 'Doce de Leite com Coco 680g']])
        const escolhas = [
            { grupoId: 'g6', produtoId: 'dl', quantidade: 5 },
            { grupoId: 'g6', produtoId: 'coco', quantidade: 1 },
        ]
        expect(resumoEscolhas(escolhas, nomes)).toBe('5× Doce de Leite Tradicional 680g, Doce de Leite com Coco 680g')
    })
})

describe('avisoTabelaNoPagamento', () => {
    it('lançada no Pix e paga no cartão: avisa que o valor não muda sozinho', () => {
        expect(avisoTabelaNoPagamento('pix', 'cartao')).toMatch(/Pix/)
    })

    it('lançada no cartão e paga no Pix ou dinheiro: avisa', () => {
        expect(avisoTabelaNoPagamento('cartao', 'pix')).toMatch(/cartão/)
        expect(avisoTabelaNoPagamento('cartao', 'dinheiro')).toMatch(/cartão/)
    })

    it('sem conflito, ou venda antiga sem tabela, não avisa', () => {
        expect(avisoTabelaNoPagamento('pix', 'pix')).toBeNull()
        expect(avisoTabelaNoPagamento('pix', 'dinheiro')).toBeNull()
        expect(avisoTabelaNoPagamento('cartao', 'cartao')).toBeNull()
        expect(avisoTabelaNoPagamento('normal', 'cartao')).toBeNull()
        expect(avisoTabelaNoPagamento(null, 'cartao')).toBeNull()
    })
})
