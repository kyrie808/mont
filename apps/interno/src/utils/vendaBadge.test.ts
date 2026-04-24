import { describe, it, expect } from 'vitest'
import { addDays } from 'date-fns'
import { getFiadoStatus } from './fiado'
import { getVendaBadgeStatus, type VendaBadgeInput } from './vendaBadge'

describe('getVendaBadgeStatus', () => {
  const baseVenda: VendaBadgeInput = {
    pago: false,
    formaPagamento: 'fiado',
    valorPago: 0,
    total: 100,
    dataPrevistaPagamento: null
  }

  const hoje = new Date('2024-05-15T12:00:00Z')

  describe('Grupo A — não-fiado e não-brinde', () => {
    it('pix + pago=true retorna pago', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'pix', pago: true })
      expect(status).toEqual({ kind: 'pago' })
    })

    it('pix + pago=false + valorPago=0 retorna pendente', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'pix', pago: false, valorPago: 0 })
      expect(status).toEqual({ kind: 'pendente' })
    })

    it('dinheiro + pago=true retorna pago', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'dinheiro', pago: true })
      expect(status).toEqual({ kind: 'pago' })
    })

    it('dinheiro + pago=false retorna pendente', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'dinheiro', pago: false })
      expect(status).toEqual({ kind: 'pendente' })
    })

    it('cartao + pago=false retorna pendente', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'cartao', pago: false })
      expect(status).toEqual({ kind: 'pendente' })
    })

    it('pre_venda + pago=false retorna pendente', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'pre_venda', pago: false })
      expect(status).toEqual({ kind: 'pendente' })
    })
  })

  describe('Grupo B — brinde', () => {
    it('brinde + pago=false retorna brinde', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'brinde', pago: false })
      expect(status).toEqual({ kind: 'brinde' })
    })

    it('brinde + pago=true retorna brinde', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'brinde', pago: true })
      expect(status).toEqual({ kind: 'brinde' })
    })
  })

  describe('Grupo C — fiado (delegação)', () => {
    it('fiado + pago=true retorna pago', () => {
      const status = getVendaBadgeStatus({ ...baseVenda, formaPagamento: 'fiado', pago: true })
      expect(status).toEqual({ kind: 'pago' })
    })

    it('fiado + data futura próxima retorna status de getFiadoStatus', () => {
      const futuroProximo = addDays(hoje, 1).toISOString()
      const venda = { ...baseVenda, formaPagamento: 'fiado', pago: false, dataPrevistaPagamento: futuroProximo }
      const status = getVendaBadgeStatus(venda, hoje)
      expect(status.kind).toBe('proximo_vencimento')
    })

    it('fiado deve retornar exatamente o mesmo resultado de getFiadoStatus para o mesmo input', () => {
      const venda = {
        ...baseVenda,
        formaPagamento: 'fiado',
        pago: false,
        dataPrevistaPagamento: addDays(hoje, 3).toISOString()
      }

      const badgeStatus = getVendaBadgeStatus(venda, hoje)
      const fiadoStatus = getFiadoStatus(venda, hoje)

      expect(badgeStatus).toEqual(fiadoStatus)
    })
  })
})
