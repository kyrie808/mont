import { describe, expect, it } from 'vitest'
import { fretePorDistancia, valorDaRegiao, type FreteConfig } from './calculo'

// Regra final de 04/11/2026: ABC = R$ 5 pela cidade do CEP; fora dele, até 21 km R$ 10, até 35 km R$ 15.
const REGRA_FINAL: FreteConfig = {
    modo: 'valor_fixo',
    origem: { lat: -23.72, lng: -46.52 },
    faixas: [
        { ateKm: 21, valorFixo: 10 },
        { ateKm: 35, valorFixo: 15 },
    ],
    regiaoFixa: {
        nome: 'ABC',
        valor: 5,
        cidades: [
            'Santo André',
            'São Bernardo do Campo',
            'São Caetano do Sul',
            'Diadema',
            'Mauá',
            'Ribeirão Pires',
            'Rio Grande da Serra',
        ],
    },
}

describe('regra final do frete (ABC pela cidade)', () => {
    it('qualquer cidade do ABC = R$ 5, com ou sem acento', () => {
        expect(['São Bernardo do Campo', 'sao bernardo do campo', 'Mauá', 'RIO GRANDE DA SERRA'].map((c) => valorDaRegiao(c, REGRA_FINAL))).toEqual([
            5, 5, 5, 5,
        ])
    })

    it('fora do ABC não tem valor fixo (vale a distância)', () => {
        expect([valorDaRegiao('São Paulo', REGRA_FINAL), valorDaRegiao(null, REGRA_FINAL)]).toEqual([null, null])
        expect(valorDaRegiao('Diadema', { ...REGRA_FINAL, regiaoFixa: undefined })).toBeNull()
    })

    it('fora do ABC: até 21 km R$ 10, até 35 km R$ 15, acima disso a combinar', () => {
        // Vila Moraes 18,3 · Saúde 20,7 · Interlagos 21,9 · Mirandópolis 22,6 · Sé 26,4 · 36 km
        expect([18.3, 20.7, 21.9, 22.6, 26.4, 36].map((km) => fretePorDistancia(km, REGRA_FINAL))).toEqual([10, 10, 15, 15, 15, null])
    })
})

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
