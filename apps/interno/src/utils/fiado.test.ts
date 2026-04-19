import { describe, it, expect } from 'vitest'
import { addDays, subDays, startOfDay } from 'date-fns'
import { getFiadoStatus, VendaFiadoInput, DIAS_PROXIMO_VENCIMENTO } from './fiado'

describe('getFiadoStatus', () => {
  const baseVenda: VendaFiadoInput = {
    pago: false,
    formaPagamento: 'fiado',
    valorPago: 0,
    total: 100,
    dataPrevistaPagamento: null
  }

  const hoje = new Date('2024-05-15T12:00:00Z') // Data base para os testes

  it('1. retorna "pago" se a flag pago for true, ignorando data', () => {
    const status = getFiadoStatus({ ...baseVenda, pago: true, dataPrevistaPagamento: '2020-01-01' })
    expect(status.kind).toBe('pago')
  })

  it('2. retorna "pago" se valorPago >= total, mesmo se pago for false', () => {
    const status = getFiadoStatus({ ...baseVenda, valorPago: 100, total: 100 })
    expect(status.kind).toBe('pago')
  })

  it('3. retorna "pago" se formaPagamento não for fiado nem brinde', () => {
    const status = getFiadoStatus({ ...baseVenda, formaPagamento: 'pix' })
    expect(status.kind).toBe('pago')
  })

  it('4. retorna "pago" se formaPagamento for brinde e não estiver pago', () => {
    const status = getFiadoStatus({ ...baseVenda, formaPagamento: 'brinde' })
    expect(status.kind).toBe('pago')
  })

  it('5. retorna "pago" se formaPagamento for brinde mas valorPago >= total', () => {
    const status = getFiadoStatus({ ...baseVenda, formaPagamento: 'brinde', valorPago: 0, total: 0 })
    expect(status.kind).toBe('pago')
  })

  it('6. retorna "sem_data" se for fiado mas não tiver dataPrevistaPagamento', () => {
    const status = getFiadoStatus(baseVenda)
    expect(status.kind).toBe('sem_data')
  })

  it('7. retorna "vencido" com dias de atraso se a data for no passado', () => {
    const ontem = subDays(hoje, 2).toISOString()
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento: ontem }, hoje)
    
    expect(status.kind).toBe('vencido')
    if (status.kind === 'vencido') {
      expect(status.diasAtraso).toBe(2)
      expect(status.venceEm).toEqual(startOfDay(new Date(ontem)))
    }
  })

  it('8. retorna "vence_hoje" se a data for o dia atual', () => {
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento: hoje.toISOString() }, hoje)
    
    expect(status.kind).toBe('vence_hoje')
    if (status.kind === 'vence_hoje') {
      expect(status.venceEm).toEqual(startOfDay(new Date(hoje.toISOString())))
    }
  })

  it('9. retorna "proximo_vencimento" se a data for 1 dia no futuro', () => {
    const amanha = addDays(hoje, 1).toISOString()
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento: amanha }, hoje)
    
    expect(status.kind).toBe('proximo_vencimento')
    if (status.kind === 'proximo_vencimento') {
      expect(status.dias).toBe(1)
      expect(status.venceEm).toEqual(startOfDay(new Date(amanha)))
    }
  })

  it(`10. retorna "proximo_vencimento" no limite de ${DIAS_PROXIMO_VENCIMENTO} dias`, () => {
    const limite = addDays(hoje, DIAS_PROXIMO_VENCIMENTO).toISOString()
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento: limite }, hoje)
    
    expect(status.kind).toBe('proximo_vencimento')
    if (status.kind === 'proximo_vencimento') {
      expect(status.dias).toBe(DIAS_PROXIMO_VENCIMENTO)
    }
  })

  it(`11. retorna "a_receber_futuro" se a data for mais de ${DIAS_PROXIMO_VENCIMENTO} dias no futuro`, () => {
    const futuro = addDays(hoje, DIAS_PROXIMO_VENCIMENTO + 1).toISOString()
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento: futuro }, hoje)
    
    expect(status.kind).toBe('a_receber_futuro')
  })

  it('12. garante precisão de dias ignorando horas (hoje fim do dia vs vencimento começo do dia)', () => {
    // Usando offset fixo para garantir mesmo dia do calendário local
    const hojeFimDia = new Date('2024-05-15T23:59:59-03:00')
    const vencimentoComecoDia = new Date('2024-05-15T00:00:00-03:00').toISOString()
    
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento: vencimentoComecoDia }, hojeFimDia)
    expect(status.kind).toBe('vence_hoje')
  })

  it('13. garante precisão de dias ignorando horas (hoje começo do dia vs vencimento fim do dia)', () => {
    const hojeComecoDia = new Date('2024-05-15T00:00:00-03:00')
    const vencimentoFimDia = new Date('2024-05-15T23:59:59-03:00').toISOString()
    
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento: vencimentoFimDia }, hojeComecoDia)
    expect(status.kind).toBe('vence_hoje')
  })

  it('14. timezone fixa: SP 23:30 não deve considerar dia seguinte como hoje', () => {
    const hojeTimezone = new Date('2026-04-18T23:30:00-03:00')
    const dataPrevistaPagamento = '2026-04-18T10:00:00Z'
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento }, hojeTimezone)
    expect(status.kind).toBe('vence_hoje')
  })

  it('15. timezone fixa: SP 22:00 de hoje nao deve bater na data de amanhã', () => {
    const hojeTimezone = new Date('2026-04-18T22:00:00-03:00')
    const dataPrevistaPagamento = '2026-04-19T10:00:00Z'
    const status = getFiadoStatus({ ...baseVenda, dataPrevistaPagamento }, hojeTimezone)
    expect(status.kind).toBe('proximo_vencimento')
    if (status.kind === 'proximo_vencimento') {
      expect(status.dias).toBe(1)
    }
  })
})
