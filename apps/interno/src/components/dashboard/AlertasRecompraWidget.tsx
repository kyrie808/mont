import { useNavigate } from 'react-router-dom'
import { RotateCw, MessageCircle, Eye, ShoppingCart } from 'lucide-react'
import { formatPhone } from '@mont/shared'
import { DashboardCarousel } from './DashboardCarousel'
import { useRecompra } from '@/hooks/useRecompra'
import { Card, CardContent } from '@/components/ui/Card'
import { WidgetSkeleton } from '@/components/ui/WidgetSkeleton'
import { Badge } from '@/components/ui'

interface RecompraAlerta {
    contato_id?: string
    nome?: string
    telefone?: string
    dias_sem_compra?: number
    contato: {
        id: string
        nome: string
        telefone: string
    }
    diasSemCompra: number
    status: string
}

interface AlertasRecompraWidgetProps {
    data?: Array<{
        contato_id: string
        nome: string
        telefone: string
        dias_sem_compra: number
    }>
    loading?: boolean
}

export function AlertasRecompraWidget({ data, loading: externalLoading }: AlertasRecompraWidgetProps) {
    const navigate = useNavigate()
    // Skip hook if data is provided
    const { contatos, loading: internalLoading } = useRecompra(!data)

    const loading = data ? externalLoading : internalLoading
    const rawAlerts = data || contatos

    // Normalize data if it comes from JSON view / different structure
    const alertas: RecompraAlerta[] = data
        ? data.map(a => ({
            contato: { id: a.contato_id, nome: a.nome, telefone: a.telefone },
            diasSemCompra: a.dias_sem_compra,
            status: 'atrasado'
        }))
        : (rawAlerts as RecompraAlerta[]).filter(c => c.status === 'atrasado')

    const handleWhatsApp = (telefone: string, nome: string) => {
        const message = `Olá, ${nome}! Notei que faz um tempinho desde sua última compra. Estamos com promoções especiais hoje!`
        const url = `https://wa.me/55${formatPhone(telefone).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
    }

    if (loading) return <WidgetSkeleton height="h-40" lines={2} />

    if (alertas.length === 0) {
        return (
            <DashboardCarousel
                title="Alertas de Recompra"
                icon={RotateCw}
                count={0}
                onViewAll={() => navigate('/clientes')}
                emptyState={
                    <div className="w-full flex flex-col items-center justify-center p-6 bg-card rounded-xl border border-border border-dashed">
                        <ShoppingCart className="size-8 text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Todos os clientes abastecidos!</p>
                    </div>
                }
            >
                {null}
            </DashboardCarousel>
        )
    }

    return (
        <DashboardCarousel
            title="Alertas de Recompra"
            icon={RotateCw}
            count={alertas.length}
            onViewAll={() => navigate('/clientes')}
        >
            {alertas.map((alerta) => (
                <div key={alerta.contato.id} className="min-w-[260px] snap-center">
                    <Card className="h-full bg-card border-l-4 border-l-warning border-y-border hover:border-y-border/80 shadow-sm transition-all">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <Badge variant="warning" className="mb-1.5 text-[10px] uppercase tracking-wide">
                                        Recompra
                                    </Badge>
                                    <h3 className="font-bold text-gray-900 dark:text-white truncate max-w-[140px]">
                                        {alerta.contato.nome}
                                    </h3>
                                    <Badge variant="warning" className="mt-1 text-[10px]">
                                        {alerta.diasSemCompra} dias sem comprar
                                    </Badge>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <button
                                        aria-label={`Ver perfil de ${alerta.contato.nome}`}
                                        onClick={() => navigate(`/clientes/${alerta.contato.id}`)}
                                        className="size-11 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary transition-colors"
                                    >
                                        <Eye className="size-4" />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => handleWhatsApp(alerta.contato.telefone, alerta.contato.nome)}
                                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-warning hover:bg-warning/90 transition-colors px-3 py-2 rounded-lg"
                            >
                                <MessageCircle className="size-3.5" />
                                Oferecer Recompra
                            </button>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </DashboardCarousel>
    )
}
