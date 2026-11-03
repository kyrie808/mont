import { describe, expect, it } from 'vitest'
import { montarVitrine, type DadosVitrine, type LinhaProduto, type LinhaVitrine, type PrecoCampanha } from './montar'
import { ehCombo } from './tipos'

// Parte A da paridade: a loja monta a vitrine pelo cadastro do sistema interno.

const CONGELADOS = { id: 'sec-cong', nome: 'Congelados', slug: 'congelados' }
const RESFRIADOS = { id: 'sec-resf', nome: 'Resfriados', slug: 'resfriados' }

function produto(id: string, extra: Partial<LinhaProduto> = {}): LinhaProduto {
    return {
        id,
        codigo: id,
        nome: id,
        slug: id,
        subtitulo: null,
        descricao: null,
        preco: 30,
        estoque_atual: 0,
        eh_combo: false,
        visivel_catalogo: true,
        secao_id: CONGELADOS.id,
        ordem_vitrine: 0,
        selo: null,
        beneficios: null,
        instrucoes_preparo: null,
        ...extra,
    }
}

function linhaVitrine(produtoId: string, extra: Partial<LinhaVitrine> = {}): LinhaVitrine {
    return {
        produto_id: produtoId,
        secao_id: null,
        ordem_loja: null,
        disponivel: true,
        usa_estoque: false,
        destaque_hero: false,
        leva_junto: false,
        nome_loja: null,
        resumo: null,
        frase_card: null,
        ...extra,
    }
}

function dados(extra: Partial<DadosVitrine> = {}): DadosVitrine {
    return {
        campanha: null,
        produtos: [],
        vitrine: [],
        secoes: [CONGELADOS, RESFRIADOS],
        precos: new Map<string, PrecoCampanha>(),
        fixos: [],
        grupos: [],
        imagens: new Map(),
        fotoProvisoria: () => null,
        ...extra,
    }
}

const nomesDasSecoes = (d: DadosVitrine) => montarVitrine(d).secoes.map((s) => [s.nome, s.itens.map((p) => p.id)])

describe('vitrine pelo cadastro', () => {
    it('produto novo visível aparece sozinho, sem linha na vitrine da loja', () => {
        expect(nomesDasSecoes(dados({ produtos: [produto('chipa')] }))).toEqual([['Congelados', ['chipa']]])
    })

    it('"Visível no catálogo" desligado some da loja', () => {
        const v = montarVitrine(dados({ produtos: [produto('chipa', { visivel_catalogo: false })] }))
        expect(v.secoes).toEqual([])
    })

    it('abas na ordem das seções da tela Catálogo; seção vazia não aparece', () => {
        const d = dados({
            produtos: [produto('massa', { secao_id: RESFRIADOS.id }), produto('chipa')],
            secoes: [RESFRIADOS, CONGELADOS],
        })
        expect(nomesDasSecoes(d)).toEqual([
            ['Resfriados', ['massa']],
            ['Congelados', ['chipa']],
        ])
    })

    it('sem seção, ou com a seção desligada, vai para "Mais produtos" no fim', () => {
        const d = dados({
            produtos: [produto('sem', { secao_id: null }), produto('desligada', { secao_id: 'sec-off' }), produto('chipa')],
        })
        expect(nomesDasSecoes(d)).toEqual([
            ['Congelados', ['chipa']],
            ['Mais produtos', ['desligada', 'sem']],
        ])
    })

    it('ordem do cadastro (ordem_vitrine, depois nome); a ordem só da loja vence', () => {
        const d = dados({
            produtos: [produto('b', { ordem_vitrine: 1 }), produto('a', { ordem_vitrine: 1 }), produto('c', { ordem_vitrine: 0 })],
            vitrine: [linhaVitrine('c', { ordem_loja: 9 })],
        })
        expect(nomesDasSecoes(d)).toEqual([['Congelados', ['a', 'b', 'c']]])
    })

    it('seção só da loja (loja_vitrine.secao_id) vence a do cadastro', () => {
        const d = dados({ produtos: [produto('chipa')], vitrine: [linhaVitrine('chipa', { secao_id: RESFRIADOS.id })] })
        expect(nomesDasSecoes(d)).toEqual([['Resfriados', ['chipa']]])
    })

    it('até 4 avulsos: cartões; mais que isso: lista', () => {
        const quatro = dados({ produtos: ['a', 'b', 'c', 'd'].map((id) => produto(id)) })
        const cinco = dados({ produtos: ['a', 'b', 'c', 'd', 'e'].map((id) => produto(id)) })
        expect(montarVitrine(quatro).secoes[0]?.formato).toBe('cartoes')
        expect(montarVitrine(cinco).secoes[0]?.formato).toBe('lista')
    })

    it('esgotado só pela loja: chave manual, ou estoque quando ela manda controlar', () => {
        const d = dados({
            produtos: [produto('livre'), produto('chave'), produto('estoque', { estoque_atual: 0 }), produto('tem', { estoque_atual: 3 })],
            vitrine: [
                linhaVitrine('chave', { disponivel: false }),
                linhaVitrine('estoque', { usa_estoque: true }),
                linhaVitrine('tem', { usa_estoque: true }),
            ],
        })
        const disp = Object.fromEntries(montarVitrine(d).secoes[0]!.itens.map((p) => [p.id, p.disponivel]))
        expect(disp).toEqual({ chave: false, estoque: false, livre: true, tem: true })
    })

    it('fora de campanha não há preço riscado (a ancoragem do cadastro não vai para a loja)', () => {
        const p = montarVitrine(dados({ produtos: [produto('balde', { preco: 75 })] })).secoes[0]!.itens[0]!
        expect([p.preco, p.precoDe, p.precoCredito]).toEqual([75, null, null])
    })

    it('na campanha, riscado = preço normal do cadastro (75 → 65); sem desconto, sem riscado', () => {
        const d = dados({
            campanha: { nome: 'Black', fim: '2026-11-30T23:59:59-03:00' },
            produtos: [produto('balde', { preco: 75 }), produto('igual', { preco: 30 })],
            precos: new Map([
                ['balde', { pix: 65, credito: 68, ancora: null }],
                ['igual', { pix: 30, credito: 31, ancora: null }],
            ]),
        })
        const [balde, igual] = montarVitrine(d).secoes[0]!.itens
        expect([balde?.preco, balde?.precoDe, balde?.precoCredito, igual?.precoDe]).toEqual([65, 75, 68, null])
    })

    it('selo, benefícios e modo de preparo vêm do cadastro', () => {
        const d = dados({
            produtos: [
                produto('chipa', {
                    selo: 'mais_vendido',
                    beneficios: 'Sem conservante\n\n Queijo de verdade ',
                    instrucoes_preparo: 'Forno a 180 °C\nAsse 20 minutos',
                }),
            ],
        })
        const p = montarVitrine(d).secoes[0]!.itens[0]!
        expect([p.selo, p.beneficios, p.preparo]).toEqual([
            'Mais vendido',
            ['Sem conservante', 'Queijo de verdade'],
            ['Forno a 180 °C', 'Asse 20 minutos'],
        ])
    })

    it('nome e frase da loja vencem o nome do cadastro', () => {
        const d = dados({
            produtos: [produto('massa', { nome: 'Massa Pão de Queijo 4kg' })],
            vitrine: [linhaVitrine('massa', { nome_loja: 'Balde de massa 4 kg', frase_card: 'Rende pra família toda.' })],
        })
        const p = montarVitrine(d).secoes[0]!.itens[0]!
        expect([p.nome, p.chamada]).toEqual(['Balde de massa 4 kg', 'Rende pra família toda.'])
    })
})

