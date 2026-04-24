import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DomainVenda } from '@/types/domain'
import { VendasHistory } from './VendasHistory'

const mockUseVendas = vi.fn()

vi.mock('../../../../hooks/useVendas', () => ({
  useVendas: (...args: unknown[]) => mockUseVendas(...args)
}))

function makeVenda(overrides: Partial<DomainVenda> = {}): DomainVenda {
  return {
    id: '309be0f9-2e2b-407f-a760-6d364a92cc49',
    contatoId: 'contato-1',
    data: '2026-04-23',
    total: 65,
    status: 'pendente',
    pago: false,
    formaPagamento: 'pix',
    taxaEntrega: 0,
    itens: [],
    pagamentos: [],
    criadoEm: '2026-04-23T23:30:35.219Z',
    valorPago: 0,
    ...overrides
  }
}

describe('VendasHistory payment badge', () => {
  beforeEach(() => {
    mockUseVendas.mockReset()
  })

  it('renderiza badge Pendente para venda pix com pago=false', () => {
    mockUseVendas.mockReturnValue({
      vendas: [makeVenda({ formaPagamento: 'pix', pago: false })],
      loading: false,
      error: null,
      deleteVenda: vi.fn()
    })

    render(
      <MemoryRouter>
        <VendasHistory contatoId="contato-1" />
      </MemoryRouter>
    )

    expect(screen.getByText(/^Pendente$/)).toBeInTheDocument()
    expect(screen.queryByText(/^Pago$/)).not.toBeInTheDocument()
  })

  it('renderiza badge Brinde para venda brinde', () => {
    mockUseVendas.mockReturnValue({
      vendas: [makeVenda({ formaPagamento: 'brinde', pago: false })],
      loading: false,
      error: null,
      deleteVenda: vi.fn()
    })

    render(
      <MemoryRouter>
        <VendasHistory contatoId="contato-1" />
      </MemoryRouter>
    )

    expect(screen.getByText(/^Brinde$/)).toBeInTheDocument()
  })
})
