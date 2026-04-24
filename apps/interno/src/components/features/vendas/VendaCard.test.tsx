import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DomainVenda } from '@/types/domain'
import { VendaCard } from './VendaCard'

function makeVenda(overrides: Partial<DomainVenda> = {}): DomainVenda {
  return {
    id: '309be0f9-2e2b-407f-a760-6d364a92cc49',
    contatoId: '965cb284-e13d-4234-ab06-ca9435b328fe',
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

describe('VendaCard payment badge', () => {
  it('renderiza badge Pendente para venda pix com pago=false', () => {
    const venda = makeVenda({ formaPagamento: 'pix', pago: false, valorPago: 0 })

    render(
      <MemoryRouter>
        <VendaCard venda={venda} onDeleteClick={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByText(/^Pendente$/)).toBeInTheDocument()
    expect(screen.queryByText(/^Pago$/)).not.toBeInTheDocument()
  })

  it('renderiza badge Brinde para venda brinde', () => {
    const venda = makeVenda({ formaPagamento: 'brinde', pago: false, valorPago: 0 })

    render(
      <MemoryRouter>
        <VendaCard venda={venda} onDeleteClick={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getAllByText(/^Brinde$/).length).toBeGreaterThan(0)
  })
})
