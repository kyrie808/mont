import { differenceInCalendarDays, startOfDay } from 'date-fns'

export const DIAS_PROXIMO_VENCIMENTO = 3

export type FiadoStatus =
  | { kind: 'pago' }
  | { kind: 'sem_data' }
  | { kind: 'vencido'; diasAtraso: number; venceEm: Date }
  | { kind: 'vence_hoje'; venceEm: Date }
  | { kind: 'proximo_vencimento'; dias: number; venceEm: Date }
  | { kind: 'a_receber_futuro'; venceEm: Date }

export interface VendaFiadoInput {
  pago: boolean
  formaPagamento: string
  dataPrevistaPagamento?: string | null
  valorPago: number
  total: number
}

// Nota sobre timezone: 
// O projeto utiliza a timezone padrão (America/Sao_Paulo) do sistema onde a aplicação/browser rodam.
// Utilizamos startOfDay() puro do date-fns, que normalizará ambas as datas para 00:00:00 da 
// timezone atual e eliminará as inconsistências de horário na hora do cálculo dos dias no differenceInCalendarDays.
export function getFiadoStatus(venda: VendaFiadoInput, hoje: Date = new Date()): FiadoStatus {
  // 1. Se pago -> pago
  if (venda.pago || venda.valorPago >= venda.total) {
    return { kind: 'pago' }
  }

  // 2. Se forma_pagamento !== fiado -> pago
  if (venda.formaPagamento !== 'fiado') {
    return { kind: 'pago' }
  }

  // 3. Se fiado sem data -> sem_data
  if (!venda.dataPrevistaPagamento) {
    return { kind: 'sem_data' }
  }

  // 4. Se fiado com data -> aplicar thresholds
  const h0 = startOfDay(hoje)
  const rawVendaDate = new Date(venda.dataPrevistaPagamento)
  const v0 = startOfDay(rawVendaDate)
  
  // differenceInCalendarDays do date-fns lida bem com instâncias de Date considerando dias de calendário
  const diferencaDias = differenceInCalendarDays(v0, h0)

  if (diferencaDias < 0) {
    return { kind: 'vencido', diasAtraso: Math.abs(diferencaDias), venceEm: v0 }
  }

  if (diferencaDias === 0) {
    return { kind: 'vence_hoje', venceEm: v0 }
  }

  if (diferencaDias >= 1 && diferencaDias <= DIAS_PROXIMO_VENCIMENTO) {
    return { kind: 'proximo_vencimento', dias: diferencaDias, venceEm: v0 }
  }

  return { kind: 'a_receber_futuro', venceEm: v0 }
}
