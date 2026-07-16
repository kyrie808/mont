import { useState, useMemo } from 'react'
import {
    Trophy,
    Users,
    TrendingUp,
    ShoppingBag,
    DollarSign,
    Target
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { KpiCard } from '../components/dashboard/KpiCard'
import { MonthPicker } from '../components/dashboard/MonthPicker'
import { useMonthPickerBinding } from '../hooks/useMonthPickerBinding'
import { useIndicacoes } from '../hooks/useIndicacoes'
import { useRankingCompras } from '../hooks/useRankingCompras'
import { useTopIndicadores } from '../hooks/useTopIndicadores'
import { TopIndicadoresWidget } from '../components/dashboard/TopIndicadoresWidget'
import { RankingComprasWidget } from '../components/dashboard/RankingComprasWidget'
import { Tabs, TabsList, TabsTrigger, PageSkeleton } from '@/components/ui'
import { formatCurrency } from '@mont/shared'

type TabType = 'compras' | 'indicacoes'
type EscopoType = 'geral' | 'mes'

const TOP_N = 10
const nfPontos = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function Ranking() {
    const { totalConversoes } = useIndicacoes()
    const { topIndicadores } = useTopIndicadores()
    const [activeTab, setActiveTab] = useState<TabType>('compras')
    const [escopo, setEscopo] = useState<EscopoType>('geral')

    // "Do mês" usa o filtro global (mesmo mês do Dashboard/Vendas); desktop mostra o
    // MonthPicker, mobile herda o mês corrente do store (sem picker — layout sagrado).
    const { selectedMonthStr, handleMonthSelect, month, year } = useMonthPickerBinding()
    const periodo = escopo === 'mes'
        ? { ano: year, mes: month }
        : { ano: null, mes: null }
    const { rankingCompras, loading } = useRankingCompras(periodo)

    // Top-N para o pódio/lista; os KPIs usam o conjunto INTEIRO (números honestos).
    const topRanking = rankingCompras.slice(0, TOP_N)

    const metrics = useMemo(() => {
        if (activeTab === 'compras') {
            const totalClientes = rankingCompras.length
            const somaPontos = rankingCompras.reduce((acc, curr) => acc + curr.totalPontos, 0)
            const totalCompras = rankingCompras.reduce((acc, curr) => acc + curr.totalCompras, 0)
            const mediaPorCompra = totalCompras > 0 ? somaPontos / totalCompras : 0

            return [
                {
                    title: "Clientes",
                    value: totalClientes.toString(),
                    trend: escopo === 'mes' ? "no mês" : "no ranking",
                    icon: Users,
                    color: "bg-primary",
                    iconColor: "text-primary"
                },
                {
                    title: "Pontos",
                    value: nfPontos.format(somaPontos),
                    trend: escopo === 'mes' ? "no mês" : "geral",
                    icon: ShoppingBag,
                    color: "bg-semantic-green",
                    iconColor: "text-semantic-green"
                },
                {
                    title: "Média/compra",
                    value: nfPontos.format(mediaPorCompra),
                    trend: "pontos",
                    icon: TrendingUp,
                    color: "bg-semantic-yellow",
                    iconColor: "text-semantic-yellow"
                }
            ]
        } else {
            const somaVendasIndicados = topIndicadores.reduce((acc, curr) => acc + curr.totalVendasIndicados, 0)
            const topIndicador = topIndicadores[0]

            return [
                {
                    title: "Conversões",
                    value: totalConversoes.toString(),
                    trend: "Indicados -> Clientes",
                    icon: Target,
                    color: "bg-primary",
                    iconColor: "text-primary"
                },
                {
                    title: "Receita Indicações",
                    value: formatCurrency(somaVendasIndicados),
                    trend: "Gerado por Embaixadores",
                    icon: DollarSign,
                    color: "bg-semantic-green",
                    iconColor: "text-semantic-green"
                },
                {
                    title: "Top Indicador",
                    value: topIndicador ? topIndicador.nome.split(' ')[0] : "Nenhum ainda",
                    trend: topIndicador ? formatCurrency(topIndicador.totalVendasIndicados) : "Aguardando",
                    icon: Trophy,
                    color: "bg-semantic-yellow",
                    iconColor: "text-semantic-yellow"
                }
            ]
        }
    }, [activeTab, escopo, rankingCompras, topIndicadores, totalConversoes])

    if (loading && rankingCompras.length === 0) return <PageSkeleton rows={8} showHeader />

    return (
        <>
            <Header
                title="Ranking Mont"
                showBack
                centerTitle
            />
            <PageContainer className="pt-0 pb-24 bg-transparent">
                    {/* Metrics / KPI Summary */}
                    <div className="grid grid-cols-3 gap-3 mb-6 min-h-[110px]">
                        {metrics.map((m, idx) => (
                            <KpiCard
                                key={idx}
                                title={m.title}
                                value={m.value}
                                progress={100}
                                trend={m.trend}
                                trendDirection="up"
                                icon={m.icon}
                                progressColor={m.color}
                                trendColor={m.color.replace('bg-semantic-', '').replace('bg-', '') as "primary" | "green" | "yellow" | "red" | undefined}
                                iconColor={m.iconColor}
                                variant="compact"
                            />
                        ))}
                    </div>

                    {/* Apple-like Tabs */}
                    <div className="mb-6">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
                            <TabsList>
                                <TabsTrigger value="compras">
                                    <ShoppingBag className="size-4" /> Compras
                                </TabsTrigger>
                                <TabsTrigger value="indicacoes">
                                    <Users className="size-4" /> Indicações
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Ranking Content */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {activeTab === 'compras' ? (
                            <>
                                {/* Período: Geral × Do mês (os 2 aparelhos). MonthPicker só no desktop,
                                    em linha própria e largura total — a faixa dos 12 meses precisa de
                                    espaço (em container estreito ela cortava os meses seguintes). */}
                                <div className="mb-2 space-y-3">
                                    <div className="lg:w-64">
                                        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as EscopoType)}>
                                            <TabsList>
                                                <TabsTrigger value="geral">Geral</TabsTrigger>
                                                <TabsTrigger value="mes">Do mês</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                    {escopo === 'mes' && (
                                        <div className="hidden lg:block">
                                            <MonthPicker selectedMonth={selectedMonthStr} onMonthSelect={handleMonthSelect} />
                                        </div>
                                    )}
                                </div>
                                <RankingComprasWidget data={topRanking} loading={loading} />
                            </>
                        ) : (
                            <>
                                {/* Indicações é vitalício (o prêmio não reinicia por mês) — sem toggle. */}
                                <p className="mb-2 text-xs text-muted-foreground">
                                    Ranking vitalício · total de todas as indicações
                                </p>
                                <TopIndicadoresWidget />
                            </>
                        )}
                    </div>

                    <div className="mt-8 p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20 dark:border-primary/30">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Trophy className="size-5 text-primary" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-foreground">Programa Embaixadores Mont</h4>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    Nossos top clientes e indicadores recebem benefícios exclusivos.
                                    Cada R$ 1,00 em <strong className="font-semibold">produtos</strong> entregues e pagos vale 1 ponto (o frete não conta).
                                </p>
                            </div>
                        </div>
                    </div>
                </PageContainer>
        </>
    )
}
