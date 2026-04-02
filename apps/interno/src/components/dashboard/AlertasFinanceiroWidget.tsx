import { useNavigate } from 'react-router-dom'
import { DollarSign, MessageCircle, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@mont/shared'
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
    const navigate = useNavigate()
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

    if (loading) return <div className="h-40 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />

    if (atrasados.length === 0) {
        return (
            <DashboardCarousel
                title="Contas a Receber"
                icon={DollarSign}
                count={0}
                onViewAll={() => navigate('/vendas?status=atrasado')}
                emptyState={
                    <div className="w-full flex flex-col items-center justify-center p-6 bg-card rounded-xl border border-border border-dashed">
                        <DollarSign className="size-8 text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma pendência urgente</p>
                    </div>
                }
            >
                {null}
            </DashboardCarousel>
        )
    }

    return (
        <DashboardCarousel
            title="Contas a Receber"
            icon={DollarSign}
            count={atrasados.length}
            onViewAll={() => navigate('/vendas?status=atrasado')}
        >
            {atrasados.map((alerta) => (
                <div key={alerta.venda.id} className="min-w-[280px] snap-center">
                    <Card className="h-full bg-card border-l-4 border-l-semantic-red border-y-border hover:border-y-border/80 shadow-sm transition-all">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white truncate max-w-[160px]">
                                        {alerta.venda.contato?.nome || 'Cliente'}
                                    </h3>
                                    <p className="text-xs text-semantic-red font-semibold flex items-center gap-1 mt-0.5">
                                        <AlertTriangle className="size-3" />
                                        {alerta.diasAtraso} dias de atraso
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-lg font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(alerta.venda.total)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 dark:border-gray-800/50">
                                <span className="text-xs text-gray-400">
                                    Vencimento: {formatRelativeDate(alerta.dataPrevista)}
                                </span>
                                <button
                                    onClick={() => handleWhatsApp(
                                        alerta.venda.contato?.telefone || '',
                                        alerta.venda.contato?.nome || '',
                                        alerta.venda.total
                                    )}
                                    className="flex items-center gap-1.5 text-xs font-bold text-semantic-green hover:text-green-600 transition-colors bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full"
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
    )
}
