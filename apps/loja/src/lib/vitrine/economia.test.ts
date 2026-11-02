import { describe, expect, it } from 'vitest'
import { economiaDoCombo } from './economia'

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
