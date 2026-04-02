import { useNavigate } from 'react-router-dom'
import { Calendar, DollarSign, Monitor, Truck, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardContent, CardFooter, Button } from '../../../components/ui'
import { formatDate, formatCurrency } from '@mont/shared'
import { FORMA_PAGAMENTO_LABELS } from '../../../constants'
import { cn } from '@mont/shared'

import type { DomainVenda } from '../../../types/domain'

interface VendaCardProps {
    venda: DomainVenda
    onDeleteClick: (id: string) => void
}

export function VendaCard({ venda, onDeleteClick }: VendaCardProps) {
    const navigate = useNavigate()

    return (
        <Card
            className="group active:scale-[0.99] transition-all duration-200 overflow-hidden cursor-pointer hover:shadow-lg border-l-4 border-l-transparent hover:border-l-primary"
            onClick={() => navigate(`/vendas/${venda.id}`)}
        >
            <CardHeader className="pb-2 p-5">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 leading-tight truncate">
                            {venda.contato?.nome || 'Cliente Não Identificado'}
                        </h3>
                        <span className="text-xs text-muted-foreground font-mono mt-1 block">
                            #{venda.id.slice(0, 8)}
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        {/* Delivery Status */}
                        <div className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border shadow-sm",
                            venda.status === 'entregue'
                                ? "bg-success/10 text-success-foreground border-success/20 dark:bg-success/20 dark:text-success dark:border-success/30"
                                : "bg-warning/10 text-yellow-700 border-warning/20 dark:bg-warning/20 dark:text-warning dark:border-warning/30"
                        )}>
                            <Truck className="h-3.5 w-3.5" />
                            <span>{venda.status === 'entregue' ? 'Entregue' : 'Entrega Pendente'}</span>
                        </div>

                        {/* Payment Status */}
                        <div className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border shadow-sm",
                            (venda.pago || venda.valorPago >= venda.total)
                                ? "bg-success/10 text-success-foreground border-success/20 dark:bg-success/20 dark:text-success dark:border-success/30"
                                : "bg-warning/10 text-yellow-700 border-warning/20 dark:bg-warning/20 dark:text-warning dark:border-warning/30"
                        )}>
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>{(venda.pago || venda.valorPago >= venda.total) ? 'Pago' : 'Pagamento Pendente'}</span>
                        </div>

                        {/* Origin Badge */}
                        {venda.origem === 'catalogo' && (
                            <div className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-sm flex items-center gap-1.5">
                                <Monitor className="h-3.5 w-3.5" />
                                <span>Catálogo Online</span>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pb-4 p-5 pt-0">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(venda.data)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4" />
                        <span>{FORMA_PAGAMENTO_LABELS[venda.formaPagamento] || venda.formaPagamento}</span>
                    </div>
                </div>
                <div className="mt-2 text-sm text-gray-400">
                    {venda.itens.length} {venda.itens.length === 1 ? 'item' : 'itens'}
                </div>
            </CardContent>

            <CardFooter className="pt-0 p-5 bg-gray-50/30 dark:bg-white/5 flex items-center justify-between border-t border-gray-100 dark:border-white/10">
                {venda.status !== 'cancelada' && venda.origem !== 'catalogo' ? (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-gray-300 hover:text-danger-500 hover:bg-danger-50 -ml-2 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDeleteClick(venda.id)
                        }}
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                ) : <div />}

                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Total</span>
                    <span className="text-2xl font-bold font-mono tracking-tight text-primary">
                        {formatCurrency(venda.total)}
                    </span>
                </div>
            </CardFooter>
        </Card>
    )
}
