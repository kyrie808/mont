import { useState } from 'react'
import { Trophy, Medal, ChevronDown, ChevronRight } from 'lucide-react'
import { cn, formatCurrency } from '@mont/shared'
import { useTopIndicadores } from '@/hooks/useTopIndicadores'
import { PodiumCard } from '@/components/dashboard/PodiumCard'
import { IndicadosDetalhe } from '@/components/dashboard/IndicadosDetalhe'
import { rankBadge, medalColor } from '@/components/dashboard/rankBadge'
import type { TopIndicador } from '@/services/dashboardService'

interface TopIndicadoresWidgetProps {
    data?: TopIndicador[]
    loading?: boolean
}

interface IndicadorView {
    indicadorId: string
    nome: string
    totalIndicados: number
    totalConvertidos: number | null
    totalVendasIndicados: number
}

// Rótulo: mostra "trouxe N · M compraram" quando há a contagem de conversão;
// senão cai no rótulo antigo (só indicados).
function rotuloIndicados(ind: IndicadorView): string {
    if (ind.totalConvertidos != null) {
        return `${ind.totalIndicados} ${ind.totalIndicados === 1 ? 'indicado' : 'indicados'} · ${ind.totalConvertidos} ${ind.totalConvertidos === 1 ? 'comprou' : 'compraram'}`
    }
    return `${ind.totalIndicados} ${ind.totalIndicados === 1 ? 'cliente indicado' : 'clientes indicados'}`
}

export function TopIndicadoresWidget({ data, loading: externalLoading }: TopIndicadoresWidgetProps) {
    // If data is provided (even if empty array), we skip the internal hook
    const { topIndicadores: hookData, loading: internalLoading } = useTopIndicadores(data === undefined)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const loading = data ? externalLoading : internalLoading
    const rawData = data || hookData

    if (loading) return <div className="h-40 animate-pulse bg-muted rounded-xl" />

    // Aceita tanto camelCase (hook) quanto snake_case (JSON da view do Início).
    const validIndicadores: IndicadorView[] = rawData.map(i => {
        const item = i as unknown as Record<string, unknown>
        const convertidos = (i as TopIndicador).totalConvertidos ?? (item.total_convertidos as number | undefined)
        return {
            indicadorId: (i as TopIndicador).indicadorId || item.indicador_id as string,
            nome: i.nome,
            totalIndicados: (i as TopIndicador).totalIndicados ?? (item.total_indicados as number),
            totalConvertidos: convertidos ?? null,
            totalVendasIndicados: (i as TopIndicador).totalVendasIndicados ?? (item.total_vendas_indicados as number),
        }
    }).filter(i => i.totalIndicados > 0)

    if (validIndicadores.length === 0) return null

    const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id))

    return (
        <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center gap-2 px-1">
                <Trophy className="size-4 text-semantic-yellow" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    Ranking de Indicações
                </h2>
            </div>

            {/* Mobile: pódio — agora tocável para abrir os indicados */}
            <div className="grid grid-cols-1 gap-3 lg:hidden">
                {validIndicadores.map((indicador, index) => {
                    const aberto = expandedId === indicador.indicadorId
                    return (
                        <div key={indicador.indicadorId}>
                            <button
                                type="button"
                                onClick={() => toggle(indicador.indicadorId)}
                                aria-expanded={aberto}
                                className="w-full text-left"
                            >
                                <PodiumCard
                                    index={index}
                                    nome={indicador.nome}
                                    primaryText={rotuloIndicados(indicador)}
                                    secondaryText={`${formatCurrency(indicador.totalVendasIndicados)} gerados`}
                                    secondaryAccent="text-primary"
                                />
                            </button>
                            {aberto && (
                                <div className="mt-1.5 px-1">
                                    <IndicadosDetalhe indicadorId={indicador.indicadorId} />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Desktop: lista limpa — linha inteira clicável para expandir */}
            <div className="hidden lg:flex lg:flex-col lg:gap-2">
                {validIndicadores.map((indicador, index) => {
                    const rank = index + 1
                    const aberto = expandedId === indicador.indicadorId
                    return (
                        <div key={indicador.indicadorId}>
                            <button
                                type="button"
                                onClick={() => toggle(indicador.indicadorId)}
                                aria-expanded={aberto}
                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-card text-left transition-colors hover:bg-muted"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', rankBadge(rank))}>
                                        {rank}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-foreground">{indicador.nome}</p>
                                        <p className="text-xs text-muted-foreground">{rotuloIndicados(indicador)}</p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {rank <= 3 && <Medal className={cn('size-4', medalColor(rank))} />}
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-primary tabular-nums">{formatCurrency(indicador.totalVendasIndicados)}</p>
                                        <p className="text-[10px] text-muted-foreground">gerados</p>
                                    </div>
                                    {aberto
                                        ? <ChevronDown className="size-4 text-muted-foreground" />
                                        : <ChevronRight className="size-4 text-muted-foreground" />}
                                </div>
                            </button>
                            {aberto && (
                                <div className="mt-1.5 mb-1 px-1">
                                    <IndicadosDetalhe indicadorId={indicador.indicadorId} />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
