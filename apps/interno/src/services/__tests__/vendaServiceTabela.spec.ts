import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Black (30/10/2026): a Nova Venda manda a TABELA de preço e os combos com os sabores; o
 * servidor (`criar_venda` com `p_tabela`) recalcula o preço de tudo e abre o combo em itens.
 * Aqui o que se protege é o payload: a tabela vai sempre (desde 04/11/2026 o servidor recusa venda
 * sem tabela, e fiado/venda sem forma só na normal).
 */

const rpc = vi.fn().mockResolvedValue({ data: 'venda-nova', error: null })

vi.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: (...args: unknown[]) => rpc(...args),
        from: vi.fn(),
    },
}))

const { vendaService } = await import('../vendaService')

function payload(): Record<string, unknown> {
    const [, p] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    return p
}

beforeEach(() => rpc.mockClear())

describe('vendaService.createVenda — tabela e combos', () => {
    it('manda a tabela escolhida', async () => {
        await vendaService.createVenda({
            contatoId: 'c-1', data: '2026-11-03', formaPagamento: 'venda', taxaEntrega: 0, tabela: 'cartao',
            itens: [{ produtoId: 'balde', quantidade: 1, precoUnitario: 68, subtotal: 68 }],
        }, 'idem-1')
        expect(payload().p_tabela).toBe('cartao')
    })

    it('combo vai como combo, com os sabores no formato da RPC', async () => {
        await vendaService.createVenda({
            contatoId: 'c-1', data: '2026-11-03', formaPagamento: 'venda', taxaEntrega: 0, tabela: 'pix',
            itens: [
                { produtoId: 'balde', quantidade: 2, precoUnitario: 65, subtotal: 130 },
                {
                    comboId: 'familia', quantidade: 1,
                    escolhas: [{ grupoId: 'g6', produtoId: 'dl', quantidade: 6 }],
                },
            ],
        }, 'idem-2')
        expect(payload().p_itens).toEqual([
            { produto_id: 'balde', quantidade: 2, preco_unitario: 65, subtotal: 130 },
            { combo_id: 'familia', quantidade: 1, escolhas: [{ grupo_id: 'g6', produto_id: 'dl', quantidade: 6 }] },
        ])
    })

    it('venda sem forma de pagamento vai na tabela normal', async () => {
        await vendaService.createVenda({
            contatoId: 'c-1', data: '2026-10-30', formaPagamento: 'venda', taxaEntrega: 0,
            itens: [{ produtoId: 'balde', quantidade: 1, precoUnitario: 75, subtotal: 75 }],
            tabela: 'normal',
        }, 'idem-3')
        expect(payload().p_tabela).toBe('normal')
    })

    it('editar a venda só manda os campos editáveis (a forma de pagamento não está entre eles)', async () => {
        const { supabase } = await import('../../lib/supabase')
        const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
        vi.mocked(supabase.from).mockReturnValue({ update } as unknown as ReturnType<typeof supabase.from>)
        vi.spyOn(vendaService, 'getVendaById').mockResolvedValue({} as Awaited<ReturnType<typeof vendaService.getVendaById>>)
        await vendaService.updateVenda('v-1', { dataEntregaPrevista: '2026-11-10' })
        expect(update).toHaveBeenCalledWith({ data_entrega_prevista: '2026-11-10' })
    })
})
