import { Wallet, TrendingUp, Clock, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MonthPicker } from '../../dashboard/MonthPicker'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import type { FluxoResumo } from '@mont/shared'

interface FinanceiroResumoProps {
    selectedMonth: Date
    selectedMonthStr: string
    onMonthSelect: (monthName: string) => void
    resumo: FluxoResumo | null
    totalSaldoContas: number
    loadingResumo: boolean
    loadingContas: boolean
    /** Desktop já tem o MonthPicker na top bar → permite ocultá-lo aqui. Default true (mobile intocado). */
    showMonthPicker?: boolean
}

export function FinanceiroResumo({
    selectedMonth,
    selectedMonthStr,
    onMonthSelect,
    resumo,
    totalSaldoContas,
    loadingResumo,
    loadingContas,
    showMonthPicker = true
}: FinanceiroResumoProps) {
    return (
        <div className="flex flex-col gap-4">
            {showMonthPicker && (
                <MonthPicker
                    selectedMonth={selectedMonthStr}
                    onMonthSelect={onMonthSelect}
                />
            )}

            {/* Hero "Saldo em Contas" — card invertido via tokens (foreground/background) */}
            <div className="bg-linear-to-br from-foreground to-foreground/90 text-background rounded-3xl p-6 shadow-elevated">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Saldo em Contas</p>
                        <h2 className="text-3xl font-black mt-1">
                            {loadingContas ? '...' : formatCurrency(totalSaldoContas)}
                        </h2>
                    </div>
                    <div className="p-3 bg-background/10 rounded-2xl">
                        <Wallet className="w-6 h-6" />
                    </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-background/10">
                    <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-wider opacity-60">Entradas ({format(selectedMonth, 'MMM', { locale: ptBR })})</p>
                        <p className="text-sm font-bold text-success">
                            + {formatCurrency(resumo?.total_entradas || 0)}
                        </p>
                    </div>
                    <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-wider opacity-60">Saídas ({format(selectedMonth, 'MMM', { locale: ptBR })})</p>
                        <p className="text-sm font-bold text-destructive">
                            - {formatCurrency(resumo?.total_saidas || 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick KPIs Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {[
                    { label: 'Saldo do Mês', value: (resumo?.total_entradas || 0) - (resumo?.total_saidas || 0), icon: TrendingUp, tone: 'success' as const },
                    { label: 'A Receber', value: resumo?.total_a_receber || 0, icon: Clock, tone: 'warning' as const },
                    {
                        label: 'Inadimplência',
                        value: (resumo?.total_faturamento || 0) > 0
                            ? Math.min(((resumo?.total_a_receber || 0) / (resumo?.total_faturamento || 1)) * 100, 100)
                            : 0,
                        isPercent: true,
                        icon: Filter,
                        tone: 'destructive' as const,
                    },
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-card p-4 rounded-3xl border border-border shadow-card">
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-3",
                            kpi.tone === 'success' ? "bg-success/15 text-success" :
                            kpi.tone === 'warning' ? "bg-warning/15 text-warning-strong" :
                            "bg-destructive/15 text-destructive"
                        )}>
                            <kpi.icon size={20} />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                        <h3 className="text-lg font-black text-foreground mt-1">
                            {loadingResumo ? '...' : kpi.isPercent ? `${kpi.value.toFixed(1)}%` : formatCurrency(kpi.value)}
                        </h3>
                    </div>
                ))}
            </div>
        </div>
    )
}
