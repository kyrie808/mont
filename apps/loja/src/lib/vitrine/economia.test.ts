import { describe, expect, it } from 'vitest'
import { economiaDoCombo, mostraSeloEconomia } from './economia'

describe('mostraSeloEconomia (selo só a partir de R$ 15, decisão de 02/11)', () => {
    it('Mesa Cheia (94) e Café da Tarde (19) mostram; Par Mineiro (9) e Trio Mineiro (8) não', () => {
        expect(mostraSeloEconomia(94)).toBe(true)
        expect(mostraSeloEconomia(19)).toBe(true)
        expect(mostraSeloEconomia(9)).toBe(false)
        expect(mostraSeloEconomia(8)).toBe(false)
    })

    it('R$ 15 em ponto mostra; R$ 14,99 não; sem economia não', () => {
        expect(mostraSeloEconomia(15)).toBe(true)
        expect(mostraSeloEconomia(14.99)).toBe(false)
        expect(mostraSeloEconomia(null)).toBe(false)
    })
})

describe('economiaDoCombo', () => {
    it('separado menos o preço do combo (Mesa Cheia: 293 − 199)', () => {
        expect(economiaDoCombo({ preco: 199, ancora: 293 })).toBe(94)
    })

    it('sem preço separado, sem selo', () => {
        expect(economiaDoCombo({ preco: 75, ancora: null })).toBeNull()
    })

    it('separado igual ou menor que o combo não vira "economia"', () => {
        expect(economiaDoCombo({ preco: 89, ancora: 89 })).toBeNull()
        expect(economiaDoCombo({ preco: 89, ancora: 80 })).toBeNull()
    })

    it('centavos sem erro de arredondamento', () => {
        expect(economiaDoCombo({ preco: 79.9, ancora: 87.5 })).toBe(7.6)
    })
})
