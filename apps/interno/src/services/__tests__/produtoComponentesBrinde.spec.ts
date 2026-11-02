import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Regressão (02/11/2026): editar a composição de um combo na tela de Produtos regravava os itens
 * (replace_combo_componentes) sem a marca `brinde`, e o Café da Tarde perdia o "de brinde" do
 * doce de leite 400 g na loja. O banco agora preserva a marca quando a chave falta
 * (supabase/tests/combo_componentes_brinde.sql); aqui a tela passa a LER e ENVIAR a marca.
 *
 * Camada unit (jsdom, sem banco): mockamos o supabase client e conferimos leitura e payload.
 */

const rpcSpy = vi.fn()
const selectSpy = vi.fn()

vi.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: (nome: string, args: unknown) => {
            rpcSpy(nome, args)
            return Promise.resolve({ error: null })
        },
        from: () => ({
            select: (colunas: string) => {
                selectSpy(colunas)
                return {
                    eq: () => ({
                        order: () =>
                            Promise.resolve({
                                data: [
                                    { id: 'l1', combo_id: 'c1', componente_id: 'baldinho', quantidade: 2, brinde: false },
                                    { id: 'l2', combo_id: 'c1', componente_id: 'doce400', quantidade: 1, brinde: true },
                                ],
                                error: null,
                            }),
                    }),
                }
            },
        }),
    },
}))

vi.mock('../../lib/agoraSimulado', () => ({ agoraSimulado: null }))

import { produtoService } from '../produtoService'

describe('produtoService — marca de brinde nos itens fixos do combo', () => {
    beforeEach(() => {
        rpcSpy.mockClear()
        selectSpy.mockClear()
    })

    it('getComponentes lê a coluna brinde', async () => {
        const comps = await produtoService.getComponentes('c1')

        expect(selectSpy.mock.calls[0][0]).toContain('brinde')
        expect(comps.map((c) => [c.componenteId, c.brinde])).toEqual([
            ['baldinho', false],
            ['doce400', true],
        ])
    })

    it('replaceComponentes manda a marca de cada item para o banco', async () => {
        await produtoService.replaceComponentes('c1', [
            { componenteId: 'baldinho', quantidade: 2, brinde: false },
            { componenteId: 'doce400', quantidade: 1, brinde: true },
        ])

        expect(rpcSpy).toHaveBeenCalledWith('replace_combo_componentes', {
            p_combo_id: 'c1',
            p_itens: [
                { componenteId: 'baldinho', quantidade: 2, brinde: false },
                { componenteId: 'doce400', quantidade: 1, brinde: true },
            ],
        })
    })
})
