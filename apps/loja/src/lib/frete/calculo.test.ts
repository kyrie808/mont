import { describe, expect, it } from 'vitest'
import { fretePorDistancia, type FreteConfig } from './calculo'

// A config que está no ar (configuracoes.frete_config): R$ 5 até 20 km, 10 até 30, 15 até 50.
const MONT: FreteConfig = {
    modo: 'valor_fixo',
    origem: { lat: -23.72, lng: -46.52 },
    faixas: [
        { ateKm: 20, valorFixo: 5 },
        { ateKm: 30, valorFixo: 10 },
        { ateKm: 50, valorFixo: 15 },
    ],
}

describe('fretePorDistancia', () => {
    it('valor fechado da faixa em que a distância cai', () => {
        expect([3, 20, 20.1, 30, 49.9].map((km) => fretePorDistancia(km, MONT))).toEqual([5, 5, 10, 10, 15])
    })

    it('além da última faixa: a combinar', () => {
        expect(fretePorDistancia(50.1, MONT)).toBeNull()
    })

    it('faixa sem valor ou distância inválida: a combinar, nunca R$ 0', () => {
        expect(fretePorDistancia(10, { ...MONT, faixas: [{ ateKm: 20, valorFixo: 0 }] })).toBeNull()
        expect(fretePorDistancia(Number.NaN, MONT)).toBeNull()
        expect(fretePorDistancia(10, { ...MONT, faixas: [] })).toBeNull()
    })

    it('progressivo: cada trecho pela taxa da sua faixa', () => {
        const progressivo: FreteConfig = {
            modo: 'progressivo',
            origem: MONT.origem,
            faixas: [
                { ateKm: 10, valorPorKm: 1 },
                { ateKm: 20, valorPorKm: 0.5 },
            ],
        }
        expect(fretePorDistancia(15, progressivo)).toBe(12.5)
    })
})
