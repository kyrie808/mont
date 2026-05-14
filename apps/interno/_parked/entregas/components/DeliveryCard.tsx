import { MapPin, DollarSign, AlertCircle, Check } from 'lucide-react'
import { cn } from '@mont/shared'

interface DeliveryCardProps {
    id: string
    cliente: string
    endereco: string
    bairro: string | null
    total: number
    isSelected: boolean
    hasAddress: boolean
    onToggle: (id: string) => void
}

export function DeliveryCard({
    id,
    cliente,
    endereco,
    bairro,
    total,
    isSelected,
    hasAddress,
    onToggle
}: DeliveryCardProps) {
    // Generate avatar color from client name
    const getAvatarColor = (name: string) => {
        // Cores de avatar intencionais: distinção visual por hash do nome — não substituir por tokens semânticos
        const colors = [
            'bg-blue-500',
            'bg-violet-500',
            'bg-emerald-500',
            'bg-orange-500',
            'bg-pink-500',
            'bg-cyan-500'
        ]
        const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        return colors[hash % colors.length]
    }

    const initials = cliente
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()

    return (
        <div
            role="checkbox"
            aria-checked={isSelected}
            onClick={() => onToggle(id)}
            className={cn(
                "relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                isSelected
                    ? "border-semantic-green shadow-md bg-semantic-green/5"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm bg-card"
            )}
        >
            <div className="flex items-start gap-3">
                {/* Checkbox — min 44px hit area via card, visual size w-7 h-7 */}
                <div className={cn(
                    "w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5",
                    isSelected ? "bg-semantic-green border-semantic-green" : "border-gray-300 dark:border-gray-600"
                )}>
                    {isSelected && (
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    )}
                </div>

                {/* Avatar */}
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0", getAvatarColor(cliente))}>
                    {initials}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{cliente}</h4>
                        <div className="flex items-center gap-1 text-semantic-green font-bold text-sm flex-shrink-0">
                            <DollarSign className="w-3.5 h-3.5" />
                            {total.toFixed(2)}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        {bairro && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                                {bairro}
                            </span>
                        )}
                        {!hasAddress && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning/10 text-warning text-xs font-medium">
                                <AlertCircle className="w-3 h-3" />
                                Sem endereço
                            </span>
                        )}
                    </div>

                    {endereco && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {endereco}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
