import { getFiadoStatus, type FiadoStatus, type VendaFiadoInput } from './fiado'

export type VendaBadgeStatus =
  | { kind: 'pago' }
  | { kind: 'pendente' }
  | { kind: 'brinde' }
  | Exclude<FiadoStatus, { kind: 'pago' }>

export type VendaBadgeInput = VendaFiadoInput

export function getVendaBadgeStatus(
  venda: VendaBadgeInput,
  hoje: Date = new Date()
): VendaBadgeStatus {
  if (venda.formaPagamento === 'brinde') {
    return { kind: 'brinde' }
  }

  if (venda.formaPagamento === 'fiado') {
    return getFiadoStatus(venda, hoje)
  }

  return venda.pago ? { kind: 'pago' } : { kind: 'pendente' }
}
