import { Trophy, Medal } from 'lucide-react'
import { cn, formatCurrency } from '@mont/shared'
import { useTopIndicadores } from '@/hooks/useTopIndicadores'
import { PodiumCard } from '@/components/dashboard/PodiumCard'
import { rankBadge, medalColor } from '@/components/dashboard/rankBadge'
import type { TopIndicador } from '@/services/dashboardService'


interface TopIndicadoresWidgetProps {
    data?: TopIndicador[]
    loading?: boolean
}

export function TopIndicadoresWidget({ data, loading: externalLoading }: TopIndicadoresWidgetProps) {
    // If data is provided (even if empty array), we skip the internal hook
    const { topIndicadores: hookData, loading: internalLoading } = useTopIndicadores(data === undefined)

    const loading = data ? externalLoading : internalLoading
    const rawData = data || hookData

    if (loading) return <div className="h-40 animate-pulse bg-muted rounded-xl" />

    // Map data to expected format if it comes from JSON view
    const validIndicadores = rawData.map(i => {
        const item = i as unknown as Record<string, unknown>
        return {
            indicadorId: (i as TopIndicador).indicadorId || item.indicador_id as string,
            nome: i.nome,
            totalIndicados: (i as TopIndicador).totalIndicados ?? (item.total_indicados as number),
            totalVendasIndicados: (i as TopIndicador).totalVendasIndicados ?? (item.total_vendas_indicados as number)
        }
    }).filter(i => i.totalIndicados > 0)

    if (validIndicadores.length === 0) return null

    return (
        <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center gap-2 px-1">
                <Trophy className="size-4 text-semantic-yellow" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    Ranking de Indicações
                </h2>
            </div>

            {/* Mobile: pódio atual (congelado) */}
            <div className="grid grid-cols-1 gap-3 lg:hidden">
                {validIndicadores.map((indicador, index) => (
                    <PodiumCard
                        key={indicador.indicadorId}
                        index={index}
                        nome={indicador.nome}
                        primaryText={`${indicador.totalIndicados} ${indicador.totalIndicados === 1 ? 'cliente indicado' : 'clientes indicados'}`}
                        secondaryText={`${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(indicador.totalVendasIndicados)} em vendas`}
                        secondaryAccent="text-primary"
                    />
                ))}
            </div>

            {/* Desktop: lista limpa — badge de posição colorido + card neutro */}
            <div className="hidden lg:flex lg:flex-col lg:gap-2">
                {validIndicadores.map((indicador, index) => {
                    const rank = index + 1
                    return (
                        <div
                            key={indicador.indicadorId}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', rankBadge(rank))}>
                                    {rank}
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-foreground">{indicador.nome}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {indicador.totalIndicados} {indicador.totalIndicados === 1 ? 'cliente indicado' : 'clientes indicados'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {rank <= 3 && <Medal className={cn('size-4', medalColor(rank))} />}
                                <div className="text-right">
                                    <p className="text-sm font-bold text-primary tabular-nums">{formatCurrency(indicador.totalVendasIndicados)}</p>
                                    <p className="text-[10px] text-muted-foreground">em vendas</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
