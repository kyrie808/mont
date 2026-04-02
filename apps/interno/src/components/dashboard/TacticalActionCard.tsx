import type { LucideIcon } from 'lucide-react'
import { cn } from '@mont/shared'

interface TacticalActionCardProps {
    title: string
    value: string
    subValue?: string | React.ReactNode
    footerLabel: string
    statusLabel: string
    statusIcon: LucideIcon
    actionLabel: string
    actionIcon: LucideIcon
    onAction: () => void
    variant: 'danger' | 'warning'
    className?: string
}

export function TacticalActionCard({
    title,
    value,
    subValue,
    footerLabel,
    statusLabel,
    statusIcon: StatusIcon,
    actionLabel,
    actionIcon: ActionIcon,
    onAction,
    variant,
    className
}: TacticalActionCardProps) {

    // Variant styles configuration
    const styles = {
        danger: {
            border: 'border-semantic-red',
            text: 'text-semantic-red',
            button: 'bg-primary hover:bg-green-500 text-black shadow-green-500/20',
            bg: 'bg-card'
        },
        warning: {
            border: 'border-semantic-yellow',
            text: 'text-semantic-yellow',
            button: 'bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white',
            bg: 'bg-card'
        }
    }

    const currentStyle = styles[variant]

    return (
        <div className={cn(
            "relative flex overflow-hidden rounded-xl shadow-md border-l-4 transition-transform hover:scale-[1.01]",
            currentStyle.bg,
            currentStyle.border,
            className
        )}>
            <div className="flex flex-1 flex-col justify-between p-4 gap-4">
                {/* Header Side */}
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                            {title}
                        </h3>
                        <div className={cn("flex items-center gap-1 mt-1", currentStyle.text)}>
                            <StatusIcon className="size-4" />
                            <span className="text-xs font-bold uppercase">{statusLabel}</span>
                        </div>
                    </div>
                    {/* Value Side */}
                    <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                        {subValue && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                                {subValue}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action Side */}
                <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {footerLabel}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onAction()
                        }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-colors shadow-lg",
                            currentStyle.button
                        )}
                    >
                        <ActionIcon className="size-[18px]" />
                        {actionLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
