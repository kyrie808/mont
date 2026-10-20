import { describe, it, expect } from 'vitest'
import type { ItemAgenda } from '@mont/shared'
import {
    TODAS_LIGADAS, CHAVE_CAMADAS, bateBusca, chipsPorDia, cortarChips, gradeDoMes, horaCurta, intervaloDaGrade,
    lerCamadas, nomeCurto, nomeDoMes, quebraPorForma, restoDoTitulo, resumirAtrasados, rotuloDoItem, rotuloDoLembrete,
    salvarCamadas, somarDias, somarMeses, valorCurto,
} from '../agenda'

// Camada pura da tela Agenda: grade do mês, chips por dia, camadas e persistência.

function item(p: Partial<ItemAgenda> & Pick<ItemAgenda, 'origem' | 'data'>): ItemAgenda {
    return {
        id: crypto.randomUUID(),
        hora: null,
        titulo: 'Item',
        descricao: null,
        tipo: null,
        situacao: 'pendente',
        atrasado: false,
        contato_id: null,
        contato_nome: null,
        contato_telefone: null,
        venda_id: null,
        forma_pagamento: null,
        valor: null,
        responsavel: null,
        ...p,
    }
}

describe('grade do mês', () => {
    it('outubro/2026: começa no domingo 27/09 e termina no sábado 31/10 (5 semanas)', () => {
        const g = gradeDoMes('2026-10')
        expect(g).toHaveLength(5)
        expect(g[0][0]).toEqual({ dia: '2026-09-27', numero: 27, doMes: false })
        expect(g[0][4]).toEqual({ dia: '2026-10-01', numero: 1, doMes: true })
        expect(g[4][6]).toEqual({ dia: '2026-10-31', numero: 31, doMes: true })
        expect(intervaloDaGrade('2026-10')).toEqual({ inicio: '2026-09-27', fim: '2026-10-31' })
    })

    it('novembro/2026: 01/11 é domingo e a grade vai até 05/12', () => {
        const g = gradeDoMes('2026-11')
        expect(g[0][0].dia).toBe('2026-11-01')
        expect(intervaloDaGrade('2026-11')).toEqual({ inicio: '2026-11-01', fim: '2026-12-05' })
    })

    it('mês de 6 semanas (agosto/2026)', () => {
        expect(gradeDoMes('2026-08')).toHaveLength(6)
    })

    it('navegação e nomes', () => {
        expect(somarMeses('2026-12', 1)).toBe('2027-01')
        expect(somarMeses('2026-01', -1)).toBe('2025-12')
        expect(somarDias('2026-10-31', 1)).toBe('2026-11-01')
        expect(nomeDoMes('2026-10')).toBe('Outubro de 2026')
        expect(nomeDoMes('2026-03')).toBe('Março de 2026')
    })
})

