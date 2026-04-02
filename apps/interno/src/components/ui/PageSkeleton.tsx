import { Skeleton } from './Skeleton'
import { cn } from '@mont/shared'

interface PageSkeletonProps {
    rows?: number
    showHeader?: boolean
    showCards?: boolean
    className?: string
}

export function PageSkeleton({ rows = 4, showHeader = true, showCards = false, className }: PageSkeletonProps) {
    return (
        <div className={cn('space-y-4 p-4', className)} role="status" aria-label="Carregando...">
            {showHeader && (
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-6 w-48" />
                </div>
            )}
            {showCards ? (
                <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: rows }).map((_, i) => (
                        <div key={i} className="rounded-xl bg-card border border-border p-4 space-y-2">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-6 w-1/2" />
                        </div>
                    ))}
                </div>
            ) : (
                Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-card border border-border p-4 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                ))
            )}
        </div>
    )
}
