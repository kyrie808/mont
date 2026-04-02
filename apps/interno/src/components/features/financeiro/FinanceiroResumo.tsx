import { Wallet, TrendingUp, Clock, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MonthPicker } from '../../dashboard/MonthPicker'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import type { FluxoResumo } from '@/types/database'

interface FinanceiroResumoProps {
    selectedMonth: Date
    selectedMonthStr: string
    onMonthSelect: (monthName: string) => void
    resumo: FluxoResumo | null
    totalSaldoContas: number
    loadingResumo: boolean
    loadingContas: boolean
}

export function FinanceiroResumo({
    selectedMonth,
    selectedMonthStr,
    onMonthSelect,
    resumo,
    totalSaldoContas,
    loadingResumo,
    loadingContas
}: FinanceiroResumoProps) {
    return (
        <div className="flex flex-col gap-4">
            <MonthPicker
                selectedMonth={selectedMonthStr}
                onMonthSelect={onMonthSelect}
            />

            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-white dark:to-zinc-200 rounded-3xl p-6 shadow-xl text-white dark:text-zinc-950">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Saldo em Contas</p>
                        <h2 className="text-3xl font-black mt-1">
                            {loadingContas ? '...' : formatCurrency(totalSaldoContas)}
                        </h2>
                    </div>
                    <div className="p-3 bg-white/10 dark:bg-black/5 rounded-2xl">
                        <Wallet className="w-6 h-6" />
                    </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-white/10 dark:border-black/5">
                    <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-wider opacity-60">Entradas ({format(selectedMonth, 'MMM', { locale: ptBR })})</p>
                        <p className="text-sm font-bold text-emerald-400 dark:text-emerald-600">
                            + {formatCurrency(resumo?.total_entradas || 0)}
                        </p>
                    </div>
                    <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-wider opacity-60">Saídas ({format(selectedMonth, 'MMM', { locale: ptBR })})</p>
                        <p className="text-sm font-bold text-red-400 dark:text-red-600">
                            - {formatCurrency(resumo?.total_saidas || 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick KPIs Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {[
                    { label: 'Saldo do Mês', value: (resumo?.total_entradas || 0) - (resumo?.total_saidas || 0), icon: TrendingUp, color: 'emerald' },
                    { label: 'A Receber', value: resumo?.total_a_receber || 0, icon: Clock, color: 'orange' },
                    {
                        label: 'Inadimplência',
                        value: (resumo?.total_faturamento || 0) > 0
                            ? Math.min(((resumo?.total_a_receber || 0) / (resumo?.total_faturamento || 1)) * 100, 100)
                            : 0,
                        isPercent: true,
                        icon: Filter,
                        color: 'red'
                    },
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-3", 
                            kpi.color === 'emerald' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" :
                            kpi.color === 'orange' ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" :
                            "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        )}>
                            <kpi.icon size={20} />
                        </div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">{kpi.label}</p>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                            {loadingResumo ? '...' : kpi.isPercent ? `${kpi.value.toFixed(1)}%` : formatCurrency(kpi.value)}
                        </h3>
                    </div>
                ))}
            </div>
        </div>
    )
}
