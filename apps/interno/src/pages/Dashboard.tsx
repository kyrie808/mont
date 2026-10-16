import { useState, useCallback, useEffect } from 'react'
import {
    Bell,
    TrendingUp,
    DollarSign,
    ShoppingCart,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Header } from '../components/layout/Header'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'
import { useDashboardFilter } from '../hooks/useDashboardFilter'
import { useMonthPickerBinding } from '../hooks/useMonthPickerBinding'
import { dashboardService } from '../services/dashboardService'
import { cn, formatCurrency } from '@mont/shared'
import { supabase } from '@/lib/supabase'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { KpiCardDesktop } from '@/components/dashboard/KpiCardDesktop'
import { isMesEmCurso } from '../utils/calculations'
import {
    corSemaforo,
    diaDoMesBrasilia,
    diasNoMes,
    resolverMetaFaturamento,
    ritmoDaMeta,
    semaforoAReceber,
} from '../utils/metasMensais'
import { useMetaMensal } from '@/hooks/useMetaMensal'
import { IndicadorMetaDiaria } from '@/components/dashboard/IndicadorMetaDiaria'
import { AlertasFinanceiroWidget } from '@/components/dashboard/AlertasFinanceiroWidget'
import { NotificationPanel } from '@/components/dashboard/NotificationPanel'
import { useAlertasContasAPagar } from '@/hooks/useAlertasContasAPagar'
import { useClientesEsfriando } from '@/hooks/useClientesEsfriando'
import { useVendasAEntregar } from '@/hooks/useVendasAEntregar'
import { useAlertaCapi } from '@/hooks/useAlertaCapi'
import { useConfiguracoes } from '@/hooks/useConfiguracoes'

import { TopIndicadoresWidget } from '@/components/dashboard/TopIndicadoresWidget'
import { UltimasVendasWidget } from '@/components/dashboard/UltimasVendasWidget'
import { MonthPicker } from '@/components/dashboard/MonthPicker'

