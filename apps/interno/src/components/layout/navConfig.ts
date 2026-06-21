import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    Truck,
    Trophy,
    RefreshCw,
    Package,
    Snowflake,
    ClipboardList,
    LayoutList,
    Wallet,
    CreditCard,
    Receipt,
    Settings,
    BarChart3,
    Plus,
    type LucideIcon,
} from 'lucide-react'

/** path da ação "Nova Venda" — a SidebarNav promove esse item a botão CTA (não duplica na lista). */
export const NOVA_VENDA_PATH = '/nova-venda'

export interface NavItem {
    label: string
    path: string
    icon: LucideIcon
    locked?: boolean
}

export interface NavGroup {
    label: string
    items: NavItem[]
}

/** Fonte única da navegação — usada pelo NavigationDrawer (mobile) e pela SidebarNav (desktop). */
export const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Operações',
        items: [
            { label: 'Início',      path: '/',                 icon: LayoutDashboard },
            { label: 'Clientes',    path: '/contatos',         icon: Users },
            { label: 'Nova Venda',  path: NOVA_VENDA_PATH,     icon: Plus },
            { label: 'Vendas',      path: '/vendas',           icon: ShoppingCart },
            { label: 'Entregas',    path: '/entregas',         icon: Truck, locked: true },
        ],
    },
    {
        label: 'Gestão',
        items: [
            { label: 'Ranking',           path: '/ranking',        icon: Trophy },
            { label: 'Relatórios',        path: '/relatorios',     icon: BarChart3 },
            { label: 'Relacionamento',    path: '/relacionamento', icon: RefreshCw },
            { label: 'Estoque',           path: '/estoque',        icon: Snowflake },
            { label: 'Produtos',          path: '/produtos',       icon: Package },
            { label: 'Catálogo',          path: '/catalogo',       icon: LayoutList },
            { label: 'Pedidos de Compra', path: '/pedidos-compra', icon: ClipboardList },
        ],
    },
    {
        label: 'Financeiro',
        items: [
            { label: 'Fluxo de Caixa',    path: '/fluxo-caixa',       icon: Wallet },
            { label: 'Contas a Receber',  path: '/contas-a-receber',  icon: CreditCard, locked: true },
            { label: 'Despesas',          path: '/contas-a-pagar',    icon: Receipt },
        ],
    },
    {
        label: 'Sistema',
        items: [
            { label: 'Configurações', path: '/configuracoes', icon: Settings },
        ],
    },
]
