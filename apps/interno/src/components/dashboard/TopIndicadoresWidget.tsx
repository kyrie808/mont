import { Trophy } from 'lucide-react'
import { useTopIndicadores } from '@/hooks/useTopIndicadores'
import { PodiumCard } from '@/components/dashboard/PodiumCard'
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

            <div className="grid grid-cols-1 gap-3">
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
        </div>
    )
}
