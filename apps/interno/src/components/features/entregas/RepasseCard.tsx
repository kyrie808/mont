import { formatCurrency, cn } from '@mont/shared'
import type { ExtratoEntregador } from '../../../services/entregadorService'

interface RepasseCardProps {
    extrato: ExtratoEntregador
}

// Card de repasse de um entregador no período: devido × pago × saldo, mais o dinheiro
// da Mont que ele ainda tem em mãos (a acertar). Compartilhado mobile + hub desktop.
export function RepasseCard({ extrato }: RepasseCardProps) {
    const saldo = Number(extrato.saldo_repasse)
    return (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-bold text-foreground">{extrato.nome}</p>
                    <p className="text-xs text-muted-foreground">
                        {Number(extrato.entregas)} entrega(s) · {formatCurrency(Number(extrato.repasse_por_entrega))}/entrega
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saldo a pagar</p>
                    <p className={cn(
                        'text-xl font-black tabular-nums',
                        saldo > 0 ? 'text-warning-strong' : 'text-success',
                    )}>
                        {formatCurrency(saldo)}
                    </p>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Devido</p>
                    <p className="font-bold text-foreground tabular-nums">{formatCurrency(Number(extrato.devido))}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pago</p>
                    <p className="font-bold text-foreground tabular-nums">{formatCurrency(Number(extrato.pago))}</p>
                </div>
            </div>

            {Number(extrato.dinheiro_coletado) > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                    Dinheiro da Mont em mãos (a acertar): {formatCurrency(Number(extrato.dinheiro_coletado))}
                </p>
            )}
        </div>
    )
}
