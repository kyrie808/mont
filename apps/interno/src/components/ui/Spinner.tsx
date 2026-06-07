import { Loader2 } from 'lucide-react'

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
    return (
        <Loader2
            className={`animate-spin text-primary ${sizeClasses[size]} ${className}`}
        />
    )
}

interface LoadingScreenProps {
    message?: string
}

export function LoadingScreen({ message = 'Carregando...' }: LoadingScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
            <Spinner size="lg" />
            <p className="text-muted-foreground text-sm">{message}</p>
        </div>
    )
}
