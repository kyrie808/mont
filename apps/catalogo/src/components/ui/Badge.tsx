import { HTMLAttributes } from 'react'
import { cn } from '@mont/shared'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'congelado' | 'refrigerado' | 'resfriado' | 'combo' | 'destaque'
}

const Badge = ({ className, variant = 'congelado', children, ...props }: BadgeProps) => {
    const variants = {
        congelado: 'bg-blue-50 text-blue-700 border-blue-200',
        refrigerado: 'bg-green-50 text-green-700 border-green-200',
        resfriado: 'bg-green-50 text-green-700 border-green-200',
        combo: 'bg-orange-50 text-orange-700 border-orange-200',
        destaque: 'bg-mont-gold/10 text-mont-gold border-mont-gold/30'
    }

    const labels = {
        congelado: '❄️ Congelado',
        refrigerado: '🧊 Resfriado',
        resfriado: '🧊 Resfriado',
        combo: '📦 Combo',
        destaque: '⭐ Mais Vendido'
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-body border',
                variants[variant],
                className
            )}
            {...props}
        >
            {children || labels[variant]}
        </span>
    )
}

Badge.displayName = 'Badge'

export { Badge }
