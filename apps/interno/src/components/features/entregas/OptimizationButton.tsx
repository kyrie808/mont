import { Truck, Zap, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@mont/shared'

interface OptimizationButtonProps {
    isLoading: boolean
    selectedCount: number
    onClick: () => void
    disabled: boolean
}

export function OptimizationButton({ isLoading, selectedCount, onClick, disabled }: OptimizationButtonProps) {
    return (
        <Button
            className={cn(
                "w-full h-12 rounded-xl font-bold text-base transition-all",
                isLoading || selectedCount === 0
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    : "bg-semantic-green hover:bg-semantic-green/90 text-white shadow-md hover:shadow-lg"
            )}
            onClick={onClick}
            disabled={disabled || isLoading || selectedCount === 0}
        >
            {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                    <Truck className="w-5 h-5 animate-bounce" />
                    Otimizando rota
                    <Zap className="w-4 h-4 animate-pulse" />
                </span>
            ) : (
                <span className="flex items-center justify-center gap-2">
                    <Navigation className="w-5 h-5" />
                    Gerar Rota Otimizada
                    {selectedCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                            {selectedCount}
                        </span>
                    )}
                </span>
            )}
        </Button>
    )
}
