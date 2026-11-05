import { describe, it, expect } from 'vitest'
import {
    precoNaTabela,
    tabelaDaVenda,
    motivoDaTabela,
    precoComboNormal,
    faixaComboNormal,
    notaPrecoCombo,
    totalNaTabela,
    escolhasCompletas,
    faltamNoGrupo,
    resumoEscolhas,
    avisoTabelaNoPagamento,
    produtosAVenda,
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

describe('tabelaDaVenda (regra do Gilmar, 04/11/2026)', () => {
    it('fiado e brinde sempre no preço normal, mesmo com forma escolhida', () => {
        expect(tabelaDaVenda('fiado', null)).toBe('normal')
        expect(tabelaDaVenda('fiado', 'pix')).toBe('normal')
        expect(tabelaDaVenda('brinde', 'cartao')).toBe('normal')
    })

    it('a Black só com a forma definida: Pix e dinheiro → Pix, cartão → cartão', () => {
        expect(tabelaDaVenda('venda', 'pix')).toBe('pix')
        expect(tabelaDaVenda('venda', 'dinheiro')).toBe('pix')
        expect(tabelaDaVenda('venda', 'cartao')).toBe('cartao')
    })

    it('sem forma definida ("receber depois") é preço normal', () => {
        expect(tabelaDaVenda('venda', null)).toBe('normal')
        expect(motivoDaTabela('venda', null)).toMatch(/escolha Pix, dinheiro ou cartão/)
        expect(motivoDaTabela('fiado', 'pix')).toBe('Fiado e brinde usam o preço normal.')
    })
})

describe('combo no preço normal = soma dos itens no cadastro', () => {
    // Mesa Cheia (Black): Balde 4 kg 75 + 2× Baldinho 1 kg 30 (os fixos somam 135, com o brinde)
    // + 6 doces de 680 g a 35 = 345; no Pix, 199.
    const NORMAL: Record<string, number> = { balde: 75, baldinho: 30, dl: 35, coco: 35, nozes: 40 }
    const normalDe = (id: string) => NORMAL[id] ?? 0
    const mesa = {
        fixos: [{ produtoId: 'balde', quantidade: 1 }, { produtoId: 'baldinho', quantidade: 2 }],
        grupos: [{ quantidade: 6, opcoes: ['dl', 'coco', 'nozes'] }],
    }

    it('fixos (com o brinde) + sabores escolhidos', () => {
        const escolhas = [
            { grupoId: 'g', produtoId: 'dl', quantidade: 4 },
            { grupoId: 'g', produtoId: 'coco', quantidade: 2 },
        ]
        expect(precoComboNormal(mesa, escolhas, normalDe)).toBe(345)
        expect(precoComboNormal(mesa, [{ grupoId: 'g', produtoId: 'nozes', quantidade: 6 }], normalDe)).toBe(375)
    })

    it('antes dos sabores: faixa do mais barato ao mais caro', () => {
        expect(faixaComboNormal(mesa, normalDe)).toEqual({ min: 345, max: 375 })
    })

    it('nota "Fiado: … · no Pix: …" só quando os preços diferem', () => {
        const brl = (v: number) => `R$ ${v}`
        expect(notaPrecoCombo(345, 199, brl)).toBe('Fiado: R$ 345 · no Pix: R$ 199')
        expect(notaPrecoCombo(345, 199, brl, true)).toBe('Fiado: a partir de R$ 345 · no Pix: R$ 199')
        expect(notaPrecoCombo(75, 75, brl)).toBeNull()
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

describe('produtosAVenda', () => {
    const lista = [{ id: BALDE }, { id: FAMILIA }]

    it('tira o combo da campanha quando o servidor diz que está fora de venda', () => {
        expect(produtosAVenda(lista, new Set([FAMILIA]))).toEqual([{ id: BALDE }])
    })

    it('sem nada fora de venda, devolve a mesma lista', () => {
        expect(produtosAVenda(lista, new Set())).toBe(lista)
    })
})
