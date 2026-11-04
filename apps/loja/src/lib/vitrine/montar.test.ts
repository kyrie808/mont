import { describe, expect, it } from 'vitest'
import { montarVitrine, resumoDoCombo, type DadosVitrine, type LinhaGrupo, type LinhaProduto, type PrecoCampanha } from './montar'
import { ehCombo, type ComboLoja } from './tipos'

// Partes A e B da paridade: a loja monta a vitrine só pelo cadastro do sistema interno.

const CONGELADOS = { id: 'sec-cong', nome: 'Congelados', slug: 'congelados', descricao: null }
const RESFRIADOS = { id: 'sec-resf', nome: 'Resfriados', slug: 'resfriados', descricao: 'Queijo Canastra de verdade.' }
const BLACK = { nome: 'Black', fim: '2026-11-30T23:59:59-03:00' }

function produto(id: string, extra: Partial<LinhaProduto> = {}): LinhaProduto {
    return {
        id,
        codigo: id,
        nome: id,
        nome_loja: null,
        slug: id,
        subtitulo: null,
        descricao: null,
        preco: 30,
        eh_combo: false,
        visivel_catalogo: true,
        esgotado: false,
        destaque: false,
        secao_id: CONGELADOS.id,
        ordem_vitrine: 0,
        selo: null,
        beneficios: null,
        instrucoes_preparo: null,
        ...extra,
    }
}

