import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Receipt } from 'lucide-react'
import { MonthPicker } from '../../dashboard/MonthPicker'
import { Button } from '../../ui'
import { FinanceiroResumo } from './FinanceiroResumo'
import { ExtratoDataGrid } from './ExtratoDataGrid'
import { ExtratoSaldoAcumulado } from './ExtratoSaldoAcumulado'
import type { FluxoResumo, ExtratoItem } from '@mont/shared'
import type { ExtratoDeSaldoRow } from '@/services/cashFlowService'

interface FinanceiroDashboardDesktopProps {
    resumo: FluxoResumo | null
    extrato: ExtratoItem[]
    extratoDeSaldo: ExtratoDeSaldoRow[]
    totalSaldoContas: number
    selectedMonth: Date
    selectedMonthStr: string
    onMonthSelect: (monthName: string) => void
    loadingResumo: boolean
    loadingContas: boolean
    loadingExtrato: boolean
    loadingExtratoDeSaldo: boolean
    onEntrada: () => void
    onSaida: () => void
    onTransferencia: () => void
}

export function FinanceiroDashboardDesktop({
    resumo,
    extrato,
    extratoDeSaldo,
    totalSaldoContas,
    selectedMonth,
    selectedMonthStr,
    onMonthSelect,
    loadingResumo,
    loadingContas,
    loadingExtrato,
    loadingExtratoDeSaldo,
    onEntrada,
    onSaida,
    onTransferencia,
}: FinanceiroDashboardDesktopProps) {
    return (
        <div className="px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Top bar: MonthPicker + ações inline (FAB vira mobile-only) */}
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <MonthPicker selectedMonth={selectedMonthStr} onMonthSelect={onMonthSelect} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="success" leftIcon={<ArrowUpRight size={18} />} onClick={onEntrada}>
                        Entrada
                    </Button>
                    <Button variant="destructive" leftIcon={<ArrowDownLeft size={18} />} onClick={onSaida}>
                        Saída
                    </Button>
                    <Button variant="outline" leftIcon={<ArrowRightLeft size={18} />} onClick={onTransferencia}>
                        Transferir
                    </Button>
                </div>
            </div>

            {/* KPIs — reusa o resumo original (hero Saldo em Contas + Saldo do Mês / A Receber / Inadimplência) */}
            <FinanceiroResumo
                selectedMonth={selectedMonth}
                selectedMonthStr={selectedMonthStr}
                onMonthSelect={onMonthSelect}
                resumo={resumo}
                totalSaldoContas={totalSaldoContas}
                loadingResumo={loadingResumo}
                loadingContas={loadingContas}
                showMonthPicker={false}
            />

            {/* Extratos: grid do mês (ReUI) + saldo acumulado/reconciliação */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                            <Receipt className="w-4 h-4" /> Extrato do Mês
                        </h2>
                        {!loadingExtrato && extrato.length > 0 && (
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                {extrato.length} lançamentos
                            </span>
                        )}
                    </div>
                    {loadingExtrato ? (
                        <div className="bg-card rounded-3xl border border-border shadow-card p-12 flex justify-center">
                            <div className="w-8 h-8 border-4 border-foreground border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : extrato.length === 0 ? (
                        <div className="bg-card rounded-3xl border border-border shadow-card p-12 text-center">
                            <p className="text-sm font-bold text-muted-foreground uppercase">Nenhum lançamento registrado</p>
                        </div>
                    ) : (
                        <ExtratoDataGrid extrato={extrato} />
                    )}
                </div>
                <div className="lg:col-span-5">
                    <ExtratoSaldoAcumulado
                        extratoDeSaldo={extratoDeSaldo}
                        loadingExtratoDeSaldo={loadingExtratoDeSaldo}
                        totalSaldoContas={totalSaldoContas}
                    />
                </div>
            </div>
        </div>
    )
}