describe('combos', () => {
    const fixos = [{ combo_id: 'dupla', quantidade: 1, brinde: false, componente: { id: 'zero', nome: 'Zero' } }]

    it('combo da campanha: só durante a campanha, no bloco próprio, mesmo sem "Visível no catálogo"', () => {
        const base = {
            produtos: [produto('dupla', { eh_combo: true, visivel_catalogo: false, secao_id: null }), produto('zero')],
            fixos,
            vitrine: [linhaVitrine('dupla', { destaque_hero: true })],
        }
        const fora = montarVitrine(dados(base))
        expect(fora.combos).toEqual([])
        expect(fora.secoes.flatMap((s) => s.itens.map((p) => p.id))).toEqual(['zero'])

        const dentro = montarVitrine(
            dados({
                ...base,
                campanha: { nome: 'Black', fim: '2026-11-30T23:59:59-03:00' },
                precos: new Map([['dupla', { pix: 75, credito: 78, ancora: 78 }]]),
            }),
        )
        expect(dentro.combos.map((c) => [c.id, c.preco, c.precoCredito, c.ancora, c.montavel])).toEqual([
            ['dupla', 75, 78, 78, true],
        ])
        expect(dentro.hero?.id).toBe('dupla')
    })

    it('combo permanente: na seção do cadastro, preço do cadastro, sem "separado", obedece ao "Visível no catálogo"', () => {
        const permanente = produto('kit', { eh_combo: true, preco: 95 })
        const fixosKit = [{ combo_id: 'kit', quantidade: 1, brinde: false, componente: { id: 'zero', nome: 'Zero' } }]
        const v = montarVitrine(dados({ produtos: [permanente, produto('zero')], fixos: fixosKit }))
        const kit = v.secoes[0]!.itens.find((p) => p.id === 'kit')!
        expect(ehCombo(kit)).toBe(true)
        expect(ehCombo(kit) && [kit.preco, kit.ancora, kit.montavel]).toEqual([95, null, true])

        const escondido = montarVitrine(
            dados({ produtos: [{ ...permanente, visivel_catalogo: false }, produto('zero')], fixos: fixosKit }),
        )
        expect(escondido.secoes.flatMap((s) => s.itens.map((p) => p.id))).toEqual(['zero'])
    })

    it('combo com item fixo esgotado fica esgotado', () => {
        const v = montarVitrine(
            dados({
                produtos: [produto('kit', { eh_combo: true }), produto('zero')],
                fixos: [{ combo_id: 'kit', quantidade: 1, brinde: false, componente: { id: 'zero', nome: 'Zero' } }],
                vitrine: [linhaVitrine('zero', { disponivel: false })],
            }),
        )
        expect(v.secoes[0]!.itens.find((p) => p.id === 'kit')?.disponivel).toBe(false)
    })
})
