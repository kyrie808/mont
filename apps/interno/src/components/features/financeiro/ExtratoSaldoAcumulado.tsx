import { BarChart3 } from 'lucide-react'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import type { ExtratoDeSaldoRow } from '@/services/cashFlowService'

interface ExtratoSaldoAcumuladoProps {
    extratoDeSaldo: ExtratoDeSaldoRow[]
    loadingExtratoDeSaldo: boolean
    totalSaldoContas: number
}

export function ExtratoSaldoAcumulado({
    extratoDeSaldo,
    loadingExtratoDeSaldo,
    totalSaldoContas
}: ExtratoSaldoAcumuladoProps) {
    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Extrato de Saldo
                </h2>
            </div>

            <div className="bg-card rounded-[2rem] border border-border shadow-elevated overflow-hidden">
                {loadingExtratoDeSaldo ? (
                    <div className="p-12 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-foreground border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-muted-foreground uppercase">Calculando saldos...</p>
                    </div>
                ) : extratoDeSaldo.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-sm font-bold text-muted-foreground uppercase">Nenhum dado disponível</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left px-5 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-wider">Mês</th>
                                    <th className="text-right px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-wider">Entradas</th>
                                    <th className="text-right px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-wider">Saídas</th>
                                    <th className="text-right px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-wider">Saldo Mês</th>
                                    <th className="text-right px-5 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-wider">Acumulado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {extratoDeSaldo.map((row) => {
                                    const saldoMes = Number(row.saldo_mes) || 0
                                    const saldoAcum = Number(row.saldo_acumulado) || 0
                                    return (
                                        <tr key={row.mes_ordem} className="hover:bg-muted/60 transition-colors">
                                            <td className="px-5 py-4 text-sm font-black text-foreground">{row.mes}</td>
                                            <td className="px-4 py-4 text-sm font-bold text-success text-right whitespace-nowrap">
                                                {formatCurrency(Number(row.entradas) || 0)}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-bold text-destructive text-right whitespace-nowrap">
                                                {formatCurrency(Number(row.saidas) || 0)}
                                            </td>
                                            <td className={cn(
                                                "px-4 py-4 text-sm font-bold text-right whitespace-nowrap",
                                                saldoMes >= 0 ? "text-success" : "text-destructive"
                                            )}>
                                                {saldoMes >= 0 ? '+' : ''}{formatCurrency(saldoMes)}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-black text-foreground text-right whitespace-nowrap">
                                                {formatCurrency(saldoAcum)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Reconciliation Card */}
            {!loadingExtratoDeSaldo && extratoDeSaldo.length > 0 && (() => {
                const saldoAcumulado = Number(extratoDeSaldo[0]?.saldo_acumulado) || 0
                const diferenca = saldoAcumulado - totalSaldoContas
                const reconciliado = Math.abs(diferenca) < 0.01
                return (
                    <div className={cn(
                        "p-5 rounded-[1.5rem] border flex flex-col sm:flex-row sm:items-center gap-3",
                        reconciliado
                            ? "bg-success/10 border-success/30"
                            : "bg-destructive/10 border-destructive/30"
                    )}>
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div>
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Saldo Acumulado</p>
                                <p className="text-sm font-black text-foreground">{formatCurrency(saldoAcumulado)}</p>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-border" />
                            <div>
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Saldo em Contas</p>
                                <p className="text-sm font-black text-foreground">{formatCurrency(totalSaldoContas)}</p>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-border" />
                            <div>
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Diferença</p>
                                <p className={cn(
                                    "text-sm font-black",
                                    reconciliado ? "text-success" : "text-destructive"
                                )}>
                                    {formatCurrency(Math.abs(diferenca))} {reconciliado ? '✅' : '⚠️'}
                                </p>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </section>
    )
}
