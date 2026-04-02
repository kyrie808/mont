import { useNavigate } from 'react-router-dom'
import { Receipt, AlertTriangle, Clock, CalendarDays } from 'lucide-react'
import { formatCurrency, formatDate } from '@mont/shared'
import { DashboardCarousel } from './DashboardCarousel'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@mont/shared'

interface VencimentoItem {
    conta_a_pagar_id: string
    credor: string
    descricao: string
    saldo_devedor: number
    data_vencimento: string
    situacao: string
    dias_atraso: number
    parcela_atual: number | null
    total_parcelas: number | null
}

const SITUACAO_CONFIG: Record<string, { borderColor: string; badgeClass: string; label: string; icon: typeof AlertTriangle }> = {
    vencido: {
        borderColor: 'border-l-destructive',
        badgeClass: 'bg-destructive/10 text-destructive',
        label: 'Vencido',
        icon: AlertTriangle,
    },
    vence_hoje: {
        borderColor: 'border-l-warning',
        badgeClass: 'bg-warning/10 text-warning',
        label: 'Vence hoje',
        icon: Clock,
    },
    proximos_7_dias: {
        borderColor: 'border-l-primary',
        badgeClass: 'bg-primary/10 text-primary',
        label: 'Próx. 7 dias',
        icon: CalendarDays,
    },
    proximos_30_dias: {
        borderColor: 'border-l-muted-foreground',
        badgeClass: 'bg-muted text-muted-foreground',
        label: 'Próx. 30 dias',
        icon: CalendarDays,
    },
}

interface AlertasContasAPagarWidgetProps {
    data?: VencimentoItem[]
    loading?: boolean
}

export function AlertasContasAPagarWidget({ data = [], loading }: AlertasContasAPagarWidgetProps) {
    const navigate = useNavigate()

    if (loading) return <div className="h-40 animate-pulse bg-muted rounded-xl" />

    if (data.length === 0) {
        return (
            <DashboardCarousel
                title="Contas a Pagar"
                icon={Receipt}
                count={0}
                onViewAll={() => navigate('/contas-a-pagar')}
                emptyState={
                    <div className="w-full flex flex-col items-center justify-center p-6 bg-card rounded-xl border border-border border-dashed">
                        <Receipt className="size-8 text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhuma conta próxima do vencimento</p>
                    </div>
                }
            >
                {null}
            </DashboardCarousel>
        )
    }

    return (
        <DashboardCarousel
            title="Contas a Pagar"
            icon={Receipt}
            count={data.length}
            onViewAll={() => navigate('/contas-a-pagar')}
        >
            {data.map((item) => {
                const config = SITUACAO_CONFIG[item.situacao] || SITUACAO_CONFIG.proximos_7_dias
                const StatusIcon = config.icon

                return (
                    <div
                        key={item.conta_a_pagar_id}
                        className="min-w-[280px] snap-center cursor-pointer"
                        onClick={() => navigate('/contas-a-pagar')}
                    >
                        <Card className={cn("h-full bg-card border-l-4 border-y-border hover:border-y-border/80 shadow-sm transition-all", config.borderColor)}>
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="min-w-0 flex-1 mr-3">
                                        <h3 className="font-bold text-foreground truncate">
                                            {item.credor}
                                        </h3>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {item.descricao}
                                            {item.total_parcelas && item.total_parcelas > 1 && (
                                                <span className="ml-1">({item.parcela_atual}/{item.total_parcelas})</span>
                                            )}
                                        </p>
                                    </div>
                                    <span className="text-base font-bold text-foreground whitespace-nowrap">
                                        {formatCurrency(item.saldo_devedor)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                    <span className="text-xs text-muted-foreground">
                                        Vencimento: {formatDate(item.data_vencimento)}
                                    </span>
                                    <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full", config.badgeClass)}>
                                        <StatusIcon className="size-3" />
                                        {config.label}
                                        {item.situacao === 'vencido' && item.dias_atraso > 0 && ` (${item.dias_atraso}d)`}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            })}
        </DashboardCarousel>
    )
}
