import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CheckoutSidebar } from '../NovaVenda/CheckoutSidebar'

vi.mock('../../../../hooks/useEntregadores', () => ({
    useEntregadores: () => ({ entregadores: [] }),
}))

const defaultProps = {
    onBack: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    total: 95,
    contatoId: '0223a3d9-e59c-4498-a47f-fded3f3fb700',
    contatoNome: 'Vilma Margarete',
    items: [
        {
            produto_id: '487fef98-5d10-42e4-a628-2f7d176ce87e',
            quantidade: 1,
            preco_unitario: 95,
            subtotal: 95,
        },
    ],
}

/** Dispara o submit e devolve o 3º argumento (`OpcoesEntrega`) de `onConfirm`. */
async function confirmarEPegarOpcoes(onConfirm: ReturnType<typeof vi.fn>) {
    fireEvent.click(screen.getByRole('button', { name: /confirmar venda/i }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    return onConfirm.mock.calls[0][2]
}

/*
 * Regressão do pedido do Gilmar (08/08/2026): "quando a gente registra a venda já
 * aparece direto como o produto já foi entregue... antes eu tinha que colocar manual".
 *
 * O commit 9e5cd03 fez Retirada nascer entregue, o que é certo no balcão mas errado
 * na rota da UPA — ele vende para vários e só depois separa no carro. O tipo
 * "Entrego depois" devolve o controle sem desfazer o balcão.
 *
 * `entregaImediata` é o bit que `NovaVenda.tsx` traduz em status: true → 'entregue',
 * false → 'pendente'. É por isso que o teste olha para ele.
 */
describe('CheckoutSidebar — tipo de entrega define o status inicial', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('Retirada (padrão) nasce ENTREGUE — o cliente levou na hora', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)

        expect(await confirmarEPegarOpcoes(onConfirm)).toEqual({ entregaImediata: true })
    })

    it('REGRESSÃO: "Entrego depois" nasce PENDENTE — produto ainda está no carro', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)

        fireEvent.click(screen.getByRole('button', { name: /entrego depois/i }))

        expect(await confirmarEPegarOpcoes(onConfirm)).toEqual({ entregaImediata: false })
    })

    it('"Entrego depois" não abre frete nem entregador — é ele mesmo quem leva', () => {
        render(<CheckoutSidebar {...defaultProps} />)

        fireEvent.click(screen.getByRole('button', { name: /entrego depois/i }))

        expect(screen.queryByText(/frete/i)).not.toBeInTheDocument()
    })

    it('Entrega nasce PENDENTE e abre os campos de frete', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)

        fireEvent.click(screen.getByRole('button', { name: /^entrega$/i }))
        expect(screen.getByText(/frete/i)).toBeInTheDocument()

        expect(await confirmarEPegarOpcoes(onConfirm)).toEqual({ entregaImediata: false })
    })
})
