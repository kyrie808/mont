import { Truck, Clock, Wallet, User } from 'lucide-react'

export type Tab = 'entregas' | 'historico' | 'ganhos' | 'perfil'

const TABS = [
    { id: 'entregas', label: 'Entregas', icon: Truck },
    { id: 'historico', label: 'Histórico', icon: Clock },
    { id: 'ganhos', label: 'Ganhos', icon: Wallet },
    { id: 'perfil', label: 'Perfil', icon: User },
] as const

interface TabBarProps {
    active: Tab
    onChange: (t: Tab) => void
}

export function TabBar({ active, onChange }: TabBarProps) {
    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="mx-auto grid max-w-md grid-cols-4">
                {TABS.map((t) => {
                    const Icon = t.icon
                    const on = active === t.id
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => onChange(t.id)}
                            aria-current={on ? 'page' : undefined}
                            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold active:scale-95 ${on ? 'text-emerald-600' : 'text-slate-400'}`}
                        >
                            <Icon className="h-5 w-5" />
                            {t.label}
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}
