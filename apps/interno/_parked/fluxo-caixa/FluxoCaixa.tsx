import { useState, useMemo } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { Header } from '../components/layout/Header'
import { DollarSign, Settings } from 'lucide-react'
import { useFluxoCaixa } from '../hooks/useFluxoCaixa'
import { useExtrato } from '../hooks/useExtrato'
import { useExtratoDeSaldo } from '../hooks/useExtratoDeSaldo'
import { useContas } from '../hooks/useContas'
import { usePlanoDeContas } from '../hooks/usePlanoDeContas'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui'

// Refactored Sub-components
import { FinanceiroResumo } from '../components/features/financeiro/FinanceiroResumo'
import { ExtratoMensal } from '../components/features/financeiro/ExtratoMensal'
import { ExtratoSaldoAcumulado } from '../components/features/financeiro/ExtratoSaldoAcumulado'
import { FinanceiroConfig } from '../components/features/financeiro/FinanceiroConfig'
import { FinanceiroFab } from '../components/features/financeiro/FinanceiroFab'

type HubTab = 'financeiro' | 'configuracoes'

export function FluxoCaixa() {
    const [activeHubTab, setActiveHubTab] = useState<HubTab>('financeiro')
    const [selectedMonth, setSelectedMonth] = useState(new Date())

    // Hooks
    const { resumo, isLoading: loadingResumo, refetch: refetchResumo } = useFluxoCaixa(selectedMonth)
    const { extrato, isLoading: loadingExtrato, refetch: refetchExtrato } = useExtrato(selectedMonth)
    const { contas, isLoading: loadingContas, refetch: refetchContas } = useContas()
    const { planoContas, isLoading: loadingPlano, refetch: refetchPlano } = usePlanoDeContas()
    const { extratoDeSaldo, isLoading: loadingExtratoDeSaldo, refetch: refetchExtratoDeSaldo } = useExtratoDeSaldo()

    // Month Picker Helper
    const selectedMonthStr = selectedMonth.toLocaleString('pt-BR', { month: 'short' })
        .replace('.', '')
        .charAt(0).toUpperCase() + selectedMonth.toLocaleString('pt-BR', { month: 'short' }).slice(1).replace('.', '')

    const handleMonthSelect = (monthName: string) => {
        const monthsMap: { [key: string]: number } = {
            'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
            'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11
        }
        const m = monthsMap[monthName]
        if (m !== undefined) {
            setSelectedMonth(new Date(selectedMonth.getFullYear(), m, 1))
        }
    }

    const refreshAll = () => {
        refetchResumo()
        refetchExtrato()
        refetchContas()
        refetchPlano()
        refetchExtratoDeSaldo()
    }

    const totalSaldoContas = useMemo(() => {
        return contas.reduce((acc, c) => acc + (c.saldo_atual || 0), 0)
    }, [contas])

    return (
        <>
            <Header title="Financeiro" showBack centerTitle />
            <PageContainer className="pt-0 pb-24 bg-transparent px-4">

                    {/* Hub Tabs Navigation */}
                    <div className="px-4 mt-4">
                        <Tabs value={activeHubTab} onValueChange={(v) => setActiveHubTab(v as HubTab)}>
                            <TabsList>
                                <TabsTrigger value="financeiro">
                                    <DollarSign className="w-4 h-4" /> Fluxo de Caixa
                                </TabsTrigger>
                                <TabsTrigger value="configuracoes">
                                    <Settings className="w-4 h-4" /> Configurações
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {activeHubTab === 'financeiro' ? (
                        <div className="px-4 py-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <FinanceiroResumo
                                selectedMonth={selectedMonth}
                                selectedMonthStr={selectedMonthStr}
                                onMonthSelect={handleMonthSelect}
                                resumo={resumo ?? null}
                                totalSaldoContas={totalSaldoContas}
                                loadingResumo={loadingResumo}
                                loadingContas={loadingContas}
                            />

                            <ExtratoMensal 
                                key={selectedMonth.toISOString()}
                                extrato={extrato} 
                                loadingExtrato={loadingExtrato} 
                            />

                            <ExtratoSaldoAcumulado 
                                extratoDeSaldo={extratoDeSaldo} 
                                loadingExtratoDeSaldo={loadingExtratoDeSaldo} 
                                totalSaldoContas={totalSaldoContas}
                            />
                        </div>
                    ) : (
                        <FinanceiroConfig 
                            contas={contas}
                            planoContas={planoContas}
                            loadingContas={loadingContas}
                            loadingPlano={loadingPlano}
                            refreshAll={refreshAll}
                        />
                    )}

                    {activeHubTab === 'financeiro' && (
                        <FinanceiroFab refreshAll={refreshAll} />
                    )}
            </PageContainer>
        </>
    )
}
