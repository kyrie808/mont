import { describe, it, expect } from 'vitest'
import {
    montarGrupos,
    rankingMaisVendidos,
    casaBusca,
    buscarProdutos,
    contarItens,
    LIMITE_MAIS_VENDIDOS,
    ID_MAIS_VENDIDOS,
    ID_OUTROS,
    type ProdutoLista,
    type SecaoLista,
} from './listaNovaVenda'

/**
 * Lista de produtos da Nova Venda no celular (03/11/2026, pedido do Gilmar): agrupada pelas
 * seções da tela Catálogo, "Mais vendidos" no topo, busca por nome ou apelido.
 */

const secoes: SecaoLista[] = [
    { id: 'doces', nome: 'Doces', ordem: 3 },
    { id: 'resfriados', nome: 'Resfriados', ordem: 1 },
    { id: 'congelados', nome: 'Congelados', ordem: 2 },
    { id: 'combos', nome: 'Combos', ordem: 0 },
]

const p = (id: string, nome: string, extra: Partial<ProdutoLista> = {}): ProdutoLista => ({
    id, nome, ativo: true, secaoId: null, ordemVitrine: 0, apelido: null, codigo: '', ...extra,
})

const baldinho = p('baldinho', 'Massa Pão de Queijo 1kg', { secaoId: 'resfriados', ordemVitrine: 1, apelido: 'baldinho, massa' })
const balde = p('balde', 'Massa Pão de Queijo 4kg', { secaoId: 'resfriados', ordemVitrine: 2, apelido: 'balde, baldão' })
const palito = p('palito', 'Palito de Queijo 1kg', { secaoId: 'congelados', ordemVitrine: 5, apelido: 'palito' })
const chipa = p('chipa', 'Chipa 1kg', { secaoId: 'congelados', ordemVitrine: 1 })
const pdq25 = p('pdq25', 'Pão de Queijo 1kg - 25gr', { secaoId: 'congelados', ordemVitrine: 0, apelido: 'pão de queijo, pdq' })
const palito2 = p('palito2', 'Palito de Queijo 2kg', { secaoId: 'congelados', ordemVitrine: 0 })
const cocada = p('cocada', 'Cocada Cremosa 680g', { secaoId: 'doces', ordemVitrine: 4 })
const avulso = p('avulso', 'Produto sem seção')

describe('montarGrupos — seções do Catálogo', () => {
    it('agrupa pelas seções na ordem do Catálogo, cada uma na ordem da vitrine', () => {
        const grupos = montarGrupos([cocada, palito, baldinho, chipa, balde], secoes, [])
        expect(grupos.map((g) => g.id)).toEqual(['resfriados', 'congelados', 'doces'])
        expect(grupos[0].produtos.map((x) => x.id)).toEqual(['baldinho', 'balde'])
        expect(grupos[1].produtos.map((x) => x.id)).toEqual(['chipa', 'palito'])
    })

    it('empate na ordem da vitrine: desempata pelo nome (igual à loja)', () => {
        const grupos = montarGrupos([pdq25, palito2], secoes, [])
        expect(grupos[0].produtos.map((x) => x.nome)).toEqual(['Palito de Queijo 2kg', 'Pão de Queijo 1kg - 25gr'])
    })

    it('produto sem seção (ou com seção que não existe mais) vai para "Outros", no fim', () => {
        const orfao = p('orfao', 'Seção apagada', { secaoId: 'nao-existe' })
        const grupos = montarGrupos([avulso, baldinho, orfao], secoes, [])
        expect(grupos.map((g) => g.id)).toEqual(['resfriados', ID_OUTROS])
        expect(grupos[1].nome).toBe('Outros')
        expect(grupos[1].produtos.map((x) => x.id)).toEqual(['avulso', 'orfao'])
    })

    it('seção sem produto à venda não aparece (ex.: Combos com a campanha fora do ar)', () => {
        const grupos = montarGrupos([baldinho], secoes, [])
        expect(grupos.map((g) => g.id)).toEqual(['resfriados'])
    })

    it('mostra a seção mesmo oculta na loja: o que decide é ter produto à venda', () => {
        const dupla = p('dupla', 'Dupla Zero (Black)', { secaoId: 'combos' })
        const grupos = montarGrupos([dupla, baldinho], secoes, [])
        expect(grupos.map((g) => g.id)).toEqual(['combos', 'resfriados'])
    })

    it('nunca mostra produto inativo, nem que venha no meio da lista', () => {
        const desativado = p('off', 'Desativado', { secaoId: 'resfriados', ativo: false })
        const grupos = montarGrupos([desativado, baldinho], secoes, ['off', 'baldinho'])
        const ids = grupos.flatMap((g) => g.produtos.map((x) => x.id))
        expect(ids).not.toContain('off')
    })
})

