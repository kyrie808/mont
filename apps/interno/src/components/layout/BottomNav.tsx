import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, ShoppingCart, Package, Plus, type LucideIcon } from 'lucide-react'
import { cn } from '@mont/shared'

export function BottomNav() {
    const navigate = useNavigate()
    const location = useLocation()

    const isActive = (path: string) => location.pathname === path

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
            <div className="flex items-end justify-between px-2 pb-2 h-16">

                {/* Dashboard */}
                <NavButton
                    active={isActive('/')}
                    onClick={() => navigate('/')}
                    icon={LayoutDashboard}
                    label="Início"
                />

                {/* Clientes */}
                <NavButton
                    active={isActive('/contatos')}
                    onClick={() => navigate('/contatos')}
                    icon={Users}
                    label="Clientes"
                />

                {/* NOVA VENDA (FAB) */}
                <div className="relative -top-5 mx-2">
                    <button
                        onClick={() => navigate('/nova-venda')}
                        className="
                            flex items-center justify-center 
                            w-14 h-14 rounded-full 
                            bg-primary text-primary-foreground 
                            shadow-lg shadow-primary/30
                            border-4 border-gray-50
                            transform transition-transform active:scale-95
                        "
                        aria-label="Nova Venda"
                    >
                        <Plus className="h-7 w-7" />
                    </button>
                </div>

                {/* Vendas */}
                <NavButton
                    active={isActive('/vendas')}
                    onClick={() => navigate('/vendas')}
                    icon={ShoppingCart}
                    label="Vendas"
                />

                {/* Produtos */}
                <NavButton
                    active={isActive('/produtos')}
                    onClick={() => navigate('/produtos')}
                    icon={Package}
                    label="Produtos"
                />
            </div>
        </nav>
    )
}

interface NavButtonProps {
    active: boolean
    onClick: () => void
    icon: LucideIcon
    label: string
}

function NavButton({ active, onClick, icon: Icon, label }: NavButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-1 rounded-lg transition-colors",
                "h-14 min-w-[3.5rem]", // Touch target
                active ? "text-primary" : "text-muted-foreground hover:bg-muted"
            )}
        >
            <Icon
                className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")}
                style={active ? { fill: 'currentColor', fillOpacity: 0.2 } as React.CSSProperties : undefined}
            />
            <span className="text-[10px] font-medium leading-none">
                {label}
            </span>
        </button>
    )
}
