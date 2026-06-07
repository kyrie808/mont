import { TrendingUp, TrendingDown, Minus, Info, type LucideIcon } from 'lucide-react'
import { cn } from '@mont/shared'
import { Card, CardContent } from '@/components/ui/Card'
import { SmartProgressBar } from './SmartProgressBar'

export interface KpiCardProps {
    title: string
    value: string
    progress?: number
    trend?: string
    trendDirection?: 'up' | 'down' | 'neutral'
    targetLabel?: string
    icon?: LucideIcon
    progressColor?: string
    trendColor?: "green" | "red" | "primary" | "yellow"
    iconColor?: string
    className?: string
    variant?: 'default' | 'compact'
    loading?: boolean
    onClick?: () => void
    tooltip?: string
}

function KpiTooltip({ tooltip }: { tooltip: string }) {
    return (
        <div className="relative flex items-center group/tooltip">
            <Info className="w-3 h-3 text-muted-foreground hover:text-primary transition-colors cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-foreground text-background text-[10px] rounded leading-tight w-48 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-tooltip shadow-modal font-normal text-center">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-foreground" />
            </div>
        </div>
    )
}

export function KpiCard({
    title,
    value,
    progress = 0,
    trend = '',
    trendDirection = 'neutral',
    targetLabel,
    icon: Icon,
    progressColor = "bg-primary",
    trendColor = "green",
    iconColor,
    className,
    variant = 'default',
    loading,
    onClick,
    tooltip
}: KpiCardProps) {

    if (loading) {
        return (
            <div className={cn("h-[120px] w-full animate-pulse bg-muted rounded-xl", className)} />
        )
    }

    // Cor do badge de trend no variant 'default' (não usa SmartProgressBar)
    const getTrendColors = () => {
        switch (trendColor) {
            case 'green': return 'bg-success/10 text-semantic-green'
            case 'red': return 'bg-destructive/10 text-semantic-red'
            case 'yellow': return 'bg-warning/10 text-semantic-yellow'
            default: return 'bg-muted text-muted-foreground'
        }
    }
    const TrendIcon = trendDirection === 'neutral' ? Minus : (Icon || (trendDirection === 'up' ? TrendingUp : TrendingDown))

    const isCompact = variant === 'compact'

    return (
        <Card
            className={cn("shadow-card bg-card border-border rounded-xl", className)}
            onClick={onClick}
        >
            <CardContent className="p-5">
                {isCompact ? (
                    // Compact Layout
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 group relative">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
                            {tooltip && <KpiTooltip tooltip={tooltip} />}
                        </div>
                        <span className="text-2xl font-bold text-foreground mt-1">{value}</span>

                        <SmartProgressBar
                            progress={progress}
                            progressColor={progressColor}
                            trend={trend}
                            trendDirection={trendDirection}
                            trendColor={trendColor}
                            icon={Icon}
                            iconColor={iconColor}
                            className="mt-1"
                        />
                    </div>
                ) : (
                    // Default Layout (Revenue)
                    <>
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 group relative">
                                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
                                    {tooltip && <KpiTooltip tooltip={tooltip} />}
                                </div>
                                <span className="text-2xl font-bold text-foreground mt-1">{value}</span>
                            </div>
                            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold", getTrendColors())}>
                                <TrendIcon className="size-3.5" /> {trend}
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-2">
                            <div className={cn("h-full rounded-full", progressColor)} style={{ width: `${progress}%` }}></div>
                        </div>
                        {targetLabel && (
                            <span className="text-xs text-muted-foreground mt-2 block font-medium">{targetLabel}</span>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
