import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Parte G (04/11/2026): o item "Pedidos da loja" do menu mostra quantos pedidos esperam
 * confirmação. Unit (jsdom, sem banco): o serviço é mockado.
 */

const contarPendentes = vi.fn<() => Promise<number>>()

vi.mock('@/services/pedidosLojaService', () => ({
    pedidosLojaService: { contarPendentes: () => contarPendentes() },
}))

import { ContadorNav } from './ContadorNav'

function renderizar() {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={cliente}>
            <ContadorNav tipo="pedidos-loja" />
        </QueryClientProvider>,
    )
}

describe('ContadorNav', () => {
    beforeEach(() => contarPendentes.mockReset())

    it('mostra quantos pedidos da loja aguardam confirmação', async () => {
        contarPendentes.mockResolvedValue(3)
        renderizar()
        const contador = await screen.findByLabelText('3 pedidos aguardando confirmação')
        expect(contador.textContent).toBe('3')
    })

    it('um pedido: singular', async () => {
        contarPendentes.mockResolvedValue(1)
        renderizar()
        expect(await screen.findByLabelText('1 pedido aguardando confirmação')).toBeTruthy()
    })

    it('zero não aparece', async () => {
        contarPendentes.mockResolvedValue(0)
        const { container } = renderizar()
        await vi.waitFor(() => expect(contarPendentes).toHaveBeenCalled())
        expect(container.textContent).toBe('')
    })
})
