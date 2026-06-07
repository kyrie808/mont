import { Trophy } from 'lucide-react'
import { useRankingCompras } from '@/hooks/useRankingCompras'
import { PodiumCard } from '@/components/dashboard/PodiumCard'
import { WidgetSkeleton } from '@/components/ui/WidgetSkeleton'

export function RankingComprasWidget() {
    const { rankingCompras, loading } = useRankingCompras()

    if (loading) return <WidgetSkeleton height="h-40" lines={3} />

    // Filter out entries with 0 points (already handled by view)
    const validRanking = rankingCompras.filter(i => i.totalPontos > 0)

    if (validRanking.length === 0) return null

    return (
        <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center gap-2 px-1">
                <Trophy className="size-4 text-semantic-yellow" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    Ranking de Compras
                </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {validRanking.map((item, index) => (
                    <PodiumCard
                        key={item.contatoId}
                        index={index}
                        nome={item.nome}
                        primaryText={`${item.totalCompras} ${item.totalCompras === 1 ? 'venda entregue' : 'vendas entregues'}`}
                        secondaryText={`${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalPontos)} em pontos`}
                        secondaryAccent="text-warning-strong"
                        showAmbassadorBadge
                    />
                ))}
            </div>
        </div>
    )
}
