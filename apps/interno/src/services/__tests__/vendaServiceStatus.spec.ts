import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Regressão: a Retirada/Balcão precisa nascer ENTREGUE. Sem `p_status` chegando
 * na RPC, a venda volta ao default 'pendente' e o cliente segue como Lead depois
 * de já ter levado o produto — o defeito relatado em 04/08/2026.
 * O efeito colateral (baixa de estoque) mora nos gatilhos do banco, provados por
 * DO-block; aqui o que se protege é o parâmetro não sumir do payload.
 */

const rpc = vi.fn().mockResolvedValue({ data: 'venda-nova', error: null })

vi.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: (...args: unknown[]) => rpc(...args),
        from: vi.fn(),
    },
}))

const { vendaService } = await import('../vendaService')

const base = {
    contatoId: 'c-1',
    data: '2026-08-04',
    formaPagamento: 'venda' as const,
    taxaEntrega: 0,
    itens: [{ produtoId: 'p-1', quantidade: 1, precoUnitario: 10, subtotal: 10 }],
}

function statusEnviado(): unknown {
    const [, payload] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    return payload.p_status
}

beforeEach(() => rpc.mockClear())

describe('vendaService.createVenda — status inicial', () => {
    it('retirada/balcão nasce entregue', async () => {
        await vendaService.createVenda({ ...base, status: 'entregue' }, 'idem-1')
        expect(statusEnviado()).toBe('entregue')
    })

    it('entrega a fazer nasce pendente', async () => {
        await vendaService.createVenda({ ...base, status: 'pendente' }, 'idem-2')
        expect(statusEnviado()).toBe('pendente')
    })

    it('sem status explícito cai em pendente (nunca entrega um produto sozinho)', async () => {
        await vendaService.createVenda(base, 'idem-3')
        expect(statusEnviado()).toBe('pendente')
    })

    it('chama a RPC atômica, não um insert solto (blindagem de sinal fraco)', async () => {
        await vendaService.createVenda(base, 'idem-4')
        expect(rpc.mock.calls[0][0]).toBe('criar_venda')
    })
})
