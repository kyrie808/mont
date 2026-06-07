import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'
import { cn } from '@mont/shared'

interface SmartProgressBarProps {
    progress: number
    progressColor?: string
    trend: string
    trendDirection: 'up' | 'down' | 'neutral'
    trendColor?: 'green' | 'red' | 'primary' | 'yellow'
    icon?: LucideIcon
    iconColor?: string
    className?: string
}

export function SmartProgressBar({
    progress,
    progressColor = "bg-primary",
    trend,
    trendDirection,
    trendColor = "green",
    icon: Icon,
    iconColor,
    className
}: SmartProgressBarProps) {

    const getTrendColors = (color: SmartProgressBarProps['trendColor']) => {
        switch (color) {
            case 'green': return 'bg-success/10 text-semantic-green ring-1 ring-success/20'
            case 'red': return 'bg-destructive/10 text-semantic-red ring-1 ring-destructive/20'
            case 'yellow': return 'bg-warning/10 text-semantic-yellow ring-1 ring-warning/20'
            default: return 'bg-muted text-muted-foreground'
        }
    }

    const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus

    return (
        <div className={cn("w-full", className)}>
            <div className="flex items-center justify-between mb-1.5">
                {/* Icon & Trend Row */}
                <div className="flex items-center gap-2">
                    {Icon && (
                        <div className={cn("p-1.5 rounded-md bg-muted", iconColor ? "" : "text-muted-foreground")}>
                            <Icon className={cn("size-4", iconColor)} />
                        </div>
                    )}
                    <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", getTrendColors(trendColor))}>
                        <TrendIcon className="size-3" /> {trend}
                    </div>
                </div>
            </div>

            {/* Progress Bar Track */}
            <div className="h-1.5 flex-1 rounded-full overflow-hidden bg-muted">
                {/* Progress Indicator */}
                <div
                    className={cn("h-full rounded-full transition-all duration-500", progressColor)}
                    style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                ></div>
            </div>
        </div >
    )
}
