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
                <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Extrato de Saldo
                </h2>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
                {loadingExtratoDeSaldo ? (
                    <div className="p-12 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-zinc-500 uppercase">Calculando saldos...</p>
                    </div>
                ) : extratoDeSaldo.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-sm font-bold text-zinc-400 uppercase">Nenhum dado disponível</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                    <th className="text-left px-5 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-wider">Mês</th>
                                    <th className="text-right px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-wider">Entradas</th>
                                    <th className="text-right px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-wider">Saídas</th>
                                    <th className="text-right px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-wider">Saldo Mês</th>
                                    <th className="text-right px-5 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-wider">Acumulado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                {extratoDeSaldo.map((row) => {
                                    const saldoMes = Number(row.saldo_mes) || 0
                                    const saldoAcum = Number(row.saldo_acumulado) || 0
                                    return (
                                        <tr key={row.mes_ordem} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-5 py-4 text-sm font-black text-zinc-900 dark:text-white">{row.mes}</td>
                                            <td className="px-4 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right whitespace-nowrap">
                                                {formatCurrency(Number(row.entradas) || 0)}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-bold text-red-600 dark:text-red-400 text-right whitespace-nowrap">
                                                {formatCurrency(Number(row.saidas) || 0)}
                                            </td>
                                            <td className={cn(
                                                "px-4 py-4 text-sm font-bold text-right whitespace-nowrap",
                                                saldoMes >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                            )}>
                                                {saldoMes >= 0 ? '+' : ''}{formatCurrency(saldoMes)}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-black text-zinc-900 dark:text-white text-right whitespace-nowrap">
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
                            ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30"
                            : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30"
                    )}>
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div>
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider mb-0.5">Saldo Acumulado</p>
                                <p className="text-sm font-black text-zinc-900 dark:text-white">{formatCurrency(saldoAcumulado)}</p>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
                            <div>
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider mb-0.5">Saldo em Contas</p>
                                <p className="text-sm font-black text-zinc-900 dark:text-white">{formatCurrency(totalSaldoContas)}</p>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
                            <div>
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider mb-0.5">Diferença</p>
                                <p className={cn(
                                    "text-sm font-black",
                                    reconciliado ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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
