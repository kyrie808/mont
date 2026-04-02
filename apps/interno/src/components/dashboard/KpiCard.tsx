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
            <div className={cn("h-[120px] w-full animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl", className)} />
        )
    }

    // Helper logic moved to SmartProgressBar, but we might still need some for the 'default' big card if we want to reuse it there too
    // For 'default' variant, the layout is slightly different (badge on top right, bar on bottom).
    // Let's see if we can use SmartProgressBar there too or keep it separate.
    // The user explicitly pointed to the compact one (bar + badge inline).
    // I will use SmartProgressBar for compact, and maybe try to adapt it for default or leave default as is if layout differs too much.
    // Actually, 'default' in previous KpiCard code had: Header(Title/Value) + Badge(TopRight), THEN Bar(Bottom).
    // The 'compact' had: Title -> Value -> (Bar + Badge Row).

    // I will use SmartProgressBar for the Compact view mostly, as it matches the screenshot perfectly.

    // Legacy color logic for the Default variant badge if we don't use SmartProgressBar there
    const getTrendColors = () => {
        switch (trendColor) {
            case 'green': return 'bg-success/10 text-semantic-green'
            case 'red': return 'bg-destructive/10 text-semantic-red'
            case 'yellow': return 'bg-warning/10 text-semantic-yellow'
            default: return 'bg-gray-100 dark:bg-gray-800 text-gray-500'
        }
    }
    const TrendIcon = Icon || (trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus)

    const isCompact = variant === 'compact'

    return (
        <Card
            className={cn("shadow-sm bg-card border-border rounded-xl", className)}
            onClick={onClick}
        >
            <CardContent className="p-5">
                {isCompact ? (
                    // Compact Layout
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 group relative">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</span>
                            {tooltip && (
                                <div className="relative flex items-center group/tooltip">
                                    <Info className="w-3 h-3 text-gray-400 hover:text-primary transition-colors cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-[10px] rounded leading-tight w-48 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-tooltip shadow-xl font-normal text-center">
                                        {tooltip}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</span>

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
                                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</span>
                                    {tooltip && (
                                        <div className="relative flex items-center group/tooltip">
                                            <Info className="w-3 h-3 text-gray-400 hover:text-primary transition-colors cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-[10px] rounded leading-tight w-48 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-tooltip shadow-xl font-normal text-center">
                                                {tooltip}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</span>
                            </div>
                            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold", getTrendColors())}>
                                <TrendIcon className="size-3.5" /> {trend}
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mt-2">
                            <div className={cn("h-full rounded-full", progressColor)} style={{ width: `${progress}%` }}></div>
                        </div>
                        {targetLabel && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-2 block font-medium">{targetLabel}</span>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
