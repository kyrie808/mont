import { Trophy, Medal } from 'lucide-react'
import { cn } from '@mont/shared'
import { PodiumCard } from '@/components/dashboard/PodiumCard'
import { rankBadge, medalColor } from '@/components/dashboard/rankBadge'
import { WidgetSkeleton } from '@/components/ui/WidgetSkeleton'
import type { RankingComprasStats } from '@/hooks/useRankingCompras'

interface RankingComprasWidgetProps {
    data: RankingComprasStats[]
    loading?: boolean
}

const nfPontos = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const formatPontos = (n: number) => `${nfPontos.format(n)} ${n === 1 ? 'ponto' : 'pontos'}`
const formatCompras = (n: number) => `${n} ${n === 1 ? 'compra' : 'compras'}`

// Ranking de Compras = programa de pontos (1 ponto = R$1 em produto; frete não conta).
// Mobile: pódio (PodiumCard, congelado). Desktop: lista densa espelhando o TopIndicadoresWidget.
// A página controla o período e passa os dados por props.
export function RankingComprasWidget({ data, loading }: RankingComprasWidgetProps) {
    if (loading) return <WidgetSkeleton height="h-40" lines={3} />

    if (data.length === 0) {
        return (
            <div className="mt-4 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Nenhuma compra pontuável no período.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center gap-2 px-1">
                <Trophy className="size-4 text-semantic-yellow" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    Ranking de Compras
                </h2>
            </div>

            {/* Mobile: pódio atual (congelado) */}
            <div className="grid grid-cols-1 gap-3 lg:hidden">
                {data.map((item, index) => (
                    <PodiumCard
                        key={item.contatoId}
                        index={index}
                        nome={item.nome}
                        primaryText={formatCompras(item.totalCompras)}
                        secondaryText={formatPontos(item.totalPontos)}
                        secondaryAccent="text-warning-strong"
                        showAmbassadorBadge
                    />
                ))}
            </div>

            {/* Desktop: lista limpa — badge de posição colorido + card neutro */}
            <div className="hidden lg:flex lg:flex-col lg:gap-2">
                {data.map((item, index) => {
                    const rank = index + 1
                    return (
                        <div
                            key={item.contatoId}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', rankBadge(rank))}>
                                    {rank}
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-foreground">{item.nome}</p>
                                    <p className="text-xs text-muted-foreground">{formatCompras(item.totalCompras)}</p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {rank <= 3 && <Medal className={cn('size-4', medalColor(rank))} />}
                                <div className="text-right">
                                    <p className="text-sm font-bold text-warning-strong tabular-nums">{nfPontos.format(item.totalPontos)}</p>
                                    <p className="text-[10px] text-muted-foreground">pontos</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
