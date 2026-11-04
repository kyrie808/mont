import { describe, expect, it } from 'vitest'
import { MAXIMO_FOTOS, moverFoto, tornarCapa, vagasNaGaleria } from './galeriaFotos'

describe('galeria de fotos do produto', () => {
    it('tornar capa leva a foto para o 1º lugar sem bagunçar as outras', () => {
        expect(tornarCapa(['a', 'b', 'c', 'd'], 'c')).toEqual(['c', 'a', 'b', 'd'])
        expect(tornarCapa(['a', 'b'], 'a')).toEqual(['a', 'b'])
        expect(tornarCapa(['a', 'b'], 'x')).toEqual(['a', 'b'])
    })

    it('arrastar move uma foto de posição (e arrastar para a 1ª troca a capa)', () => {
        expect(moverFoto(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
        expect(moverFoto(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
        expect(moverFoto(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
        expect(moverFoto(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    })

    it('vagas até o limite de 12', () => {
        expect(vagasNaGaleria([])).toBe(MAXIMO_FOTOS)
        expect(vagasNaGaleria(Array.from({ length: 12 }, (_, i) => `f${i}`))).toBe(0)
    })
})
