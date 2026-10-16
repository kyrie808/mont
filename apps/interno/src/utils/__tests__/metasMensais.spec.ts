import { describe, it, expect } from 'vitest'
import { hojeBrasilia } from '@mont/shared'
import {
    diasNoMes,
    diaDoMesBrasilia,
    diasRestantes,
    mostrarSugestao,
    ritmoDaMeta,
    indicadorDiario,
    resolverMetaFaturamento,
    semaforoAReceber,
    AVISO_SEM_META,
} from '../metasMensais'

const OUTUBRO = { minima: 9300, alvo: 11200 }

describe('hojeBrasilia', () => {
    it('depois das 21h de Brasília o UTC já virou o dia — hoje continua o de Brasília', () => {
        // 16/10 22:30 em Brasília = 17/10 01:30 UTC
        expect(hojeBrasilia(new Date('2026-10-17T01:30:00Z'))).toBe('2026-10-16')
    })
    it('vira à meia-noite de Brasília (03:00 UTC)', () => {
        expect(hojeBrasilia(new Date('2026-10-16T02:59:59Z'))).toBe('2026-10-15')
        expect(hojeBrasilia(new Date('2026-10-16T03:00:00Z'))).toBe('2026-10-16')
    })
})

describe('dias do mês / dias restantes', () => {
    it('conta os dias do mês (inclui bissexto)', () => {
        expect(diasNoMes(2026, 10)).toBe(31)
        expect(diasNoMes(2026, 11)).toBe(30)
        expect(diasNoMes(2028, 2)).toBe(29)
    })
    it('inclui hoje: dia 16 de 31 → 16 dias, dia 1 → 31', () => {
        expect(diasRestantes(16, 31)).toBe(16)
        expect(diasRestantes(1, 31)).toBe(31)
    })
    it('último dia do mês → 1 dia restante (nunca 0)', () => {
        expect(diasRestantes(31, 31)).toBe(1)
    })
    it('31/10 às 23h em Brasília ainda é outubro, com 1 dia restante', () => {
        // 31/10 23:00 em Brasília = 01/11 02:00 UTC
        const d = diaDoMesBrasilia(new Date('2026-11-01T02:00:00Z'))
        expect(d).toEqual({ ano: 2026, mes: 10, dia: 31, diasNoMes: 31 })
        expect(diasRestantes(d.dia, d.diasNoMes)).toBe(1)
    })
    it('16/10 às 21h30 em Brasília é dia 16, não 17', () => {
        const d = diaDoMesBrasilia(new Date('2026-10-17T00:30:00Z'))
        expect(d.dia).toBe(16)
        expect(diasRestantes(d.dia, d.diasNoMes)).toBe(16)
    })
})

describe('ritmoDaMeta — semáforo pelo ritmo (dia 16 de 31)', () => {
    const base = { meta: OUTUBRO, dia: 16, diasNoMes: 31, emCurso: true }
    // ritmo esperado: mínima 9300×16/31 = 4800; alvo 11200×16/31 ≈ 5780,65

    it('verde: no ritmo do alvo ou acima', () => {
        expect(ritmoDaMeta({ ...base, faturado: 5781 }).semaforo).toBe('verde')
    })
    it('amarelo: entre o ritmo da mínima e o do alvo', () => {
        expect(ritmoDaMeta({ ...base, faturado: 4931 }).semaforo).toBe('amarelo')
        expect(ritmoDaMeta({ ...base, faturado: 4800 }).semaforo).toBe('amarelo')
    })
    it('vermelho: abaixo do ritmo da mínima', () => {
        expect(ritmoDaMeta({ ...base, faturado: 4799 }).semaforo).toBe('vermelho')
    })
    it('% da mínima, % do alvo e projeção', () => {
        const r = ritmoDaMeta({ ...base, faturado: 4931 })
        expect(r.pctMinima).toBeCloseTo(53.02, 2)
        expect(r.pctAlvo).toBeCloseTo(44.03, 2)
        expect(r.projecao).toBeCloseTo((4931 / 16) * 31, 6) // ≈ 9553,81
    })
    it('mês fechado: sem pro-rata, projeção = faturado', () => {
        const r = ritmoDaMeta({ meta: OUTUBRO, faturado: 9500, dia: 16, diasNoMes: 31, emCurso: false })
        expect(r.paceFactor).toBe(1)
        expect(r.semaforo).toBe('amarelo')
        expect(r.projecao).toBe(9500)
    })
})

