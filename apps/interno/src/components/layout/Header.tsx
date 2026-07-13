import { ArrowLeft, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { cn } from '@mont/shared'

interface HeaderProps {
    title: string
    showBack?: boolean
    showMenu?: boolean
    onMenuClick?: () => void
    rightAction?: React.ReactNode
    centerTitle?: boolean
    transparent?: boolean
    className?: string
}

export function Header({
    title,
    showBack = false,
    showMenu = false,
    onMenuClick,
    rightAction,
    centerTitle = false,
    transparent = false,
    className
}: HeaderProps) {
    const navigate = useNavigate()

    return (
        <header className={cn(
            // Desktop: altura fixa (lg:h-16) + px-6 alinhado ao conteúdo (lg:px-6 do PageContainer).
            // Mobile intocado: px-6 py-4 (sagrado).
            "sticky top-0 z-header px-6 py-4 lg:py-0 lg:h-16 flex items-center justify-between transition-all duration-300",
            transparent ? 'bg-transparent' : 'bg-background/95 backdrop-blur-md',
            className
        )}>
            {/* Left Action */}
            <div className="flex items-center z-10">
                {showBack && (
                    <button
                        aria-label="Voltar"
                        className="lg:hidden flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors -ml-2 text-foreground"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                )}

                {showMenu && !showBack && (
                    <button
                        aria-label="Abrir menu"
                        className="lg:hidden flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors -ml-2 text-foreground"
                        onClick={onMenuClick}
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                )}
            </div>

            {/* Title — centralizado no mobile (sagrado), à esquerda no desktop (lg) alinhado à borda do conteúdo (px-6 = content lg:px-6). */}
            <div className={cn(
                "flex-1 flex items-center pointer-events-none px-4 lg:px-0",
                centerTitle
                    ? 'justify-center absolute inset-0 lg:static lg:justify-start'
                    : 'justify-start'
            )}>
                <h1 className={cn(
                    "text-lg font-bold tracking-tight text-foreground",
                    centerTitle ? "text-center lg:text-left" : ""
                )}>
                    {title}
                </h1>
            </div>

            {/* Right Action */}
            <div className="flex items-center gap-2 z-10 shrink-0">
                {rightAction}
            </div>
        </header>
    )
}
