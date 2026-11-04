import { describe, expect, it } from 'vitest'
import { compradosJuntos } from './compradosJuntos'
import type { ProdutoLoja } from './tipos'

function produto(id: string, categoria: string | null = null, disponivel = true): ProdutoLoja {
    return {
        id,
        slug: id,
        nome: id,
        subtitulo: null,
        descricao: null,
        imagemUrl: null,
        fotos: [],
        categoria,
        selo: null,
        beneficios: [],
        preparo: [],
        preco: 30,
        precoDe: null,
        precoCredito: null,
        disponivel,
    }
}

const balde = produto('balde', 'congelado')
const vitrine = [
    balde,
    produto('chipa', 'congelado'),
    produto('palito', 'congelado'),
    produto('doce-leite', 'refrigerado'),
    produto('goiabada', 'refrigerado'),
    produto('cocada', 'refrigerado', false),
    produto('amora', 'refrigerado'),
]
const ids = (lista: ProdutoLoja[]) => lista.map((p) => p.id)

describe('"Leve junto" da página do produto (mesma regra do catálogo antigo)', () => {
    it('primeiro quem foi comprado junto, na ordem da pontuação; completa até 4 pela categoria e depois qualquer um', () => {
        expect(ids(compradosJuntos(balde, ['goiabada'], vitrine))).toEqual(['goiabada', 'chipa', 'palito', 'doce-leite'])
    })

    it('nunca o próprio produto, nem esgotado, nem o que não está na loja', () => {
        const r = ids(compradosJuntos(balde, ['balde', 'cocada', 'fora-da-loja', 'amora'], vitrine))
        expect(r).not.toContain('balde')
        expect(r).not.toContain('cocada')
        expect(r).not.toContain('fora-da-loja')
        expect(r[0]).toBe('amora')
    })

    it('com 4 ou mais comprados juntos não completa; no máximo 8', () => {
        const muitos = Array.from({ length: 10 }, (_, i) => produto(`p${i}`))
        const r = compradosJuntos(balde, muitos.map((p) => p.id), [balde, ...muitos])
        expect(ids(r)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'])
        expect(ids(compradosJuntos(balde, ['chipa', 'palito', 'doce-leite', 'goiabada'], vitrine))).toEqual([
            'chipa',
            'palito',
            'doce-leite',
            'goiabada',
        ])
    })
})
