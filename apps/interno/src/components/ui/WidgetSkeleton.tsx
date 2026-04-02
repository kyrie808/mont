import { Skeleton } from './Skeleton'
import { cn } from '@mont/shared'

interface WidgetSkeletonProps {
    height?: string
    lines?: number
    className?: string
}

export function WidgetSkeleton({ height = 'h-40', lines = 3, className }: WidgetSkeletonProps) {
    return (
        <div className={cn('rounded-xl bg-card border border-border p-4 space-y-3', height, className)} role="status" aria-label="Carregando...">
            <Skeleton className="h-4 w-1/3" />
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
            ))}
        </div>
    )
}
