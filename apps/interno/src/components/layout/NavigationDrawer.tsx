import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    LayoutDashboard,
    Users,
    ShoppingCart,
    Truck,
    Trophy,
    RefreshCw,
    Package,
    Snowflake,
    ClipboardList,
    FileText,
    Wallet,
    CreditCard,
    Receipt,
    Settings,
    Plus,
    BookMarked,
} from 'lucide-react'
import { cn } from '@mont/shared'

interface NavigationDrawerProps {
    isOpen: boolean
    onClose: () => void
}

const NAV_GROUPS = [
    {
        label: 'Operações',
        items: [
            { label: 'Início',      path: '/',             icon: LayoutDashboard },
            { label: 'Clientes',    path: '/contatos',     icon: Users           },
            { label: 'Nova Venda',  path: '/nova-venda',   icon: Plus            },
            { label: 'Vendas',      path: '/vendas',       icon: ShoppingCart    },
            { label: 'Entregas',    path: '/entregas',     icon: Truck           },
        ],
    },
    {
        label: 'Gestão',
        items: [
            { label: 'Ranking',            path: '/ranking',          icon: Trophy       },
            { label: 'Recompra',           path: '/recompra',         icon: RefreshCw    },
            { label: 'Estoque',            path: '/estoque',          icon: Snowflake    },
            { label: 'Produtos',           path: '/produtos',         icon: Package      },
            { label: 'Pedidos de Compra',  path: '/pedidos-compra',   icon: ClipboardList},
        ],
    },
    {
        label: 'Financeiro',
        items: [
            { label: 'Fluxo de Caixa',     path: '/fluxo-caixa',        icon: Wallet     },
            { label: 'Contas a Receber',   path: '/contas-a-receber',   icon: CreditCard },
            { label: 'Contas a Pagar',     path: '/contas-a-pagar',     icon: Receipt    },
            { label: 'Relatório Fábrica',  path: '/relatorio-fabrica',  icon: FileText   },
            { label: 'Plano de Contas',    path: '/plano-de-contas',    icon: BookMarked },
        ],
    },
    {
        label: 'Sistema',
        items: [
            { label: 'Configurações', path: '/configuracoes', icon: Settings },
        ],
    },
]

export function NavigationDrawer({ isOpen, onClose }: NavigationDrawerProps) {
    const navigate = useNavigate()
    const location = useLocation()

    const handleNavigate = (path: string) => {
        navigate(path)
        onClose()
    }

    const drawerContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 w-screen h-screen z-[9998] bg-black/50 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Drawer panel */}
                    <motion.aside
                        className="fixed left-0 top-0 z-[9999] flex h-full w-72 flex-col bg-card shadow-modal overflow-hidden"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        {/* Brand header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mont</p>
                                <p className="text-base font-black tracking-tight text-foreground">Distribuidora</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex size-9 items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Nav groups */}
                        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
                            {NAV_GROUPS.map((group) => (
                                <div key={group.label}>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1">
                                        {group.label}
                                    </p>
                                    <div className="space-y-0.5">
                                        {group.items.map((item) => {
                                            const Icon = item.icon
                                            const isActive = location.pathname === item.path
                                            return (
                                                <button
                                                    key={item.path}
                                                    onClick={() => handleNavigate(item.path)}
                                                    className={cn(
                                                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                                        isActive
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'text-foreground hover:bg-muted'
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4 shrink-0" />
                                                    {item.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </nav>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    )

    return createPortal(drawerContent, document.body)
}
