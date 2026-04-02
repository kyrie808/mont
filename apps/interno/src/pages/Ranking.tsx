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
import { useIndicacoes } from '../hooks/useIndicacoes'
import { useRankingCompras } from '../hooks/useRankingCompras'
import { useTopIndicadores } from '../hooks/useTopIndicadores'
import { TopIndicadoresWidget } from '../components/dashboard/TopIndicadoresWidget'
import { RankingComprasWidget } from '../components/dashboard/RankingComprasWidget'
import { Tabs, TabsList, TabsTrigger, PageSkeleton } from '@/components/ui'
import { formatCurrency } from '@mont/shared'

type TabType = 'compras' | 'indicacoes'

export function Ranking() {
    const { totalConversoes } = useIndicacoes()
    const { rankingCompras, loading } = useRankingCompras()
    const { topIndicadores } = useTopIndicadores()
    const [activeTab, setActiveTab] = useState<TabType>('compras')

    // Cálculos Dinâmicos
    const metrics = useMemo(() => {
        if (activeTab === 'compras') {
            const totalClientes = rankingCompras.length
            const somaPontos = rankingCompras.reduce((acc, curr) => acc + curr.totalPontos, 0)
            const totalCompras = rankingCompras.reduce((acc, curr) => acc + curr.totalCompras, 0)
            const ticketMedio = totalCompras > 0 ? somaPontos / totalCompras : 0

            return [
                {
                    title: "Clientes",
                    value: totalClientes.toString(),
                    trend: "No Ranking",
                    icon: Users,
                    color: "bg-primary",
                    iconColor: "text-primary"
                },
                {
                    title: "Total Pontos",
                    value: formatCurrency(somaPontos),
                    trend: "Gasto Total",
                    icon: ShoppingBag,
                    color: "bg-semantic-green",
                    iconColor: "text-semantic-green"
                },
                {
                    title: "Ticket Médio",
                    value: formatCurrency(ticketMedio),
                    trend: "Por Compra",
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
    }, [activeTab, rankingCompras, topIndicadores, totalConversoes])

    if (loading) return <PageSkeleton rows={8} showHeader />

    return (
        <>
            <Header
                title="Ranking Mont"
                showBack
                centerTitle
            />
            <PageContainer className="pt-0 pb-24 bg-transparent px-4">
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
                            <RankingComprasWidget />
                        ) : (
                            <TopIndicadoresWidget />
                        )}
                    </div>

                    <div className="mt-8 p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20 dark:border-primary/30">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Trophy className="size-5 text-primary" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Programa Embaixadores Mont</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                    Nossos top clientes e indicadores recebem benefícios exclusivos.
                                    Cada R$ 1,00 em pedidos entregues e pagos equivale a 1 ponto no ranking.
                                </p>
                            </div>
                        </div>
                    </div>
                </PageContainer>
        </>
    )
}
