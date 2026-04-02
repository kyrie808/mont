
import { type LucideIcon } from 'lucide-react'

interface DashboardCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    description?: string
    trend?: 'up' | 'down' | 'neutral'
    color?: 'default' | 'gold' | 'danger'
}

export default function DashboardCard({
    title,
    value,
    icon: Icon,
    description,
    color = 'default'
}: DashboardCardProps) {

    const colorStyles = {
        default: 'border-gray-200 bg-white',
        gold: 'border-mont-gold/30 bg-yellow-50',
        danger: 'border-red-200 bg-red-50'
    }

    const iconColors = {
        default: 'text-mont-espresso',
        gold: 'text-mont-gold',
        danger: 'text-red-500'
    }

    return (
        <div className={`rounded-xl border p-4 shadow-sm ${colorStyles[color]}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-mont-gray uppercase tracking-wider">
                    {title}
                </span>
                <Icon className={`${iconColors[color]}`} size={20} />
            </div>
            <div className="flex flex-col">
                <span className="text-2xl font-mono font-bold text-mont-espresso">
                    {value}
                </span>
                {description && (
                    <span className="text-xs text-gray-500 mt-1">
                        {description}
                    </span>
                )}
            </div>
        </div>
    )
}
