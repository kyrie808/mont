import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Parte B da paridade (04/11/2026): "Esgotado" e "Nome na loja" moram no cadastro do produto
 * (produtos.esgotado / produtos.nome_loja). O toque em "Esgotado" na lista grava só essa coluna.
 *
 * Camada unit (jsdom, sem banco): mockamos o supabase client e conferimos payload e leitura.
 */

const updateSpy = vi.fn()
const selectSpy = vi.fn()

const linha = {
    id: 'p1',
    nome: 'Massa Pão de Queijo 4kg',
    codigo: 'balde_pao_queijo_4kg',
    preco: 75,
    custo: 40,
    esgotado: true,
    nome_loja: 'Balde de massa 4 kg',
}

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: () => ({
            update: (payload: unknown) => {
                updateSpy(payload)
                return {
                    eq: () => ({
                        select: (colunas: string) => {
                            selectSpy(colunas)
                            return { single: () => Promise.resolve({ data: linha, error: null }) }
                        },
                    }),
                }
            },
        }),
    },
}))

vi.mock('../../lib/agoraSimulado', () => ({ agoraSimulado: null }))

import { produtoService } from '../produtoService'

describe('produtoService — esgotado e nome na loja', () => {
    beforeEach(() => {
        updateSpy.mockClear()
        selectSpy.mockClear()
    })

    it('o toque em "Esgotado" grava só a coluna esgotado', async () => {
        const produto = await produtoService.update('p1', { esgotado: true })

        expect(updateSpy).toHaveBeenCalledWith({ esgotado: true })
        expect(selectSpy.mock.calls[0][0]).toContain('esgotado, nome_loja')
        expect([produto.esgotado, produto.nomeLoja]).toEqual([true, 'Balde de massa 4 kg'])
    })

    it('"Nome na loja" sai sem espaço nas pontas; vazio volta a usar o nome do cadastro', async () => {
        await produtoService.update('p1', { nomeLoja: '  Balde de massa 4 kg ' })
        await produtoService.update('p1', { nomeLoja: '   ' })

        expect(updateSpy.mock.calls.map((c) => c[0])).toEqual([{ nome_loja: 'Balde de massa 4 kg' }, { nome_loja: null }])
    })
})
