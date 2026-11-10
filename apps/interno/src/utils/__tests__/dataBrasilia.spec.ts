import { describe, it, expect } from 'vitest'
import { endOfMonth, startOfMonth } from 'date-fns'
import { agoraBrasiliaInput, diaBrasilia, hojeBrasilia } from '@mont/shared'

/**
 * Helper único de "hoje"/"agora" em Brasília (10/11/2026). Substituiu, no interno:
 *  - `new Date().toISOString().split('T')[0]` (UTC: depois das 21h já é amanhã — foi assim que
 *    2 contas a pagar de 07/07/2026 saíram com emissão 08/07);
 *  - as cópias de `toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })`, que estavam certas
 *    e continuam dando exatamente o mesmo valor.
 */

const SV = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })

// Instantes cobrindo o dia inteiro e as bordas: 20h59, 21h00, 23h59 e 00h00 de Brasília.
const instantes = [
    '2026-07-07T23:59:59Z', // 20h59 SP
    '2026-07-08T00:00:00Z', // 21h00 SP — UTC já virou
    '2026-07-08T02:18:19Z', // 23h18 SP (a "Mensalidade Internet" de 07/07)
    '2026-07-08T02:59:59Z', // 23h59 SP
    '2026-07-08T03:00:00Z', // 00h00 SP
    '2026-11-10T14:05:00Z', // meio da manhã
    '2026-12-31T23:30:00Z', // virada de ano: 20h30 SP de 31/12
    '2027-01-01T02:45:00Z', // 23h45 SP de 31/12
].map((s) => new Date(s))

describe('hojeBrasilia / diaBrasilia', () => {
    it('depois das 21h de Brasília continua o dia de Brasília (o UTC já virou)', () => {
        const as23h18 = new Date('2026-07-08T02:18:19Z')
        expect(as23h18.toISOString().split('T')[0]).toBe('2026-07-08') // o bug antigo
        expect(hojeBrasilia(as23h18)).toBe('2026-07-07')
        expect(diaBrasilia(as23h18)).toBe('2026-07-07')
    })

    it('dá o mesmo dia que a expressão sv-SE que já estava certa, em todos os instantes', () => {
        for (const d of instantes) expect(diaBrasilia(d), d.toISOString()).toBe(SV(d).split(' ')[0])
    })

    it('filtro do mês em Vendas: os limites são o 1º e o último dia do mês, não o dia 1º do seguinte', () => {
        const julho = new Date(2026, 6, 15, 12)
        const inicio = startOfMonth(julho)
        const fim = endOfMonth(julho) // 31/07 23:59:59.999 no fuso do aparelho
        expect(diaBrasilia(inicio)).toBe('2026-07-01')
        expect(diaBrasilia(fim)).toBe('2026-07-31')
    })
})

describe('agoraBrasiliaInput', () => {
    it('dá o mesmo valor de datetime-local que a expressão sv-SE antiga', () => {
        for (const d of instantes) expect(agoraBrasiliaInput(d), d.toISOString()).toBe(SV(d).replace(' ', 'T').slice(0, 16))
    })

    it('meia-noite sai 00:00, nunca 24:00', () => {
        expect(agoraBrasiliaInput(new Date('2026-07-08T03:00:00Z'))).toBe('2026-07-08T00:00')
    })
})
