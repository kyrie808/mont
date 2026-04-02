import { useState, useCallback, useEffect } from 'react'
import {
    Bell,
    TrendingUp,
    TrendingDown,
    ArrowUp,
    ShoppingBag,
    Package,
    Truck,
    CheckCircle2,
    DollarSign,
    ShoppingCart,
    Wallet,
    Receipt,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'
import { useDashboardFilter } from '../hooks/useDashboardFilter'
import { dashboardService } from '../services/dashboardService'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import { supabase } from '@/lib/supabase'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { AlertasFinanceiroWidget } from '@/components/dashboard/AlertasFinanceiroWidget'
import { AlertasRecompraWidget } from '@/components/dashboard/AlertasRecompraWidget'
import { AlertasContasAPagarWidget } from '@/components/dashboard/AlertasContasAPagarWidget'
import { TopIndicadoresWidget } from '@/components/dashboard/TopIndicadoresWidget'
import { UltimasVendasWidget } from '@/components/dashboard/UltimasVendasWidget'
import { MonthPicker } from '@/components/dashboard/MonthPicker'

export function Dashboard() {
    const [isRefreshing, setIsRefreshing] = useState(false)
    const { openDrawer } = useNavigationStore()
    const [userName, setUserName] = useState<string>('Comandante')
    const [greeting, setGreeting] = useState<string>('Olá')
    const { month, year, setMonth } = useDashboardFilter()
    const navigate = useNavigate()

    const { data: metrics, isLoading: isLoadingMetrics, refetch } = useDashboardMetrics(month, year)
    const [lucroData, setLucroData] = useState({ lucro_bruto: 0, receita_bruta: 0, lucro_liquido: 0, margem_liquida_pct: 0 })
    const [liquidadoData, setLiquidadoData] = useState({ vendas_liquidadas: 0, total_liquidado: 0 })
    const [aReceberGlobal, setAReceberGlobal] = useState({ total_a_receber: 0, total_vendas_abertas: 0 })
    const [contasAPagarData, setContasAPagarData] = useState({ total_a_pagar: 0, total_vencido: 0, qtd_pendentes: 0, qtd_vencidas: 0 })
    const [proximosVencimentos, setProximosVencimentos] = useState<Awaited<ReturnType<typeof dashboardService.getProximosVencimentos>>>([])
    const [isLoadingLucro, setIsLoadingLucro] = useState(true)

    const isLoading = isLoadingMetrics || isLoadingLucro

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingLucro(true)
            const date = new Date(year, month - 1, 1)
            const [lucro, liquidado, aReceber, capDash, proxVenc] = await Promise.all([
                dashboardService.getLucroLiquido(date),
                dashboardService.getLiquidadoMes(date),
                dashboardService.getTotalAReceber(),
                dashboardService.getContasAPagarDashboard(),
                dashboardService.getProximosVencimentos(),
            ])
            setLucroData(lucro)
            setLiquidadoData(liquidado)
            setAReceberGlobal(aReceber)
            setContasAPagarData(capDash)
            setProximosVencimentos(proxVenc)
            setIsLoadingLucro(false)
        }
        fetchData()
    }, [month, year])

    // Greeting & User Logic
    useEffect(() => {
        const fetchUserAndGreeting = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email) {
                const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]
                const firstName = fullName?.split(' ')[0]
                if (firstName) setUserName(firstName)
            }

            const currentHour = new Date().getHours()
            if (currentHour >= 5 && currentHour < 12) setGreeting('Bom dia')
            else if (currentHour >= 12 && currentHour < 18) setGreeting('Boa tarde')
            else setGreeting('Boa noite')
        }

        fetchUserAndGreeting()
    }, [])

    // Derive selected month string for MonthPicker
    const selectedDate = new Date(year, month - 1, 1)
    const selectedMonthStr = selectedDate.toLocaleString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' })
        .replace('.', '')
        .replace(/^./, str => str.toUpperCase())

    const handleMonthSelect = (monthName: string) => {
        const monthsMap: { [key: string]: number } = {
            'Jan': 1, 'Fev': 2, 'Mar': 3, 'Abr': 4, 'Mai': 5, 'Jun': 6,
            'Jul': 7, 'Ago': 8, 'Set': 9, 'Out': 10, 'Nov': 11, 'Dez': 12
        }
        const m = monthsMap[monthName]
        if (m !== undefined) {
            const currentYear = new Date().getFullYear()
            // Important: use current year or allow filter to handle year
            // For now, we follow the old logic of current year but use setMonth from filter
            setMonth(new Date(currentYear, m - 1, 1))
        }
    }

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true)
        await refetch()
        setIsRefreshing(false)
    }, [refetch])

    const totalAlerts = (metrics?.financial?.alertas_financeiros?.length || 0) + (metrics?.alertas_recompra?.length || 0) + contasAPagarData.qtd_vencidas

    return (
        <>
            <Header
                title={`${greeting}, ${userName}`}
                showMenu
                onMenuClick={openDrawer}
                centerTitle
                rightAction={
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button
                            aria-label="Atualizar alertas"
                            className="flex size-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative"
                            onClick={handleRefresh}
                        >
                            <Bell className={cn("text-foreground w-6 h-6", isRefreshing && "animate-spin motion-reduce:animate-none")} />
                            {totalAlerts > 0 && (
                                <span className="absolute top-2 right-2 size-2 bg-semantic-red rounded-full border-2 border-background animate-pulse motion-reduce:animate-none" />
                            )}
                        </button>
                    </div>
                }
            />

                {/* Main Content */}
                <main className="flex-1 flex flex-col gap-6 px-4 pb-24">

                    {/* Month Picker Navigation */}
                    <MonthPicker selectedMonth={selectedMonthStr} onMonthSelect={handleMonthSelect} />

                    {/* FINANCEIRO Section */}
                    <div className="flex items-center gap-2 mt-2 mb-2 px-1">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            $ FINANCEIRO
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <KpiCard
                            title="Faturamento"
                            value={formatCurrency(metrics?.financial?.faturamento_mes_atual || 0)}
                            progress={100}
                            trend={`${metrics?.financial?.variacao_percentual?.toFixed(1) || 0}%`}
                            trendDirection={(metrics?.financial?.variacao_percentual || 0) >= 0 ? 'up' : 'down'}
                            icon={TrendingUp}
                            className="col-span-2 md:col-span-1"
                            variant="default"
                            loading={isLoading}
                            tooltip="Soma de todas as vendas entregues no mês, incluindo pedidos do catálogo. Vendas pagas e fiado em aberto."
                        />

                        <KpiCard
                            title="Lucro Bruto"
                            value={formatCurrency(lucroData.lucro_bruto)}
                            progress={100}
                            trend={lucroData.receita_bruta > 0
                                ? `${((lucroData.lucro_bruto / lucroData.receita_bruta) * 100).toFixed(1)}%`
                                : '0%'}
                            trendDirection="neutral"
                            icon={DollarSign}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            tooltip="Receita das vendas entregues menos o custo dos produtos. Não considera despesas operacionais nem pagamentos à fábrica."
                        />

                        <KpiCard
                            title="Lucro Líquido"
                            value={formatCurrency(lucroData.lucro_liquido)}
                            progress={100}
                            trend={`${lucroData.margem_liquida_pct.toFixed(1)}%`}
                            trendDirection={lucroData.lucro_liquido >= 0 ? "up" : "down"}
                            trendColor={lucroData.lucro_liquido >= 0 ? "green" : "red"}
                            icon={Wallet}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            tooltip="Lucro real do mês. Desconta o custo dos produtos, pagamentos à fábrica e despesas operacionais lançadas. Valor mais próximo do resultado real do negócio."
                        />

                        <KpiCard
                            title="Ticket Médio"
                            value={formatCurrency(metrics?.financial?.ticket_medio_mes_atual || 0)}
                            progress={75}
                            trend="Estável"
                            trendDirection="neutral"
                            icon={ArrowUp}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            tooltip="Valor médio por venda entregue no mês."
                        />

                        <KpiCard
                            title="A Receber"
                            value={formatCurrency(aReceberGlobal.total_a_receber)}
                            progress={50}
                            trend={`— ${aReceberGlobal.total_vendas_abertas} pendências`}
                            trendDirection="neutral"
                            trendColor={aReceberGlobal.total_vendas_abertas > 0 ? "yellow" : "green"}
                            icon={TrendingDown}
                            className="col-span-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            variant="compact"
                            onClick={() => navigate('/contas-a-receber')}
                            loading={isLoading}
                            tooltip="Total de fiado em aberto de todos os meses — não é filtrado pelo mês selecionado."
                        />

                        <KpiCard
                            title="Liquidado no Mês"
                            value={formatCurrency(liquidadoData.total_liquidado)}
                            progress={100}
                            trend={`${liquidadoData.vendas_liquidadas} quitadas`}
                            trendDirection="neutral"
                            trendColor="green"
                            icon={Wallet}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            tooltip="Dinheiro que entrou no caixa no mês selecionado. Inclui fiados de meses anteriores pagos agora."
                        />

                        <KpiCard
                            title="A Pagar"
                            value={formatCurrency(contasAPagarData.total_a_pagar)}
                            progress={50}
                            trend={`— ${contasAPagarData.qtd_pendentes} pendências`}
                            trendDirection="neutral"
                            trendColor={contasAPagarData.qtd_pendentes > 0 ? "yellow" : "green"}
                            icon={Receipt}
                            className="col-span-1 cursor-pointer hover:bg-muted transition-colors"
                            variant="compact"
                            onClick={() => navigate('/contas-a-pagar')}
                            loading={isLoading}
                            tooltip="Total de saldo devedor de todas as obrigações não pagas — não é filtrado pelo mês selecionado."
                        />

                        <KpiCard
                            title="Vencido"
                            value={formatCurrency(contasAPagarData.total_vencido)}
                            progress={100}
                            trend={`${contasAPagarData.qtd_vencidas} vencida${contasAPagarData.qtd_vencidas !== 1 ? 's' : ''}`}
                            trendDirection={contasAPagarData.total_vencido > 0 ? "down" : "neutral"}
                            trendColor={contasAPagarData.total_vencido > 0 ? "red" : "green"}
                            icon={Receipt}
                            className="col-span-1 cursor-pointer hover:bg-muted transition-colors"
                            variant="compact"
                            onClick={() => navigate('/contas-a-pagar')}
                            loading={isLoading}
                            tooltip="Saldo devedor de obrigações com vencimento ultrapassado."
                        />
                    </div>


                    {/* VENDAS & ENTREGAS Section */}
                    <div className="flex items-center gap-2 mb-2 mt-2 px-1">
                        <ShoppingCart className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            VENDAS & ENTREGAS
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <KpiCard
                            title="Vendas"
                            value={(metrics?.financial?.vendas_mes_atual || 0).toString()}
                            progress={70}
                            trend="Mês"
                            trendDirection="up"
                            icon={ShoppingBag}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                        />

                        <KpiCard
                            title="Itens"
                            value={(metrics?.operational?.total_itens || 0).toString()}
                            progress={65}
                            trend="Vol"
                            trendDirection="neutral"
                            icon={Package}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                        />

                        <KpiCard
                            title="Pendentes"
                            value={(metrics?.operational?.entregas_pendentes_total || 0).toString()}
                            progress={100}
                            trend="Total"
                            trendDirection="neutral"
                            icon={Truck}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                        />

                        <KpiCard
                            title="Entregues"
                            value={(metrics?.operational?.entregas_hoje_realizadas || 0).toString()}
                            progress={100}
                            trend="Hoje"
                            trendDirection="up"
                            icon={CheckCircle2}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                        />
                    </div>

                    {/* Widgets Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        <div className="space-y-8">
                            <AlertasFinanceiroWidget
                                data={metrics?.financial?.alertas_financeiros}
                                loading={isLoading}
                            />
                            <AlertasContasAPagarWidget
                                data={proximosVencimentos}
                                loading={isLoading}
                            />
                            <AlertasRecompraWidget
                                data={metrics?.alertas_recompra}
                                loading={isLoading}
                            />
                        </div>

                        <div className="space-y-8">
                            <TopIndicadoresWidget
                                data={metrics?.operational?.ranking_indicacoes}
                                loading={isLoading}
                            />
                            <UltimasVendasWidget
                                data={metrics?.operational?.ultimas_vendas}
                                loading={isLoading}
                            />
                        </div>
                    </div>
                </main>
        </>
    )
}