describe('montarGrupos — Mais vendidos', () => {
    it('vem primeiro, na ordem do ranking, e o produto continua também na seção dele', () => {
        const grupos = montarGrupos([baldinho, palito, balde], secoes, ['palito', 'baldinho'])
        expect(grupos[0].id).toBe(ID_MAIS_VENDIDOS)
        expect(grupos[0].nome).toBe('Mais vendidos')
        expect(grupos[0].produtos.map((x) => x.id)).toEqual(['palito', 'baldinho'])
        expect(grupos.find((g) => g.id === 'resfriados')?.produtos.map((x) => x.id)).toContain('baldinho')
    })

    it(`limita a ${LIMITE_MAIS_VENDIDOS} e pula quem não está na lista (inativo ou fora de venda)`, () => {
        const nono = p('nono', 'Nono do ranking')
        const produtos = [baldinho, balde, palito, chipa, pdq25, palito2, cocada, avulso, nono]
        const ranking = ['sumiu', 'baldinho', 'palito', 'balde', 'chipa', 'pdq25', 'cocada', 'palito2', 'avulso', 'nono']
        const grupos = montarGrupos(produtos, secoes, ranking)
        expect(grupos[0].produtos.map((x) => x.id)).toEqual(['baldinho', 'palito', 'balde', 'chipa', 'pdq25', 'cocada', 'palito2', 'avulso'])
    })

    it('sem ranking (carregando ou sem vendas), não mostra o grupo', () => {
        expect(montarGrupos([baldinho], secoes, []).map((g) => g.id)).toEqual(['resfriados'])
    })

    it('mostra até 8 no total', () => {
        expect(LIMITE_MAIS_VENDIDOS).toBe(8)
    })
})

