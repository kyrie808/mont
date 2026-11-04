import { describe, expect, it } from 'vitest'
import type { ComboLoja, ProdutoLoja } from '@/lib/vitrine/tipos'
import type { Catalogo } from './calculo'
import { escolherLevaJunto, idsDaSacola, somarIndicacoes } from './levaJunto'

function produto(id: string, disponivel = true): ProdutoLoja {
    return {
        id,
        slug: id,
        nome: id,
        subtitulo: null,
        descricao: null,
        imagemUrl: null,
        fotos: [],
        categoria: null,
        selo: null,
        beneficios: [],
        preparo: [],
        preco: 30,
        precoDe: null,
        precoCredito: null,
        disponivel,
    }
}

const combo: ComboLoja = {
    ...produto('par'),
    resumo: null,
    ancora: null,
    fixos: [{ produtoId: 'balde', nome: 'Balde', quantidade: 1, brinde: false }],
    grupos: [],
    montavel: true,
}

const catalogo: Catalogo = {
    produtos: new Map(['balde', 'palito', 'chipa', 'doce'].map((id) => [id, produto(id, id !== 'chipa')])),
    combos: new Map([['par', combo]]),
}

describe('"Leva junto?" pelas vendas', () => {
    it('produtos da sacola: avulsos, itens fixos e sabores dos combos', () => {
        const ids = idsDaSacola(
            [
                { tipo: 'produto', produtoId: 'palito', quantidade: 1 },
                { tipo: 'combo', chave: 'k', comboId: 'par', escolhas: [{ grupoId: 'g', produtoId: 'doce', quantidade: 1 }] },
            ],
            catalogo,
        )
        expect(ids.sort()).toEqual(['balde', 'doce', 'palito'])
    })

    it('soma as indicações dos produtos da sacola; mais indicado primeiro', () => {
        expect(
            somarIndicacoes([
                [
                    { produto_id: 'palito', score: 56 },
                    { produto_id: 'chipa', score: 21 },
                ],
                [
                    { produto_id: 'chipa', score: 48 },
                    { produto_id: 'doce', score: 6 },
                ],
            ]),
        ).toEqual(['chipa', 'palito', 'doce'])
    })

    it('pula o que já está na sacola, o esgotado e o que não é avulso da loja', () => {
        const escolhido = escolherLevaJunto(['balde', 'combo-x', 'chipa', 'palito', 'doce'], catalogo, new Set(['balde']))
        expect(escolhido?.id).toBe('palito')
        expect(escolherLevaJunto(['chipa'], catalogo, new Set())).toBeNull()
    })
})
