import type { ReactNode } from 'react'
import { cn } from '@mont/shared'

interface PageContainerProps {
    children: ReactNode
    className?: string
    noPadding?: boolean
}

export function PageContainer({
    children,
    className = '',
    noPadding = false,
}: PageContainerProps) {
    return (
        <main
            className={cn(
                "flex-1 min-h-dvh",
                "pb-24",
                // Padding lateral único do desktop (lg:px-6). Mobile segue px-4 (intocado).
                noPadding ? '' : 'px-4 lg:px-6',
                className
            )}
        >
            {children}
        </main>
    )
}
