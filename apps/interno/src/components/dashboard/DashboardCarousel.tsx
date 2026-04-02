import type { ReactNode } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@mont/shared'

interface DashboardCarouselProps {
    title: string
    icon: LucideIcon
    count?: number
    onViewAll?: () => void
    children: ReactNode
    className?: string
    emptyState?: ReactNode
}

export function DashboardCarousel({
    title,
    icon: Icon,
    count,
    onViewAll,
    children,
    className,
    emptyState
}: DashboardCarouselProps) {
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Icon className="size-4 text-gray-500 dark:text-gray-400" />
                    <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                        {title}
                    </h2>
                    {count !== undefined && count > 0 && (
                        <span className="bg-red-100 dark:bg-red-900/30 text-semantic-red text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {count}
                        </span>
                    )}
                </div>
                {onViewAll && (
                    <button
                        onClick={onViewAll}
                        className="flex items-center text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        Ver todos <ChevronRight className="size-3 ml-0.5" />
                    </button>
                )}
            </div>

            {/* Scrollable Container */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 -mx-4 px-4 no-scrollbar">
                {children ? children : emptyState}
            </div>
        </div>
    )
}
