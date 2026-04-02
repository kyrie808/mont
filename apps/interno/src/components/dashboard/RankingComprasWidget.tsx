import { Medal, Trophy, Star } from 'lucide-react'
import { useRankingCompras } from '@/hooks/useRankingCompras'
import type { RankingComprasStats } from '@/hooks/useRankingCompras'
import { Card, CardContent } from '@/components/ui/Card'
import { WidgetSkeleton } from '@/components/ui/WidgetSkeleton'
import { cn } from '@mont/shared'

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
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                    Ranking de Compras
                </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {validRanking.map((item, index) => (
                    <RankingCompraCard key={item.contatoId} item={item} index={index} />
                ))}
            </div>
        </div>
    )
}

function RankingCompraCard({ item, index }: { item: RankingComprasStats, index: number }) {
    // Gradients intencionais: ouro/prata/bronze têm semântica visual universal — não substituir por tokens semânticos
    const getGradient = (ranking: number) => {
        switch (ranking) {
            case 1: return "bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900 border-yellow-400"
            case 2: return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 border-gray-400"
            case 3: return "bg-gradient-to-r from-orange-300 to-orange-400 text-orange-900 border-orange-400"
            default: return "bg-card text-foreground border-border"
        }
    }

    const isTop3 = index < 3
    const gradientClass = isTop3 ? getGradient(index + 1) : getGradient(99)

    return (
        <Card className={cn(
            "relative overflow-hidden border transition-all hover:scale-[1.01]",
            isTop3 ? "border-0 shadow-lg" : "shadow-sm"
        )}>
            <div className={cn("absolute inset-0 opacity-20", gradientClass)}></div>

            <CardContent className={cn("flex items-center justify-between p-4 relative z-10", isTop3 ? "" : "bg-card/50")}>
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "flex items-center justify-center size-10 rounded-full font-bold text-lg shadow-inner",
                        isTop3 ? "bg-white/30 backdrop-blur-sm text-black" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    )}>
                        {index + 1}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className={cn("font-bold text-sm", isTop3 ? "text-black dark:text-white mix-blend-hard-light" : "text-gray-900 dark:text-white")}>
                                {item.nome}
                            </h3>
                            {isTop3 && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/10 text-xs font-bold uppercase tracking-tight">
                                    <Star className="size-3" />
                                    Embaixador
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <p className={cn("text-xs font-medium opacity-80", isTop3 ? "text-black dark:text-white" : "text-gray-500")}>
                                {item.totalCompras} {item.totalCompras === 1 ? 'venda entregue' : 'vendas entregues'}
                            </p>
                            <p className={cn("text-xs font-bold", isTop3 ? "text-black/70 dark:text-white/70" : "text-semantic-orange")}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalPontos)} em pontos
                            </p>
                        </div>
                    </div>
                </div>

                {index === 0 && <Medal className="size-6 text-yellow-600 dark:text-yellow-400 drop-shadow-md" />}
            </CardContent>
        </Card >
    )
}