describe('indicadorDiario', () => {
    const ticket = 4931 / 74 // ticket da view: por pedido distinto

    it('abaixo da mínima: faltas, R$/dia e pedidos necessários pela mínima', () => {
        const i = indicadorDiario({ faturado: 4931, meta: OUTUBRO, dia: 16, diasNoMes: 31, ticketMedio: ticket })
        expect(i.fase).toBe('minima')
        expect(i.diasRestantes).toBe(16)
        expect(i.faltaMinima).toBe(4369)
        expect(i.porDiaMinima).toBeCloseTo(273.0625, 6)
        expect(i.faltaAlvo).toBe(6269)
        expect(i.porDiaAlvo).toBeCloseTo(391.8125, 6)
        expect(i.pedidosNecessarios).toBe(5) // ⌈273,06 ÷ 66,64⌉ = ⌈4,10⌉
    })
    it('divisão exata não arredonda pra cima por ponto flutuante', () => {
        const i = indicadorDiario({ faturado: 0, meta: { minima: 3100, alvo: 3100 }, dia: 1, diasNoMes: 31, ticketMedio: 25 })
        expect(i.porDiaMinima).toBe(100)
        expect(i.pedidosNecessarios).toBe(4)
    })
    it('último dia do mês: tudo o que falta é pra hoje', () => {
        const i = indicadorDiario({ faturado: 9000, meta: OUTUBRO, dia: 31, diasNoMes: 31, ticketMedio: 60 })
        expect(i.diasRestantes).toBe(1)
        expect(i.porDiaMinima).toBe(300)
        expect(i.pedidosNecessarios).toBe(5)
    })
    it('mínima batida: passa a mirar o alvo', () => {
        const i = indicadorDiario({ faturado: 9500, meta: OUTUBRO, dia: 26, diasNoMes: 31, ticketMedio: 60 })
        expect(i.fase).toBe('alvo')
        expect(i.faltaMinima).toBe(0)
        expect(i.faltaAlvo).toBe(1700)
        expect(i.porDiaAlvo).toBeCloseTo(1700 / 6, 6)
        expect(i.pedidosNecessarios).toBe(5) // ⌈283,33 ÷ 60⌉
    })
    it('alvo batido: meta do mês batida, sem pedidos necessários', () => {
        const i = indicadorDiario({ faturado: 11200, meta: OUTUBRO, dia: 28, diasNoMes: 31, ticketMedio: 60 })
        expect(i.fase).toBe('batida')
        expect(i.faltaAlvo).toBe(0)
        expect(i.pedidosNecessarios).toBeNull()
    })
    it('mês ainda sem venda (ticket 0): pedidos necessários indefinido', () => {
        const i = indicadorDiario({ faturado: 0, meta: OUTUBRO, dia: 1, diasNoMes: 31, ticketMedio: 0 })
        expect(i.pedidosNecessarios).toBeNull()
        expect(i.porDiaMinima).toBe(300)
    })
})

describe('resolverMetaFaturamento — mês sem meta', () => {
    it('com meta cadastrada → faixa fixa (numeric do PostgREST vira number)', () => {
        expect(resolverMetaFaturamento({ meta_minima: 9300, meta_alvo: 11200 }, 9331.86)).toEqual({
            tipo: 'fixa', faixa: { minima: 9300, alvo: 11200 },
        })
    })
    it('sem meta → volta à média e avisa', () => {
        expect(resolverMetaFaturamento(null, 9331.86)).toEqual({ tipo: 'media', media: 9331.86, aviso: AVISO_SEM_META })
    })
})

describe('mostrarSugestao — últimos 5 dias do mês', () => {
    it('mês de 31: a partir do dia 27', () => {
        expect(mostrarSugestao(26, 31)).toBe(false)
        expect(mostrarSugestao(27, 31)).toBe(true)
        expect(mostrarSugestao(31, 31)).toBe(true)
    })
    it('fevereiro de 28: a partir do dia 24', () => {
        expect(mostrarSugestao(23, 28)).toBe(false)
        expect(mostrarSugestao(24, 28)).toBe(true)
    })
})

describe('semaforoAReceber', () => {
    it('sem limite → null (card não muda)', () => {
        expect(semaforoAReceber(5000, null)).toBeNull()
    })
    it('verde até 80%, amarelo até o limite, vermelho acima', () => {
        expect(semaforoAReceber(800, 1000)).toBe('verde')
        expect(semaforoAReceber(801, 1000)).toBe('amarelo')
        expect(semaforoAReceber(1000, 1000)).toBe('amarelo')
        expect(semaforoAReceber(1001, 1000)).toBe('vermelho')
    })
})
