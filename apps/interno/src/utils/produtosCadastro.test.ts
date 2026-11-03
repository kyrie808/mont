import { describe, it, expect } from 'vitest'
import { produtosDoCadastro } from './produtosCadastro'

const produtos = [
    { id: 'a', ativo: true },
    { id: 'kit-maezona', ativo: false },
    { id: 'b', ativo: true },
]

describe('produtosDoCadastro (aba Produtos)', () => {
    it('por padrão esconde os desativados', () => {
        expect(produtosDoCadastro(produtos, false).map((p) => p.id)).toEqual(['a', 'b'])
    })

    it('"Mostrar desativados" traz todos, na mesma ordem', () => {
        expect(produtosDoCadastro(produtos, true).map((p) => p.id)).toEqual(['a', 'kit-maezona', 'b'])
    })
})
