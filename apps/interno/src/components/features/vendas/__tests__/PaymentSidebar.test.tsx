import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { Conta } from '@mont/shared'
import { cashFlowService } from '../../../../services/cashFlowService'
import { PaymentSidebar } from '../PaymentSidebar'

vi.mock('../../../../services/cashFlowService', () => ({
    cashFlowService: {
        getContas: vi.fn(),
    },
}))

const mockGetContas = vi.mocked(cashFlowService.getContas)

const mockConta: Conta = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    nome: 'Conta Principal',
    tipo: 'corrente',
    ativo: true,
    banco: null,
    codigo: null,
    created_by: null,
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: '2026-01-01T00:00:00Z',
    saldo_atual: 1000,
    saldo_inicial: 0,
    updated_by: null,
}

const defaultProps = {
    onBack: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(true),
    vendaId: '309be0f9-2e2b-407f-a760-6d364a92cc49',
    total: 65,
    valorPago: 0,
    historico: [],
}

describe('PaymentSidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('1. exibe "Carregando contas..." e botão desabilitado enquanto getContas está pendente', () => {
        mockGetContas.mockImplementation(() => new Promise(() => {}))

        render(<PaymentSidebar {...defaultProps} />)

        expect(screen.getByText('Carregando contas...')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /confirmar pagamento/i })).toBeDisabled()
    })

    it('2. exibe Select e habilita botão após getContas retornar conta', async () => {
        mockGetContas.mockResolvedValue([mockConta])

        render(<PaymentSidebar {...defaultProps} />)

        await waitFor(() => {
            expect(screen.queryByText('Carregando contas...')).not.toBeInTheDocument()
        })

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /confirmar pagamento/i })).not.toBeDisabled()
        })
    })

    it('3. exibe mensagem de erro e botão desabilitado quando getContas rejeita', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        mockGetContas.mockRejectedValue(new Error('Network error'))

        render(<PaymentSidebar {...defaultProps} />)

        await waitFor(() => {
            expect(
                screen.getByText('Não foi possível carregar as contas. Recarregue a página.')
            ).toBeInTheDocument()
        })

        expect(screen.getByRole('button', { name: /confirmar pagamento/i })).toBeDisabled()
        expect(consoleSpy).toHaveBeenCalledWith(
            '[PaymentSidebar] fetchContas failed:',
            expect.any(Error)
        )

        consoleSpy.mockRestore()
    })

    it('4. exibe "Nenhuma conta cadastrada" e botão desabilitado quando getContas retorna []', async () => {
        mockGetContas.mockResolvedValue([])

        render(<PaymentSidebar {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText(/nenhuma conta cadastrada/i)).toBeInTheDocument()
        })

        expect(screen.getByRole('button', { name: /confirmar pagamento/i })).toBeDisabled()
    })

    it('5. sem race condition: conta_id populado e botão habilitado após delay em getContas', async () => {
        mockGetContas.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve([mockConta]), 50))
        )

        render(<PaymentSidebar {...defaultProps} />)

        // Durante o carregamento: botão deve estar desabilitado
        expect(screen.getByRole('button', { name: /confirmar pagamento/i })).toBeDisabled()

        // Após o carregamento: botão deve estar habilitado
        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /confirmar pagamento/i })
            ).not.toBeDisabled()
        })

        expect(screen.queryByText('Carregando contas...')).not.toBeInTheDocument()
        expect(screen.queryByText(/nenhuma conta cadastrada/i)).not.toBeInTheDocument()
    })
})