describe('chips por dia', () => {
    it('vários vencimentos no mesmo dia viram um chip agregado com o total do banco', () => {
        const itens = [
            item({ origem: 'vencimento', data: '2026-11-13', contato_nome: 'A', valor: 60 }),
            item({ origem: 'vencimento', data: '2026-11-13', contato_nome: 'B', valor: 75.5 }),
            item({ origem: 'lembrete', data: '2026-11-13', titulo: 'Ligar' }),
        ]
        const chips = chipsPorDia(itens, TODAS_LIGADAS).get('2026-11-13')!
        expect(chips).toHaveLength(2)
        expect(chips[0]).toMatchObject({ tipo: 'item' })
        expect(chips[1]).toMatchObject({ tipo: 'vencimentos', total: 135.5 })
        if (chips[1].tipo === 'vencimentos') expect(chips[1].itens).toHaveLength(2)
    })

    it('um vencimento só fica como chip normal', () => {
        const chips = chipsPorDia([item({ origem: 'vencimento', data: '2026-11-07', valor: 65 })], TODAS_LIGADAS).get('2026-11-07')!
        expect(chips).toEqual([expect.objectContaining({ tipo: 'item' })])
    })

    it('ordem: lembrete (dia inteiro antes, depois por hora), vencimento, entrega, conta, retomada', () => {
        const chips = chipsPorDia([
            item({ origem: 'retomada', data: '2026-10-21', titulo: 'R' }),
            item({ origem: 'entrega', data: '2026-10-21', titulo: 'E' }),
            item({ origem: 'lembrete', data: '2026-10-21', titulo: 'L 14h', hora: '14:00:00' }),
            item({ origem: 'conta_pagar', data: '2026-10-21', titulo: 'C' }),
            item({ origem: 'lembrete', data: '2026-10-21', titulo: 'L dia', hora: null }),
            item({ origem: 'vencimento', data: '2026-10-21', titulo: 'V' }),
        ], TODAS_LIGADAS).get('2026-10-21')!
        expect(chips.map((c) => (c.tipo === 'item' ? c.item.titulo : 'agregado'))).toEqual(['L dia', 'L 14h', 'V', 'E', 'C', 'R'])
    })

    it('camada desligada esconde os itens dela; busca filtra por título ou cliente, sem acento', () => {
        const itens = [
            item({ origem: 'lembrete', data: '2026-10-20', titulo: 'Conferir depósito', contato_nome: 'Patrícia' }),
            item({ origem: 'entrega', data: '2026-10-20', titulo: 'Alice', contato_nome: 'Alice' }),
        ]
        expect(chipsPorDia(itens, { ...TODAS_LIGADAS, entregas: false }).get('2026-10-20')).toHaveLength(1)
        expect(chipsPorDia(itens, TODAS_LIGADAS, 'patricia').get('2026-10-20')).toHaveLength(1)
        expect(chipsPorDia(itens, TODAS_LIGADAS, 'DEPOSITO').get('2026-10-20')).toHaveLength(1)
        expect(chipsPorDia(itens, TODAS_LIGADAS, 'ninguém').get('2026-10-20')).toBeUndefined()
        expect(bateBusca({ titulo: 'x', contato_nome: null }, '   ')).toBe(true)
    })

    it('corte em 3: até 3 cabem; com 4 ou mais, 2 chips + "+N mais"', () => {
        const chips = [1, 2, 3, 4, 5].map((n) => ({ tipo: 'item' as const, item: item({ origem: 'lembrete', data: '2026-10-20', titulo: `L${n}` }) }))
        expect(cortarChips(chips.slice(0, 3))).toEqual({ visiveis: chips.slice(0, 3), mais: 0 })
        expect(cortarChips(chips)).toEqual({ visiveis: chips.slice(0, 2), mais: 3 })
    })
})

describe('camadas no navegador', () => {
    function storage(inicial: Record<string, string> = {}) {
        const dados = { ...inicial }
        return {
            dados,
            getItem: (k: string) => dados[k] ?? null,
            setItem: (k: string, v: string) => { dados[k] = v },
        }
    }

    it('sem nada salvo, ou com lixo, ou com storage quebrado → todas ligadas', () => {
        expect(lerCamadas(storage())).toEqual(TODAS_LIGADAS)
        expect(lerCamadas(storage({ [CHAVE_CAMADAS]: '{lixo' }))).toEqual(TODAS_LIGADAS)
        expect(lerCamadas(storage({ [CHAVE_CAMADAS]: '42' }))).toEqual(TODAS_LIGADAS)
        expect(lerCamadas({ getItem: () => { throw new Error('bloqueado') } })).toEqual(TODAS_LIGADAS)
        expect(lerCamadas(null)).toEqual(TODAS_LIGADAS)
    })

    it('salva e lê de volta; chave desconhecida é ignorada', () => {
        const s = storage()
        salvarCamadas(s, { ...TODAS_LIGADAS, entregas: false, retomadas: false })
        expect(lerCamadas(s)).toEqual({ ...TODAS_LIGADAS, entregas: false, retomadas: false })
        expect(lerCamadas(storage({ [CHAVE_CAMADAS]: '{"contas":false,"x":true,"lembretes":"sim"}' })))
            .toEqual({ ...TODAS_LIGADAS, contas: false })
        expect(() => salvarCamadas({ setItem: () => { throw new Error('cheio') } }, TODAS_LIGADAS)).not.toThrow()
    })
})