export function Dashboard() {
    const navigate = useNavigate()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [notifOpen, setNotifOpen] = useState(false)
    const { openDrawer } = useNavigationStore()
    const [userName, setUserName] = useState<string>('Comandante')
    const [greeting, setGreeting] = useState<string>('Olá')
    const { month, year } = useDashboardFilter()


    const { data: metrics, isLoading: isLoadingMetrics } = useDashboardMetrics(month, year)
    const { alertas: aPagarAlertas, count: countPagar, refetch: refetchPagar } = useAlertasContasAPagar()
    const { alertas: esfriando, count: countEsfriando, refetch: refetchEsfriando } = useClientesEsfriando()
    const { alertas: aEntregar, count: countAEntregar, refetch: refetchAEntregar } = useVendasAEntregar()
    const { alerta: alertaCapi, count: countCapi, refetch: refetchCapi } = useAlertaCapi()
    const { config: configApp } = useConfiguracoes()
    const [lucroData, setLucroData] = useState({ lucro_bruto: 0, receita_bruta: 0, lucro_liquido: 0, margem_liquida_pct: 0 })
    const [liquidadoData, setLiquidadoData] = useState({ vendas_liquidadas: 0, total_liquidado: 0 })
    const [aReceberGlobal, setAReceberGlobal] = useState({ total_a_receber: 0, total_contatos_abertos: 0, a_receber_mes: 0 })
    const [metas, setMetas] = useState({
        faturamento: 0, receitaFrete: 0, ticketMedio: 0, liquidado: 0,
        lucroBruto: 0, lucroLiquido: 0, vendas: 0, itens: 0, meses: 0,
    })
    const [isLoadingLucro, setIsLoadingLucro] = useState(true)
    const queryClient = useQueryClient()

    // Metas fixas (metas_mensais). "Hoje" sempre de Brasília.
    const hojeBR = diaDoMesBrasilia()
    const mesCorrenteBR = hojeBR.ano === year && hojeBR.mes === month
    const { data: metaDoMes, isLoading: isLoadingMeta } = useMetaMensal(year, month)
    // A Receber é backlog de HOJE (todos os meses) → o teto é o do mês corrente.
    const { data: metaMesCorrente } = useMetaMensal(hojeBR.ano, hojeBR.mes)

    const isLoading = isLoadingMetrics || isLoadingLucro || isLoadingMeta

    const faturadoMes = metrics?.financial?.faturamento_mes_atual || 0
    const metaFaturamento = resolverMetaFaturamento(metaDoMes ?? null, metas.faturamento)
    const metaFaixaFaturamento = metaFaturamento.tipo === 'fixa'
        ? {
            faixa: metaFaturamento.faixa,
            ritmo: ritmoDaMeta({
                faturado: faturadoMes,
                meta: metaFaturamento.faixa,
                dia: hojeBR.dia,
                diasNoMes: diasNoMes(year, month),
                emCurso: mesCorrenteBR,
            }),
            media: metas.faturamento,
            emCurso: mesCorrenteBR,
        }
        : undefined

    const limiteAReceber = metaMesCorrente?.meta_a_receber_max != null ? Number(metaMesCorrente.meta_a_receber_max) : null
    const semaforoLimite = semaforoAReceber(aReceberGlobal.total_a_receber, limiteAReceber)
    const notaLimite = limiteAReceber !== null ? `limite: ${formatCurrency(limiteAReceber)}` : undefined
    const corLimite = semaforoLimite ? corSemaforo[semaforoLimite].texto : undefined

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingLucro(true)
            const date = new Date(year, month - 1, 1)
            const [lucro, liquidado, aReceber, metasData] = await Promise.all([
                dashboardService.getLucroLiquido(date),
                dashboardService.getLiquidadoMes(date),
                dashboardService.getTotalAReceber(year, month),
                dashboardService.getMetasMedia(),
            ])
            setLucroData(lucro)
            setLiquidadoData(liquidado)
            setAReceberGlobal(aReceber)
            setMetas(metasData)
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

    // Binding do MonthPicker ↔ filtro global (fonte única, compartilhada com Vendas)
    const { selectedMonthStr, handleMonthSelect } = useMonthPickerBinding()

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true)
        await Promise.all([
            refetchPagar(), refetchEsfriando(), refetchAEntregar(), refetchCapi(),
            // mês escolhido + mês corrente do indicador (podem ser queries diferentes)
            queryClient.invalidateQueries({ queryKey: ['dashboard_metrics'] }),
            queryClient.invalidateQueries({ queryKey: ['meta_mensal'] }),
            queryClient.invalidateQueries({ queryKey: ['pedidos_do_dia'] }),
            queryClient.invalidateQueries({ queryKey: ['sugestao_metas'] }),
        ])
        setIsRefreshing(false)
    }, [refetchPagar, refetchEsfriando, refetchAEntregar, refetchCapi, queryClient])

    const aReceberAlertas = metrics?.financial?.alertas_financeiros ?? []
    // Badge do sino = contas a pagar (vencendo/vencidas) + recebíveis atrasados
    // + clientes esfriando + vendas paradas sem entregar + fila da Meta parada.
    const totalAlerts = countPagar + aReceberAlertas.length + countEsfriando + countAEntregar + countCapi

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
                            aria-label="Notificações"
                            className="flex size-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative"
                            onClick={() => setNotifOpen(true)}
                        >
                            <Bell className="text-foreground w-6 h-6" />
                            {totalAlerts > 0 && (
                                <span className="absolute top-2 right-2 size-2 bg-semantic-red rounded-full border-2 border-background animate-pulse motion-reduce:animate-none" />
                            )}
                        </button>
                    </div>
                }
            />

            <NotificationPanel
                isOpen={notifOpen}
                onClose={() => setNotifOpen(false)}
                aPagar={aPagarAlertas}
                aReceber={aReceberAlertas}
                esfriando={esfriando}
                aEntregar={aEntregar}
                capi={alertaCapi}
                mensagemRecompra={configApp.mensagemRecompra}
                onRefresh={handleRefresh}
                refreshing={isRefreshing}
            />

                {/* Main Content */}
                <main className="w-full flex flex-col gap-6 px-4 lg:px-6 pb-24 lg:pb-8">

                    {/* Meta do dia (mês corrente de Brasília, independe do MonthPicker) */}
                    <IndicadorMetaDiaria />

                    {/* Month Picker Navigation */}
                    <MonthPicker selectedMonth={selectedMonthStr} onMonthSelect={handleMonthSelect} />

                    {/* FINANCEIRO Section */}
                    <div className="flex items-center gap-2 mt-2 mb-2 px-1">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            $ FINANCEIRO
                        </span>
                    </div>

                    {/* KPIs financeiros — MOBILE/TABLET (congelado, < lg) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 lg:hidden">
                        <KpiCard
                            title="Faturamento"
                            value={formatCurrency(metrics?.financial?.faturamento_mes_atual || 0)}
                            trend={isMesEmCurso(year, month) ? 'mês em curso' : `${metrics?.financial?.variacao_percentual?.toFixed(1) || 0}%`}
                            trendDirection={isMesEmCurso(year, month) ? 'neutral' : (metrics?.financial?.variacao_percentual || 0) >= 0 ? 'up' : 'down'}
                            icon={TrendingUp}
                            className="col-span-2"
                            variant="default"
                            loading={isLoading}
                            onClick={() => navigate('/vendas?status=entregue')}
                            tooltip="Receita de PRODUTO das vendas entregues no mês (já sem o frete). O frete aparece à parte em 'Receita de Frete'."
                        />

                        <KpiCard
                            title="Receita de Frete"
                            value={formatCurrency(metrics?.financial?.receita_frete_mes_atual || 0)}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            tooltip="Taxa de entrega das vendas entregues no mês. Receita pura (sem custo), separada do faturamento de produto."
                        />

                        <KpiCard
                            title="Lucro Bruto"
                            value={formatCurrency(lucroData.lucro_bruto)}
                            subtitle={`${lucroData.receita_bruta > 0
                                ? ((lucroData.lucro_bruto / lucroData.receita_bruta) * 100).toFixed(1)
                                : '0'}% de margem`}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            tooltip="Receita das vendas entregues menos o custo dos produtos. Não considera despesas operacionais nem pagamentos à fábrica."
                        />

                        <KpiCard
                            title="Lucro Líquido"
                            value={formatCurrency(lucroData.lucro_liquido)}
                            subtitle={`${lucroData.margem_liquida_pct.toFixed(1)}% de margem`}
                            subtitleClassName={lucroData.lucro_liquido >= 0 ? 'text-semantic-green' : 'text-destructive'}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            tooltip="Lucro real do mês. Desconta o custo dos produtos, pagamentos à fábrica e despesas operacionais lançadas. Valor mais próximo do resultado real do negócio."
                        />

                        <KpiCard
                            title="Ticket Médio"
                            value={formatCurrency(metrics?.financial?.ticket_medio_mes_atual || 0)}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            tooltip="Valor médio por venda entregue no mês."
                        />

                        <KpiCard
                            title="A Receber"
                            value={formatCurrency(aReceberGlobal.total_a_receber)}
                            subtitle={`${aReceberGlobal.total_contatos_abertos} clientes a receber${notaLimite ? ` · ${notaLimite}` : ''}`}
                            subtitleClassName={corLimite}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            onClick={() => navigate('/vendas?pagamento=pendente')}
                            tooltip="Total de fiado em aberto de todos os meses — não é filtrado pelo mês selecionado."
                        />

                        <KpiCard
                            title="Liquidado no Mês"
                            value={formatCurrency(liquidadoData.total_liquidado)}
                            subtitle={`${liquidadoData.vendas_liquidadas} quitadas`}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            onClick={() => navigate('/vendas?pagamento=pago')}
                            tooltip="Dinheiro que entrou no caixa no mês selecionado. Inclui fiados de meses anteriores pagos agora."
                        />

                    </div>

                    {/* KPIs financeiros — DESKTOP (≥ lg): barra = % da meta (média), cor semântica */}
                    <div className="mb-6 hidden gap-4 lg:grid lg:grid-cols-4">
                        <KpiCardDesktop
                            title="Faturamento"
                            value={formatCurrency(metrics?.financial?.faturamento_mes_atual || 0)}
                            className="col-span-2"
                            loading={isLoading}
                            onClick={() => navigate('/vendas?status=entregue')}
                            tooltip="Receita de PRODUTO das vendas entregues no mês (sem frete). Meta fixa do mês: barra até o alvo, traço = mínima; cor pelo ritmo dos dias corridos."
                            metaFaixa={metaFaixaFaturamento}
                            meta={metaFaturamento.tipo === 'media'
                                ? { current: faturadoMes, goal: metaFaturamento.media, emCurso: isMesEmCurso(year, month) }
                                : undefined}
                            nota={metaFaturamento.tipo === 'media' ? metaFaturamento.aviso : undefined}
                            notaClassName="text-warning-strong"
                        />
                        <KpiCardDesktop
                            title="Receita de Frete"
                            value={formatCurrency(metrics?.financial?.receita_frete_mes_atual || 0)}
                            loading={isLoading}
                            meta={{ current: metrics?.financial?.receita_frete_mes_atual || 0, goal: metas.receitaFrete, emCurso: isMesEmCurso(year, month) }}
                            tooltip="Taxa de entrega das vendas entregues no mês. Receita pura (sem custo)."
                        />
                        <KpiCardDesktop
                            title="Lucro Bruto"
                            value={formatCurrency(lucroData.lucro_bruto)}
                            loading={isLoading}
                            meta={{ current: lucroData.lucro_bruto, goal: metas.lucroBruto, emCurso: isMesEmCurso(year, month) }}
                            tooltip="Receita das vendas entregues menos o custo dos produtos."
                        />
                        <KpiCardDesktop
                            title="Lucro Líquido"
                            value={formatCurrency(lucroData.lucro_liquido)}
                            loading={isLoading}
                            meta={{ current: lucroData.lucro_liquido, goal: metas.lucroLiquido, emCurso: isMesEmCurso(year, month) }}
                            tooltip="Lucro real do mês (desconta custo dos produtos, fábrica e despesas)."
                        />
                        <KpiCardDesktop
                            title="Ticket Médio"
                            value={formatCurrency(metrics?.financial?.ticket_medio_mes_atual || 0)}
                            loading={isLoading}
                            meta={{ current: metrics?.financial?.ticket_medio_mes_atual || 0, goal: metas.ticketMedio, emCurso: isMesEmCurso(year, month), cumulative: false }}
                            tooltip="Valor médio por venda entregue no mês (comparado direto com a média histórica)."
                        />
                        <KpiCardDesktop
                            title="A Receber"
                            value={formatCurrency(aReceberGlobal.total_a_receber)}
                            loading={isLoading}
                            // Card é backlog (todos os meses) → o destino precisa do emAberto,
                            // senão a lista vem escopada no mês e não bate com o número do card.
                            onClick={() => navigate('/vendas?pagamento=pendente&emAberto=1')}
                            subtitle={`${aReceberGlobal.total_contatos_abertos} clientes · ${formatCurrency(aReceberGlobal.a_receber_mes)} de ${selectedMonthStr.toLowerCase()}`}
                            nota={notaLimite}
                            notaClassName={cn('font-bold', corLimite)}
                            tooltip="Total de fiado em aberto de TODOS os meses — dívida não tem mês, e a maior parte dela é de meses anteriores. O valor do mês selecionado aparece como contexto."
                        />
                        <KpiCardDesktop
                            title="Liquidado no Mês"
                            value={formatCurrency(liquidadoData.total_liquidado)}
                            loading={isLoading}
                            onClick={() => navigate('/vendas?pagamento=pago')}
                            meta={{ current: liquidadoData.total_liquidado, goal: metas.liquidado, emCurso: isMesEmCurso(year, month) }}
                            tooltip="Dinheiro que entrou no caixa no mês (inclui fiados de meses anteriores pagos agora)."
                        />
                    </div>

                    {/* VENDAS & ENTREGAS Section */}
                    <div className="flex items-center gap-2 mb-2 mt-2 px-1">
                        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            VENDAS & ENTREGAS
                        </span>
                    </div>

                    {/* MOBILE/TABLET (congelado, < lg) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 lg:hidden">
                        <KpiCard
                            title="Vendas"
                            value={(metrics?.financial?.vendas_mes_atual || 0).toString()}
                            subtitle="entregues no mês"
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            // O número é count(status='entregue') → o destino leva o mesmo
                            // recorte, senão o card diz 76 e a lista mostra 81.
                            onClick={() => navigate('/vendas?status=entregue')}
                        />

                        <KpiCard
                            title="Itens"
                            value={(metrics?.operational?.total_itens || 0).toString()}
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                        />

                        <KpiCard
                            title="Pendentes"
                            value={(metrics?.operational?.entregas_pendentes_total || 0).toString()}
                            subtitle="a entregar · todos os meses"
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            onClick={() => navigate('/vendas?status=pendente')}
                        />

                        <KpiCard
                            title="Entregues"
                            value={(metrics?.operational?.entregas_hoje_realizadas || 0).toString()}
                            subtitle="hoje"
                            className="col-span-1"
                            variant="compact"
                            loading={isLoading}
                            onClick={() => navigate('/vendas?status=entregue')}
                        />
                    </div>

                    {/* Vendas & Entregas — DESKTOP (≥ lg) */}
                    <div className="mb-6 hidden gap-4 lg:grid lg:grid-cols-4">
                        <KpiCardDesktop
                            title="Vendas entregues"
                            value={(metrics?.financial?.vendas_mes_atual || 0).toString()}
                            loading={isLoading}
                            // O número é count(status='entregue') → o destino precisa do mesmo
                            // recorte, senão o card diz 76 e a lista mostra 81.
                            onClick={() => navigate('/vendas?status=entregue')}
                            meta={{ current: metrics?.financial?.vendas_mes_atual || 0, goal: metas.vendas, emCurso: isMesEmCurso(year, month), unit: 'num' }}
                            tooltip="Vendas entregues no mês — mesmo critério do faturamento. Pendentes e canceladas não entram."
                        />
                        <KpiCardDesktop
                            title="Itens"
                            value={(metrics?.operational?.total_itens || 0).toString()}
                            loading={isLoading}
                            meta={{ current: metrics?.operational?.total_itens || 0, goal: metas.itens, emCurso: isMesEmCurso(year, month), unit: 'num' }}
                        />
                        <KpiCardDesktop
                            title="Pendentes"
                            value={(metrics?.operational?.entregas_pendentes_total || 0).toString()}
                            loading={isLoading}
                            // Backlog (todos os meses), igual ao A Receber → destino com emAberto.
                            onClick={() => navigate('/vendas?status=pendente&emAberto=1')}
                            subtitle="a entregar · todos os meses"
                            tooltip="Pedidos aguardando entrega, de qualquer mês (não filtra pelo mês selecionado)."
                        />
                        <KpiCardDesktop
                            title="Entregues"
                            value={(metrics?.operational?.entregas_hoje_realizadas || 0).toString()}
                            loading={isLoading}
                            // Sem clique de propósito: este número é do DIA, e a página de
                            // Vendas só recorta por mês — qualquer destino mostraria outro
                            // número e voltaria a mentir. Card informativo.
                            subtitle="hoje"
                        />
                    </div>

                    {/* Widgets Grid — mobile/tablet inalterado; em telas largas (xl) os
                        wrappers viram `contents` → 3 colunas equilibradas (Alertas · Top · Últimas). */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                        <div className="space-y-8 xl:space-y-0 xl:contents">
                            <AlertasFinanceiroWidget
                                data={metrics?.financial?.alertas_financeiros}
                                loading={isLoading}
                            />
                        </div>

                        <div className="space-y-8 xl:space-y-0 xl:contents">
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