function dados(extra: Partial<DadosVitrine> = {}): DadosVitrine {
    return {
        campanha: null,
        produtos: [],
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
    it('produto novo visível aparece sozinho', () => {
        expect(nomesDasSecoes(dados({ produtos: [produto('chipa')] }))).toEqual([['Congelados', ['chipa']]])
    })

    it('"Visível no catálogo" desligado some da loja', () => {
        const v = montarVitrine(dados({ produtos: [produto('chipa', { visivel_catalogo: false })] }))
        expect(v.secoes).toEqual([])
    })

    it('abas na ordem das seções da tela Catálogo, com a frase da seção; seção vazia não aparece', () => {
        const d = dados({
            produtos: [produto('massa', { secao_id: RESFRIADOS.id }), produto('chipa')],
            secoes: [RESFRIADOS, CONGELADOS],
        })
        expect(montarVitrine(d).secoes.map((s) => [s.nome, s.descricao, s.itens.map((p) => p.id)])).toEqual([
            ['Resfriados', 'Queijo Canastra de verdade.', ['massa']],
            ['Congelados', null, ['chipa']],
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

    it('ordem da tela Catálogo (ordem_vitrine, depois nome)', () => {
        const d = dados({
            produtos: [produto('b', { ordem_vitrine: 1 }), produto('a', { ordem_vitrine: 1 }), produto('c', { ordem_vitrine: 0 })],
        })
        expect(nomesDasSecoes(d)).toEqual([['Congelados', ['c', 'a', 'b']]])
    })

    it('até 4 avulsos: cartões; mais que isso: lista', () => {
        const quatro = dados({ produtos: ['a', 'b', 'c', 'd'].map((id) => produto(id)) })
        const cinco = dados({ produtos: ['a', 'b', 'c', 'd', 'e'].map((id) => produto(id)) })
        expect(montarVitrine(quatro).secoes[0]?.formato).toBe('cartoes')
        expect(montarVitrine(cinco).secoes[0]?.formato).toBe('lista')
    })

    it('"Esgotado" do cadastro tira da venda; o estoque não decide', () => {
        const d = dados({ produtos: [produto('livre'), produto('esgotado', { esgotado: true })] })
        const disp = Object.fromEntries(montarVitrine(d).secoes[0]!.itens.map((p) => [p.id, p.disponivel]))
        expect(disp).toEqual({ esgotado: false, livre: true })
    })

    it('fora de campanha não há preço riscado (a ancoragem do cadastro não vai para a loja)', () => {
        const p = montarVitrine(dados({ produtos: [produto('balde', { preco: 75 })] })).secoes[0]!.itens[0]!
        expect([p.preco, p.precoDe, p.precoCredito]).toEqual([75, null, null])
    })

    it('na campanha, riscado = preço normal do cadastro (75 → 65); sem desconto, sem riscado', () => {
        const d = dados({
            campanha: BLACK,
            produtos: [produto('balde', { preco: 75 }), produto('igual', { preco: 30 })],
            precos: new Map([
                ['balde', { pix: 65, credito: 68 }],
                ['igual', { pix: 30, credito: 31 }],
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

    it('"Nome na loja" vence o nome do cadastro; o card mostra o subtítulo', () => {
        const d = dados({
            produtos: [
                produto('massa', {
                    nome: 'Massa Pão de Queijo 4kg',
                    nome_loja: 'Balde de massa 4 kg',
                    subtitulo: 'Rende pra família toda.',
                }),
                produto('chipa', { nome: 'Chipa 1kg' }),
            ],
        })
        expect(montarVitrine(d).secoes[0]!.itens.map((p) => [p.nome, p.subtitulo])).toEqual([
            ['Chipa 1kg', null],
            ['Balde de massa 4 kg', 'Rende pra família toda.'],
        ])
    })
})

describe('combos', () => {
    const fixosDupla = [
        { combo_id: 'dupla', quantidade: 1, brinde: false, componente: { id: 'zero', nome: 'Doce zero' } },
        { combo_id: 'dupla', quantidade: 1, brinde: false, componente: { id: 'brig', nome: 'Brigadeiro zero' } },
    ]
    const comboDaCampanha = (id: string, extra: Partial<LinhaProduto> = {}) =>
        produto(id, { eh_combo: true, visivel_catalogo: false, secao_id: 'sec-combos', ...extra })

    it('combo da campanha: só durante a campanha, no bloco próprio, mesmo sem "Visível no catálogo"', () => {
        const base = {
            produtos: [comboDaCampanha('dupla'), produto('zero', { preco: 45 }), produto('brig', { preco: 45 })],
            fixos: fixosDupla,
        }
        const fora = montarVitrine(dados(base))
        expect(fora.combos).toEqual([])
        expect(fora.hero).toBeNull()

        const dentro = montarVitrine(
            dados({
                ...base,
                campanha: BLACK,
                precos: new Map([
                    ['dupla', { pix: 75, credito: 78 }],
                    ['zero', { pix: 39, credito: 41 }],
                    ['brig', { pix: 39, credito: 41 }],
                ]),
            }),
        )
        // "Separado" no preço VIGENTE (o da campanha): 39 + 39 = 78, nunca 45 + 45.
        expect(dentro.combos.map((c) => [c.id, c.preco, c.precoCredito, c.ancora, c.montavel])).toEqual([
            ['dupla', 75, 78, 78, true],
        ])
    })

    it('combos da campanha na ordem da tela Catálogo; banner = o de "Destaque", senão o primeiro', () => {
        const precos = new Map([
            ['a', { pix: 50, credito: 52 }],
            ['b', { pix: 60, credito: 62 }],
        ])
        const fixos = ['a', 'b'].map((c) => ({ combo_id: c, quantidade: 1, brinde: false, componente: { id: 'zero', nome: 'Zero' } }))
        const produtos = [comboDaCampanha('a', { ordem_vitrine: 2 }), comboDaCampanha('b', { ordem_vitrine: 1 }), produto('zero')]
        const sem = montarVitrine(dados({ campanha: BLACK, produtos, precos, fixos }))
        expect([sem.combos.map((c) => c.id), sem.hero?.id]).toEqual([['b', 'a'], 'b'])

        const com = montarVitrine(
            dados({ campanha: BLACK, produtos: [{ ...produtos[0]!, destaque: true }, produtos[1]!, produtos[2]!], precos, fixos }),
        )
        expect(com.hero?.id).toBe('a')
    })

    it('combo permanente: na seção do cadastro, preço do cadastro, "separado" no preço normal', () => {
        const permanente = produto('kit', { eh_combo: true, preco: 95 })
        const fixosKit = [{ combo_id: 'kit', quantidade: 2, brinde: false, componente: { id: 'zero', nome: 'Zero' } }]
        const v = montarVitrine(dados({ produtos: [permanente, produto('zero', { preco: 55 })], fixos: fixosKit }))
        const kit = v.secoes[0]!.itens.find((p) => p.id === 'kit')!
        expect(ehCombo(kit) && [kit.preco, kit.ancora, kit.montavel, kit.resumo]).toEqual([95, 110, true, '2× Zero'])

        const escondido = montarVitrine(
            dados({ produtos: [{ ...permanente, visivel_catalogo: false }, produto('zero')], fixos: fixosKit }),
        )
        expect(escondido.secoes.flatMap((s) => s.itens.map((p) => p.id))).toEqual(['zero'])
    })

    it('"separado" com sabores: cada grupo pelo sabor mais barato, brinde incluso (Café da Tarde = 108)', () => {
        const grupos: LinhaGrupo[] = [
            {
                id: 'g1',
                combo_id: 'cafe',
                titulo: 'Escolha 1 geleia de 680 g',
                rotulo_singular: 'geleia',
                rotulo_plural: 'geleias',
                quantidade: 1,
                permite_repetir: true,
                opcoes: [
                    { produto_id: 'morango', ordem: 1, produto: { nome: 'Geleia de morango' } },
                    { produto_id: 'vermelhas', ordem: 2, produto: { nome: 'Geleia de frutas vermelhas' } },
                ],
            },
        ]
        const fixos = [
            { combo_id: 'cafe', quantidade: 2, brinde: false, componente: { id: 'baldinho', nome: 'Baldinho 1 kg' } },
            { combo_id: 'cafe', quantidade: 1, brinde: true, componente: { id: 'dl400', nome: 'Doce de leite 400 g' } },
        ]
        const v = montarVitrine(
            dados({
                campanha: BLACK,
                produtos: [
                    comboDaCampanha('cafe'),
                    produto('baldinho', { preco: 30 }),
                    produto('dl400', { preco: 25 }),
                    produto('morango', { preco: 39 }),
                    produto('vermelhas', { preco: 41 }),
                ],
                precos: new Map([
                    ['cafe', { pix: 89, credito: 92 }],
                    ['baldinho', { pix: 27, credito: 28 }],
                    ['dl400', { pix: 21, credito: 22 }],
                    ['morango', { pix: 33, credito: 34 }],
                    ['vermelhas', { pix: 35, credito: 36 }],
                ]),
                fixos,
                grupos,
            }),
        )
        const cafe = v.combos[0] as ComboLoja
        expect([cafe.ancora, cafe.resumo]).toEqual([108, '2× Baldinho 1 kg + 1 geleia à escolha + Doce de leite 400 g de brinde'])
    })

    it('"Esgotado" num item fixo esgota o combo; num sabor, tira só a opção', () => {
        const grupos: LinhaGrupo[] = [
            {
                id: 'g1',
                combo_id: 'trio',
                titulo: 'Escolha 3 doces',
                rotulo_singular: 'doce',
                rotulo_plural: 'doces',
                quantidade: 3,
                permite_repetir: true,
                opcoes: [
                    { produto_id: 'coco', ordem: 1, produto: { nome: 'Coco' } },
                    { produto_id: 'milho', ordem: 2, produto: { nome: 'Milho' } },
                ],
            },
        ]
        const v = montarVitrine(
            dados({
                produtos: [
                    produto('kit', { eh_combo: true }),
                    produto('zero', { esgotado: true }),
                    produto('trio', { eh_combo: true }),
                    produto('coco', { esgotado: true }),
                    produto('milho'),
                ],
                fixos: [{ combo_id: 'kit', quantidade: 1, brinde: false, componente: { id: 'zero', nome: 'Zero' } }],
                grupos,
            }),
        )
        const itens = v.secoes[0]!.itens
        const trio = itens.find((p) => p.id === 'trio') as ComboLoja
        expect(itens.find((p) => p.id === 'kit')?.disponivel).toBe(false)
        expect([trio.disponivel, trio.montavel, trio.grupos[0]!.opcoes.map((o) => o.disponivel)]).toEqual([true, true, [false, true]])
    })
})

describe('resumoDoCombo', () => {
    it('itens fixos, grupos de escolha e brinde, nessa ordem', () => {
        expect(
            resumoDoCombo(
                [
                    { produtoId: 'b', nome: 'Balde 4 kg', quantidade: 1, brinde: false },
                    { produtoId: 'd', nome: 'Doce de leite 400 g', quantidade: 1, brinde: true },
                    { produtoId: 'm', nome: 'Baldinho 1 kg', quantidade: 2, brinde: false },
                ],
                [
                    {
                        id: 'g',
                        titulo: 'Escolha 6 doces',
                        rotuloSingular: 'doce',
                        rotuloPlural: 'doces',
                        quantidade: 6,
                        permiteRepetir: true,
                        opcoes: [],
                    },
                ],
            ),
        ).toBe('Balde 4 kg + 2× Baldinho 1 kg + 6 doces à escolha + Doce de leite 400 g de brinde')
    })

    it('sem itens, sem texto', () => {
        expect(resumoDoCombo([], [])).toBeNull()
    })
})
