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
            case 'green': return 'bg-green-100 dark:bg-green-900/30 text-semantic-green ring-1 ring-semantic-green/20'
            case 'red': return 'bg-red-100 dark:bg-red-900/30 text-semantic-red ring-1 ring-semantic-red/20'
            case 'yellow': return 'bg-yellow-100 dark:bg-yellow-900/30 text-semantic-yellow ring-1 ring-semantic-yellow/20'
            default: return 'bg-gray-100 dark:bg-gray-800 text-gray-500'
        }
    }

    const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus

    return (
        <div className={cn("w-full", className)}>
            <div className="flex items-center justify-between mb-1.5">
                {/* Icon & Trend Row */}
                <div className="flex items-center gap-2">
                    {Icon && (
                        <div className={cn("p-1.5 rounded-md bg-gray-50 dark:bg-white/5", iconColor ? "" : "text-gray-500")}>
                            <Icon className={cn("size-4", iconColor)} />
                        </div>
                    )}
                    <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", getTrendColors(trendColor))}>
                        <TrendIcon className="size-3" /> {trend}
                    </div>
                </div>
            </div>

            {/* Progress Bar Track */}
            <div className="h-1.5 flex-1 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800/50">
                {/* Progress Indicator */}
                <div
                    className={cn("h-full rounded-full transition-all duration-500", progressColor)}
                    style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                ></div>
            </div>
        </div >
    )
}
