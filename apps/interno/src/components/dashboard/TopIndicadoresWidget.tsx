import { Medal, Trophy } from 'lucide-react'
import { useTopIndicadores } from '@/hooks/useTopIndicadores'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@mont/shared'
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

    if (loading) return <div className="h-40 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />

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
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                    Ranking de Indicações
                </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {validIndicadores.map((indicador, index) => (
                    <TopIndicadorCard key={indicador.indicadorId} indicador={indicador} index={index} />
                ))}
            </div>
        </div>
    )
}

function TopIndicadorCard({ indicador, index }: { indicador: TopIndicador, index: number }) {
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
                        <h3 className={cn("font-bold text-sm", isTop3 ? "text-black dark:text-white mix-blend-hard-light" : "text-gray-900 dark:text-white")}>
                            {indicador.nome}
                        </h3>
                        <div className="flex flex-col gap-0.5">
                            <p className={cn("text-xs font-medium opacity-80", isTop3 ? "text-black dark:text-white" : "text-gray-500")}>
                                {indicador.totalIndicados} {indicador.totalIndicados === 1 ? 'cliente indicado' : 'clientes indicados'}
                            </p>
                            <p className={cn("text-[10px] font-bold", isTop3 ? "text-black/70 dark:text-white/70" : "text-semantic-violet")}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(indicador.totalVendasIndicados)} em vendas
                            </p>
                        </div>
                    </div>
                </div>

                {index === 0 && <Medal className="size-6 text-yellow-600 dark:text-yellow-400 drop-shadow-md" />}
            </CardContent>
        </Card >
    )
}
