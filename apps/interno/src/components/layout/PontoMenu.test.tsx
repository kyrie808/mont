import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Ponto laranja no ☰ (celular) quando há pedido da loja esperando — mesmo critério do contador.
 * Unit (jsdom, sem banco): o serviço é mockado.
 */

const contarPendentes = vi.fn<() => Promise<number>>()

vi.mock('@/services/pedidosLojaService', () => ({
    pedidosLojaService: { contarPendentes: () => contarPendentes() },
}))

import { Header } from './Header'

function renderizar(props: { showMenu?: boolean; showBack?: boolean } = { showMenu: true }) {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={cliente}>
            <MemoryRouter>
                <Header title="Vendas" onMenuClick={() => {}} {...props} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('ponto no ícone do menu', () => {
    beforeEach(() => contarPendentes.mockReset())

    it('com pedido da loja esperando, o ☰ ganha o ponto e diz quantos', async () => {
        contarPendentes.mockResolvedValue(2)
        renderizar()
        const botao = screen.getByRole('button', { name: /Abrir menu/ })
        expect(await screen.findByText('2 pedidos da loja aguardando confirmação')).toBeTruthy()
        expect(botao.querySelector('.bg-warning-strong')).not.toBeNull()
    })

    it('sem pedido esperando, sem ponto', async () => {
        contarPendentes.mockResolvedValue(0)
        renderizar()
        await vi.waitFor(() => expect(contarPendentes).toHaveBeenCalled())
        expect(screen.getByRole('button', { name: /Abrir menu/ }).querySelector('.bg-warning-strong')).toBeNull()
    })

    it('tela com "Voltar" (sem ☰) nem consulta', () => {
        renderizar({ showMenu: true, showBack: true })
        expect(contarPendentes).not.toHaveBeenCalled()
    })
})