describe('textos e resumos', () => {
    it('hora curta 24h, rótulo por origem', () => {
        expect(horaCurta('14:30:00')).toBe('14h30')
        expect(horaCurta('09:00:00')).toBe('9h')
        expect(horaCurta(null)).toBeNull()
        expect(rotuloDoItem(item({ origem: 'retomada', data: '2026-10-21', titulo: 'Zélia', contato_nome: 'Zélia' }))).toBe('Retomar: Zélia')
        expect(rotuloDoItem(item({ origem: 'vencimento', data: '2026-10-21', titulo: 'x', contato_nome: 'Ana Maria' }))).toBe('Ana Maria')
        expect(rotuloDoItem(item({ origem: 'lembrete', data: '2026-10-21', titulo: 'Ana Maria — 1ª parcela' }))).toBe('Ana Maria — 1ª parcela')
    })

    it('atrasados em dois grupos com valor; quebra do sem data por forma', () => {
        const r = resumirAtrasados([
            item({ origem: 'lembrete', data: '2026-10-18', valor: 40 }),
            item({ origem: 'lembrete', data: '2026-10-18', valor: null }),
            item({ origem: 'vencimento', data: '2026-10-09', valor: 30 }),
            item({ origem: 'vencimento', data: '2026-10-09', valor: 60 }),
            item({ origem: 'vencimento', data: '2026-10-09', valor: 45 }),
        ])
        expect(r.lembretes).toHaveLength(2)
        expect(r.valorLembretes).toBe(40)
        expect(r.vencimentos).toHaveLength(3)
        expect(r.valorVencimentos).toBe(135)
        expect(quebraPorForma([
            { forma_pagamento: 'pix', valor: 10 }, { forma_pagamento: 'venda', valor: 20 },
            { forma_pagamento: 'venda', valor: 30 }, { forma_pagamento: 'fiado', valor: 5 },
        ])).toEqual([
            { forma: 'venda', quantidade: 2, valor: 50 },
            { forma: 'fiado', quantidade: 1, valor: 5 },
            { forma: 'pix', quantidade: 1, valor: 10 },
        ])
    })
})

describe('rótulo curto do lembrete (cliente primeiro)', () => {
    // Títulos e nomes no formato dos lembretes reais de outubro/2026.
    const casos: Array<[string, string | null, string]> = [
        ['Retomar cobrança — Simone', 'Simone Araujo de Oliveira', 'Simone · cobrança'],
        ['Gilmar: Andrea — Pix de R$ 135 em 17/10', 'Andrea Santos', 'Andrea · Gilmar'],
        ['Ana Maria — 1ª parcela', 'Ana Maria Oliveira da Silva', 'Ana Maria · 1ª parcela'],
        ['Retomar cobrança — Carol', 'Caroline Gomes (Carol)', 'Carol · cobrança'],
        ['Retomar cobrança — Rosângela Maradona', 'Rosangela Maradona', 'Rosangela Maradona · cobrança'],
        ['Gilmar: depósito de R$ 30 da Patrícia', 'Patricia Mara Botias (Copa)', 'Patricia · Gilmar'],
        ['Cobrar Ana Maria Oliveira da Silva', 'Ana Maria Oliveira da Silva', 'Ana Maria Oliveira da Silva · Cobrar'],
        ['Ligar sobre o pedido', 'João Pedro', 'João · Ligar sobre o pedido'],
        ['Gilmar: conferir as 16 vendas "venda/pix" sem pagamento', null, 'Gilmar: conferir as 16 vendas "venda/pix" sem pagamento'],
    ]
    it.each(casos)('%s', (titulo, contato_nome, esperado) => {
        expect(rotuloDoLembrete({ titulo, contato_nome })).toBe(esperado)
    })

    it('nome como palavra inteira: "Ana" não bate dentro de "Banana"', () => {
        expect(nomeCurto('Ana Souza', 'Levar banana')).toBe('Ana')
        expect(restoDoTitulo('Levar banana', 'Ana')).toBe('Levar banana')
    })
})

describe('valor curto do chip', () => {
    const semNbsp = (s: string) => s.replace(/\u00a0/g, ' ')
    it('inteiro sem centavos, quebrado com centavos', () => {
        expect(semNbsp(valorCurto(885))).toBe('R$ 885')
        expect(semNbsp(valorCurto(1875))).toBe('R$ 1.875')
        expect(semNbsp(valorCurto(32.5))).toBe('R$ 32,50')
        // Soma de centavos em ponto flutuante (0,1 + 0,2…) não vira 'R$ 885,00'.
        expect(semNbsp(valorCurto(884.9999999999))).toBe('R$ 885')
    })
})
