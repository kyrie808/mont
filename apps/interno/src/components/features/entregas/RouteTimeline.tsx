import { MapPin, Navigation } from 'lucide-react'
import { cn } from '@mont/shared'

interface RouteStop {
    id: string
    name: string
    address: string
    neighborhood: string | null
}

interface RouteTimelineProps {
    stops: RouteStop[]
    className?: string
}

export function RouteTimeline({ stops, className }: RouteTimelineProps) {
    if (stops.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <Navigation className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma rota gerada ainda</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Selecione entregas e clique em "Gerar Rota"</p>
            </div>
        )
    }

    return (
        <div className={cn("space-y-3 relative", className)}>
            {/* Vertical connector line */}
            <div className="absolute left-[23px] top-8 bottom-8 w-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />

            {stops.map((stop, index) => {
                const isFirst = index === 0
                const isLast = index === stops.length - 1

                return (
                    <div key={stop.id} className="flex items-start gap-4 group">
                        {/* Number Circle */}
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2 flex-shrink-0 transition-colors",
                            isFirst ? "bg-semantic-green border-semantic-green text-white" :
                                isLast ? "bg-semantic-red border-semantic-red text-white" :
                                    "bg-card border-border text-foreground"
                        )}>
                            {isFirst ? <MapPin className="w-5 h-5" /> : index}
                        </div>

                        {/* Stop Info */}
                        <div className="flex-1 p-4 rounded-xl border border-border bg-card group-hover:border-border/80 group-hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{stop.name}</h4>
                                {isLast && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-semantic-red/10 text-semantic-red text-xs font-bold">
                                        Destino Final
                                    </span>
                                )}
                            </div>
                            {stop.neighborhood && (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium mb-2">
                                    {stop.neighborhood}
                                </span>
                            )}
                            <p className="text-xs text-gray-600 dark:text-gray-400">{stop.address}</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