describe('montarGrupos — fixados em Mais vendidos (pedido do Gilmar)', () => {
    const brigadeiro = p('brigadeiro', 'Brigadeiro de Colher Zero 400g', { secaoId: 'doces', ordemVitrine: 9, fixoMaisVendidos: true })
    const doceLeite = p('doce-leite', 'Doce de Leite Zero 400g', { secaoId: 'doces', ordemVitrine: 2, fixoMaisVendidos: true })

    it('fixados vêm primeiro, um ao lado do outro (pelo nome), e o ranking completa depois', () => {
        const grupos = montarGrupos([baldinho, palito, doceLeite, brigadeiro], secoes, ['palito', 'baldinho'])
        expect(grupos[0].produtos.map((x) => x.id)).toEqual(['brigadeiro', 'doce-leite', 'palito', 'baldinho'])
    })

    it('não repete: fixado que também está no ranking aparece uma vez só, na posição de fixado', () => {
        const grupos = montarGrupos([baldinho, palito, doceLeite, brigadeiro], secoes, ['doce-leite', 'palito', 'brigadeiro'])
        expect(grupos[0].produtos.map((x) => x.id)).toEqual(['brigadeiro', 'doce-leite', 'palito'])
    })

    it('até 8 no total, contando os fixados', () => {
        const produtos = [brigadeiro, doceLeite, baldinho, balde, palito, chipa, pdq25, palito2, cocada, avulso]
        const ranking = ['baldinho', 'balde', 'palito', 'chipa', 'pdq25', 'palito2', 'cocada', 'avulso']
        const ids = montarGrupos(produtos, secoes, ranking)[0].produtos.map((x) => x.id)
        expect(ids).toEqual(['brigadeiro', 'doce-leite', 'baldinho', 'balde', 'palito', 'chipa', 'pdq25', 'palito2'])
    })

    it('aparece mesmo sem nenhuma venda nos 90 dias (ranking vazio)', () => {
        const grupos = montarGrupos([brigadeiro, baldinho], secoes, [])
        expect(grupos[0].id).toBe(ID_MAIS_VENDIDOS)
        expect(grupos[0].produtos.map((x) => x.id)).toEqual(['brigadeiro'])
    })

    it('fixado inativo não aparece', () => {
        const desligado = { ...brigadeiro, ativo: false }
        const grupos = montarGrupos([desligado, baldinho], secoes, ['baldinho'])
        expect(grupos[0].produtos.map((x) => x.id)).toEqual(['baldinho'])
    })

    it('continua também na seção dele', () => {
        const grupos = montarGrupos([brigadeiro, doceLeite], secoes, [])
        expect(grupos.find((g) => g.id === 'doces')?.produtos.map((x) => x.id)).toEqual(['doce-leite', 'brigadeiro'])
    })
})

describe('rankingMaisVendidos', () => {
    it('ordena pelo número de vendas, não pela quantidade', () => {
        const linhas = [
            { produtoId: 'palito', vendaId: 'v1' },
            { produtoId: 'palito', vendaId: 'v1' }, // mesma venda: conta uma vez
            { produtoId: 'baldinho', vendaId: 'v2' },
            { produtoId: 'baldinho', vendaId: 'v3' },
            { produtoId: 'chipa', vendaId: 'v4' },
        ]
        // baldinho: 2 vendas; palito: 1 venda (com 2 linhas); chipa: 1 venda
        expect(rankingMaisVendidos(linhas)[0]).toBe('baldinho')
        expect(rankingMaisVendidos(linhas)).toHaveLength(3)
    })

    it('empate: desempata pelo id, para a ordem não pular entre aberturas', () => {
        const linhas = [
            { produtoId: 'b', vendaId: 'v1' },
            { produtoId: 'a', vendaId: 'v2' },
        ]
        expect(rankingMaisVendidos(linhas)).toEqual(['a', 'b'])
    })
})

describe('busca por nome ou apelido', () => {
    it('acha pelo apelido ("baldinho") e ignora acento e maiúscula ("pao", "PDQ")', () => {
        expect(casaBusca(baldinho, 'baldinho')).toBe(true)
        expect(casaBusca(pdq25, 'pao')).toBe(true)
        expect(casaBusca(pdq25, 'PDQ')).toBe(true)
        expect(casaBusca(baldinho, 'chipa')).toBe(false)
    })

    it('várias palavras: todas precisam aparecer, em qualquer ordem', () => {
        expect(casaBusca(pdq25, '25 pão')).toBe(true)
        expect(casaBusca(baldinho, 'massa 4kg')).toBe(false)
        expect(casaBusca(balde, 'massa 4kg')).toBe(true)
    })

    it('resultado é uma lista só, na ordem das seções, sem repetir o mais vendido', () => {
        const grupos = montarGrupos([cocada, palito, baldinho, balde], secoes, ['palito', 'baldinho'])
        expect(buscarProdutos(grupos, 'queijo').map((x) => x.id)).toEqual(['baldinho', 'balde', 'palito'])
    })
})

describe('contarItens', () => {
    it('soma as quantidades das linhas (dois combos montados = 2)', () => {
        expect(contarItens([{ quantidade: 2 }, { quantidade: 1 }, { quantidade: 1 }])).toBe(4)
        expect(contarItens([])).toBe(0)
    })
})
