import { DollarSign, MessageCircle, AlertTriangle } from 'lucide-react'
import { formatCurrency, cn } from '@mont/shared'
import { DashboardCarousel } from './DashboardCarousel'
import { useAlertasFinanceiros } from '@/hooks/useAlertasFinanceiros'
import { Card, CardContent } from '@/components/ui/Card'
import { formatRelativeDate, formatPhone } from '@mont/shared'
import type { RawFinanceiroAlerta } from '@/services/dashboardService'

interface FinAlerta {
    venda_id?: string
    valor?: number
    contato_nome?: string
    contato_telefone?: string
    vencimento?: string
    status?: string
    venda: {
        id: string
        total: number
        contato: {
            nome: string | null
            telefone: string | null
        } | null
    }
    diasAtraso: number
    dataPrevista: string
}



interface AlertasFinanceiroWidgetProps {
    data?: RawFinanceiroAlerta[]
    loading?: boolean
}

export function AlertasFinanceiroWidget({ data, loading: externalLoading }: AlertasFinanceiroWidgetProps) {
    // Skip hook if data is provided
    const { alertas, loading: internalLoading } = useAlertasFinanceiros(!data)

    const loading = data ? externalLoading : internalLoading
    const rawAlerts = data || alertas

    // Normalize data if it comes from JSON view
    const atrasados: FinAlerta[] = data
        ? data.map((v: RawFinanceiroAlerta) => ({
            venda: { id: v.venda_id, total: v.valor, contato: { nome: v.contato_nome, telefone: v.contato_telefone } },
            diasAtraso: Math.floor((new Date().getTime() - new Date(v.vencimento).getTime()) / (1000 * 60 * 60 * 24)),
            dataPrevista: v.vencimento
        }))
        : (rawAlerts as FinAlerta[]).filter(a => a.status === 'atrasado')

    const handleWhatsApp = (telefone: string, nome: string, valor: number) => {
        const message = `Olá ${nome}, tudo bem? Estou entrando em contato referente ao valor de ${formatCurrency(valor)} que está em aberto.`
        const url = `https://wa.me/55${formatPhone(telefone).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
    }

    if (loading) return <div className="h-40 animate-pulse bg-muted rounded-xl" />

    if (atrasados.length === 0) {
        const empty = (
            <div className="w-full flex flex-col items-center justify-center p-6 bg-card rounded-xl border border-border border-dashed">
                <DollarSign className="size-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma pendência urgente</p>
            </div>
        )
        return (
            <>
                {/* Mobile: carousel atual (congelado) */}
                <div className="lg:hidden">
                    <DashboardCarousel title="Contas a Receber" icon={DollarSign} count={0} emptyState={empty}>
                        {null}
                    </DashboardCarousel>
                </div>
                {/* Desktop */}
                <div className="hidden lg:flex lg:flex-col lg:gap-3">
                    <div className="flex items-center gap-2 px-1">
                        <DollarSign className="size-4 text-muted-foreground" />
                        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Contas a Receber</h2>
                    </div>
                    {empty}
                </div>
            </>
        )
    }

    return (
        <>
        {/* Mobile: carousel atual (congelado) */}
        <div className="lg:hidden">
        <DashboardCarousel
            title="Contas a Receber"
            icon={DollarSign}
            count={atrasados.length}
        >
            {atrasados.map((alerta) => (
                <div key={alerta.venda.id} className="min-w-[280px] snap-center">
                    <Card className="h-full bg-card border-l-4 border-l-semantic-red border-y-border hover:border-y-border/80 shadow-card transition-all">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-foreground truncate max-w-[160px]">
                                        {alerta.venda.contato?.nome || 'Cliente'}
                                    </h3>
                                    <p className="text-xs text-semantic-red font-semibold flex items-center gap-1 mt-0.5">
                                        <AlertTriangle className="size-3" />
                                        {alerta.diasAtraso} dias de atraso
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-lg font-bold text-foreground">
                                        {formatCurrency(alerta.venda.total)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                <span className="text-xs text-muted-foreground">
                                    Vencimento: {formatRelativeDate(alerta.dataPrevista)}
                                </span>
                                <button
                                    onClick={() => handleWhatsApp(
                                        alerta.venda.contato?.telefone || '',
                                        alerta.venda.contato?.nome || '',
                                        alerta.venda.total
                                    )}
                                    className="flex items-center gap-1.5 text-xs font-bold text-semantic-green hover:text-success transition-colors bg-success/10 px-3 py-1.5 rounded-full"
                                >
                                    <MessageCircle className="size-3.5" />
                                    Cobrar
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </DashboardCarousel>
        </div>

        {/* Desktop: lista vertical tokenizada — cor escala pela gravidade */}
        <div className="hidden lg:flex lg:flex-col lg:gap-3">
            <div className="flex items-center gap-2 px-1">
                <DollarSign className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Contas a Receber</h2>
                <span className="ml-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning-strong">{atrasados.length}</span>
            </div>
            <div className="flex flex-col gap-2">
                {atrasados.map((alerta) => {
                    const severe = alerta.diasAtraso > 7
                    return (
                        <div key={alerta.venda.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className={cn('size-2 shrink-0 rounded-full', severe ? 'bg-destructive' : 'bg-warning-strong')} />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-foreground">{alerta.venda.contato?.nome || 'Cliente'}</p>
                                    <p className={cn('text-xs font-semibold', severe ? 'text-destructive' : 'text-warning-strong')}>
                                        {alerta.diasAtraso} dias de atraso
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(alerta.venda.total)}</span>
                                <button
                                    onClick={() => handleWhatsApp(alerta.venda.contato?.telefone || '', alerta.venda.contato?.nome || '', alerta.venda.total)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                >
                                    <MessageCircle className="size-3.5" /> Cobrar
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
        </>
    )
}
