import type { LucideIcon } from 'lucide-react'

export interface StoryFilterItem {
    id: string
    label: string
    icon: LucideIcon
    count?: number
    color?: 'primary' | 'purple' | 'success' | 'warning' | 'danger' | 'info'
}

interface StoryFilterProps {
    items: StoryFilterItem[]
    activeId: string
    onSelect: (id: string) => void
    size?: 'sm' | 'md' | 'lg'
}

export function StoryFilter({ items, activeId, onSelect, size = 'md' }: StoryFilterProps) {
    const sizeClasses = {
        sm: { outer: 'w-[48px] h-[48px]', icon: 'w-5 h-5' },
        md: { outer: 'w-[68px] h-[68px]', icon: 'w-8 h-8' },
        lg: { outer: 'w-[80px] h-[80px]', icon: 'w-10 h-10' },
    }

    const { outer, icon } = sizeClasses[size]

    return (
        <div className="w-full overflow-x-auto pb-4 pt-2 px-1 hide-scrollbar -mx-4 md:mx-0">
            <div className="flex gap-4 px-4 md:px-0 min-w-max md:min-w-0 md:justify-center after:content-[''] after:min-w-[16px] after:shrink-0 md:after:hidden">
                {items.map((item) => {
                    const isActive = activeId === item.id
                    // Default to 'purple' if not specified to match previous default style unless overridden
                    const color = item.color || 'primary'

                    // Theme-aware color maps
                    const colorStyles: Record<string, string> = {
                        primary: 'from-primary/80 to-primary border-primary shadow-[0_0_15px_rgba(19,236,19,0.4)]', // System Neon Green
                        purple: 'from-violet-600 to-fuchsia-600 border-violet-500',
                        success: 'from-emerald-500 to-teal-500 border-emerald-500',
                        warning: 'from-orange-500 to-amber-500 border-orange-500',
                        danger: 'from-red-500 to-pink-600 border-red-500',
                        info: 'from-cyan-500 to-blue-500 border-cyan-500',
                    }

                    const activeColorClass = colorStyles[color] || colorStyles.primary

                    // Selection State Styling
                    const isSelectedStyle = isActive
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110 shadow-[0_0_20px_rgba(19,236,19,0.3)]'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'

                    return (
                        <button
                            key={item.id}
                            onClick={() => onSelect(item.id)}
                            className="flex flex-col items-center gap-2 group transition-all duration-300 outline-none"
                        >
                            {/* Gradient Border Ring Wrapper */}
                            <div className={`
                                relative rounded-full p-[2px] 
                                bg-gradient-to-tr ${activeColorClass}
                                shadow-lg transition-all duration-300
                                ${outer}
                                ${isSelectedStyle}
                            `}>
                                {/* Inner Surface */}
                                <div className={`w-full h-full rounded-full flex items-center justify-center border-2 border-transparent relative overflow-hidden transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-card'
                                    }`}>
                                    {/* Inner Glow/Gradient */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${activeColorClass} opacity-10 dark:opacity-20`} />

                                    <item.icon className={`
                                        ${icon} z-10 relative transition-colors
                                        ${isActive ? 'text-primary-foreground' : 'text-zinc-700 dark:text-white'}
                                    `} strokeWidth={1.5} />
                                </div>

                                {item.count !== undefined && (
                                    <div className={`
                                        absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm z-20 transition-colors
                                        ${isActive
                                            ? 'bg-primary text-primary-foreground border-primary-foreground/20'
                                            : 'bg-card text-muted-foreground border-border'
                                        }
                                    `}>
                                        {item.count}
                                    </div>
                                )}
                            </div>

                            {/* Label */}
                            <span className={`text-xs font-medium tracking-wide transition-colors ${isActive ? 'text-primary font-bold' : 'text-muted-foreground'
                                }`}>
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
