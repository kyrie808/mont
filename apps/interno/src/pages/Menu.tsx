import { useNavigate } from 'react-router-dom'
import {
    Truck,
    Package,
    Bell,
    Trophy,
    Settings,
    ClipboardList,
    Refrigerator,
    Unlink,
    DollarSign,
    CalendarClock
} from 'lucide-react'
import { PageContainer } from '../components/layout/PageContainer'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui'
import { ENABLE_GELADEIRA, ENABLE_RECOMPRA } from '../constants/flags'

export function Menu() {
    const navigate = useNavigate()

    const menuItems = [
        {
            title: 'Entregas',
            icon: Truck,
            iconColor: 'text-primary',
            iconBg: 'bg-primary/10',
            href: '/entregas',
            visible: true
        },
        {
            title: 'Estoque / Geladeira',
            icon: Refrigerator,
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-500/10',
            href: '/estoque',
            visible: ENABLE_GELADEIRA
        },
        {
            title: 'Pedidos Compra',
            icon: Package,
            iconColor: 'text-accent',
            iconBg: 'bg-accent/10',
            href: '/pedidos-compra',
            visible: true
        },
        {
            title: 'Recompra',
            icon: Bell,
            iconColor: 'text-red-600 dark:text-red-400',
            iconBg: 'bg-red-500/10',
            href: '/recompra',
            visible: ENABLE_RECOMPRA
        },
        {
            title: 'Ranking',
            icon: Trophy,
            iconColor: 'text-semantic-yellow',
            iconBg: 'bg-semantic-yellow/10',
            href: '/ranking',
            visible: true
        },
        {
            title: 'Produtos',
            icon: Package,
            iconColor: 'text-violet-600 dark:text-violet-400',
            iconBg: 'bg-violet-500/10',
            href: '/produtos',
            visible: true
        },
        {
            title: 'Relatório Fábrica',
            icon: ClipboardList,
            iconColor: 'text-muted-foreground',
            iconBg: 'bg-muted',
            href: '/relatorio-fabrica',
            visible: true
        },
        {
            title: 'Pendentes Catálogo',
            icon: Unlink,
            iconColor: 'text-red-500',
            iconBg: 'bg-red-500/10',
            href: '/catalogo-pendentes',
            visible: true
        },
        {
            title: 'Fluxo de Caixa',
            icon: DollarSign,
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-500/10',
            href: '/fluxo-caixa',
            visible: true
        },
        {
            title: 'Contas a Receber',
            icon: CalendarClock,
            iconColor: 'text-orange-600',
            iconBg: 'bg-orange-500/10',
            href: '/contas-a-receber',
            visible: true
        },
        {
            title: 'Configurações',
            icon: Settings,
            iconColor: 'text-muted-foreground',
            iconBg: 'bg-muted',
            href: '/configuracoes',
            visible: true
        }
    ]

    return (
        <>
            <Header title="Menu" showBack centerTitle />
                <PageContainer className="pt-0 pb-24 bg-transparent px-4">
                    <div className="grid grid-cols-2 gap-4 pb-20">
                        {menuItems.filter(item => item.visible).map((item) => {
                            const IconComponent = item.icon

                            return (
                                <Card
                                    key={item.href}
                                    hover
                                    onClick={() => navigate(item.href)}
                                    className="cursor-pointer active:scale-95 transition-all"
                                >
                                    <div className="p-6 flex flex-col items-center gap-3">
                                        <div className={`p-3 rounded-full ${item.iconBg}`}>
                                            <IconComponent className={`h-8 w-8 ${item.iconColor}`} />
                                        </div>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-center text-sm">
                                            {item.title}
                                        </span>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </PageContainer>
        </>
    )
}
