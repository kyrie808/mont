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
            "sticky top-0 z-header px-6 py-4 h-auto flex items-center justify-between transition-all duration-300",
            transparent ? 'bg-transparent' : 'bg-background/95 backdrop-blur-md',
            className
        )}>
            {/* Left Action */}
            <div className="flex items-center z-10">
                {showBack && (
                    <button
                        aria-label="Voltar"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors -ml-2 text-foreground"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                )}

                {showMenu && !showBack && (
                    <button
                        aria-label="Abrir menu"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors -ml-2 text-foreground"
                        onClick={onMenuClick}
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                )}
            </div>

            {/* Title */}
            <div className={cn(
                "flex-1 flex pointer-events-none px-4",
                centerTitle ? 'justify-center items-center absolute inset-0' : 'justify-start'
            )}>
                <h1 className={cn(
                    "text-lg font-bold tracking-tight text-foreground",
                    centerTitle ? "text-center" : ""
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
