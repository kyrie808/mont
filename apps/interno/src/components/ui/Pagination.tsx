import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@mont/shared'

interface PaginationProps {
    currentPage: number
    totalItems: number
    pageSize: number
    onPageChange: (page: number) => void
    className?: string
}

export function Pagination({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    className,
}: PaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

    if (totalPages <= 1) return null

    const canGoPrev = currentPage > 1
    const canGoNext = currentPage < totalPages

    return (
        <div className={cn('flex items-center justify-center gap-3 py-4', className)}>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={!canGoPrev}
                className={cn(
                    'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    canGoPrev
                        ? 'text-foreground hover:bg-muted'
                        : 'text-muted-foreground/40 cursor-not-allowed'
                )}
            >
                <ChevronLeft className="h-4 w-4" />
                Anterior
            </button>

            <span className="text-sm text-muted-foreground font-mono tabular-nums">
                {currentPage} / {totalPages}
            </span>

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={!canGoNext}
                className={cn(
                    'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    canGoNext
                        ? 'text-foreground hover:bg-muted'
                        : 'text-muted-foreground/40 cursor-not-allowed'
                )}
            >
                Próxima
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    )
}

/** Slice an array for the current page */
// eslint-disable-next-line react-refresh/only-export-components
export function paginateArray<T>(items: T[], page: number, pageSize: number): T[] {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
}
