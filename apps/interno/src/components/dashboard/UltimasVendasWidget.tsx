import { ShoppingCart, Clock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDashboardFilter } from '@/hooks/useDashboardFilter'
import { Card, CardContent } from '@/components/ui/Card'
import { useVendas } from '@/hooks/useVendas'
import { formatCurrency, formatRelativeDate } from '@mont/shared'
import { cn } from '@mont/shared'
import type { VendaAlerta } from '@/services/dashboardService'



interface UltimasVendasWidgetProps {
    data?: VendaAlerta[]
    loading?: boolean
}

export function UltimasVendasWidget({ data, loading: externalLoading }: UltimasVendasWidgetProps) {
    const { startDate, endDate } = useDashboardFilter()
    // Skip internal query if data is provided
    const { vendas, loading: internalLoading } = useVendas({ startDate, endDate, enabled: !data })
    const navigate = useNavigate()

    const loading = data ? externalLoading : internalLoading
    const rawVendas = data || vendas

    // Normalize data if it comes from JSON view
    const latestSales: VendaAlerta[] = data
        ? data.map(v => ({
            id: v.id,
            total: v.total,
            status: v.status,
            pago: v.pago,
            data: v.data,
            contato: v.contato
        }))
        : (rawVendas as VendaAlerta[]).slice(0, 5)

    if (loading) return <div className="h-[300px] animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />

    if (latestSales.length === 0) return null

    return (
        <div className="flex flex-col gap-3 mt-8">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="size-4 text-primary" />
                    <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                        Últimas Vendas
                    </h2>
                </div>
                <button
                    onClick={() => navigate('/vendas')}
                    className="text-xs font-medium text-primary hover:text-green-600 transition-colors flex items-center gap-1"
                >
                    Ver todas
                    <ArrowRight className="size-3" />
                </button>
            </div>

            <div className="flex flex-col gap-2">
                {latestSales.map((venda) => (
                    <Card
                        key={venda.id}
                        className="group overflow-hidden border-0 shadow-card hover:shadow-elevated transition-all duration-300 bg-card"
                    >
                        <CardContent className="p-4 flex items-center justify-between relative">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "size-2 rounded-full",
                                    venda.status === 'entregue' ? "bg-semantic-green shadow-card" :
                                        venda.status === 'cancelada' ? "bg-semantic-red" : "bg-semantic-yellow"
                                )} />

                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-none mb-1 group-hover:text-primary transition-colors">
                                        {venda.contato?.nome || 'Cliente não identificado'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {formatRelativeDate(venda.data)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {!venda.pago && venda.status !== 'cancelada' && (
                                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-800">
                                        <Clock className="size-3" />
                                        Não pago
                                    </span>
                                )}

                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(venda.total)}
                                </span>
                            </div>

                            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-primary to-green-400 group-hover:w-full transition-all duration-500 ease-out" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
