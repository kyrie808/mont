import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Lock } from 'lucide-react'
import { cn } from '@mont/shared'
import { useToast } from '../ui/Toast'
import { NAV_GROUPS, NOVA_VENDA_PATH } from './navConfig'

/**
 * Sidebar persistente de desktop (≥lg). Reusa a fonte única de navegação (navConfig)
 * que o NavigationDrawer (mobile) também consome. Fica escondida no mobile.
 */
export function SidebarNav() {
    const navigate = useNavigate()
    const location = useLocation()
    const toast = useToast()

    const isActive = (path: string) =>
        path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

    return (
        <aside className="hidden lg:flex sticky top-0 h-dvh w-64 shrink-0 flex-col border-r border-border bg-card">
            {/* Marca */}
            <div className="flex h-16 items-center gap-3 px-6 border-b border-border shrink-0">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-card">
                    M
                </div>
                <div className="leading-tight">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mont</p>
                    <p className="text-sm font-black tracking-tight text-foreground">Distribuidora</p>
                </div>
            </div>

            {/* CTA Nova Venda */}
            <div className="px-3 pt-4">
                <button
                    onClick={() => navigate(NOVA_VENDA_PATH)}
                    className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5',
                        'bg-primary text-primary-foreground font-bold text-sm',
                        'shadow-card transition-transform active:scale-[0.98] hover:brightness-105',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                    )}
                >
                    <Plus className="size-4" />
                    Nova Venda
                </button>
            </div>

            {/* Navegação */}
            <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-5">
                {NAV_GROUPS.map((group) => {
                    const items = group.items.filter((item) => item.path !== NOVA_VENDA_PATH)
                    if (items.length === 0) return null
                    return (
                        <div key={group.label}>
                            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                {group.label}
                            </p>
                            <div className="space-y-0.5">
                                {items.map((item) => {
                                    const Icon = item.icon
                                    const active = !item.locked && isActive(item.path)
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={
                                                item.locked
                                                    ? () => toast.info('Recurso disponível em breve')
                                                    : () => navigate(item.path)
                                            }
                                            className={cn(
                                                'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                active
                                                    ? 'bg-primary/10 text-foreground'
                                                    : item.locked
                                                        ? 'text-muted-foreground/50 cursor-not-allowed'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            {/* barra de acento neon no item ativo */}
                                            <span
                                                className={cn(
                                                    'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity',
                                                    active ? 'opacity-100' : 'opacity-0',
                                                )}
                                            />
                                            <Icon className={cn('size-[18px] shrink-0', active && 'text-primary')} />
                                            <span className="flex-1 text-left">{item.label}</span>
                                            {item.locked && <Lock className="size-3 shrink-0" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </nav>
        </aside>
    )
}
