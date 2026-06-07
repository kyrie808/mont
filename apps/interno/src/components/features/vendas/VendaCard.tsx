import { useNavigate } from 'react-router-dom'
import { Calendar, DollarSign, Monitor, Truck, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardContent, CardFooter, Button } from '../../../components/ui'
import { formatDate, formatCurrency } from '@mont/shared'
import { FORMA_PAGAMENTO_LABELS } from '../../../constants'
import { cn } from '@mont/shared'
import { getVendaBadgeStatus } from '@/utils/vendaBadge'

import type { DomainVenda } from '../../../types/domain'

interface VendaCardProps {
    venda: DomainVenda
    onDeleteClick: (id: string) => void
}

export function VendaCard({ venda, onDeleteClick }: VendaCardProps) {
    const navigate = useNavigate()

    return (
        <Card
            className="group active:scale-[0.99] transition-all duration-200 overflow-hidden cursor-pointer hover:shadow-elevated border-l-4 border-l-transparent hover:border-l-primary"
            onClick={() => navigate(`/vendas/${venda.id}`)}
        >
            <CardHeader className="pb-2 p-5">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xl text-foreground leading-tight truncate">
                            {venda.contato?.nome || 'Cliente Não Identificado'}
                        </h3>
                        <span className="text-xs text-muted-foreground font-mono mt-1 block">
                            #{venda.id.slice(0, 8)}
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        {/* Delivery Status */}
                        <div className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border shadow-card",
                            venda.status === 'entregue'
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-warning/10 text-warning-strong border-warning/20"
                        )}>
                            <Truck className="h-3.5 w-3.5" />
                            <span>{venda.status === 'entregue' ? 'Entregue' : 'Entrega Pendente'}</span>
                        </div>

                        {/* Payment Status */}
                        {(() => {
                            const status = getVendaBadgeStatus(venda)

                            let badgeClass = ""
                            let badgeText = ""

                            switch (status.kind) {
                                case 'pago':
                                    badgeClass = "bg-success/10 text-success border-success/20"
                                    badgeText = "Pago"
                                    break
                                case 'vencido':
                                    badgeClass = "bg-destructive/10 text-destructive border-destructive/20"
                                    badgeText = `Vencido (${status.diasAtraso}d)`
                                    break
                                case 'vence_hoje':
                                    badgeClass = "bg-warning-strong/10 text-warning-strong border-warning-strong/20"
                                    badgeText = "Vence hoje"
                                    break
                                case 'proximo_vencimento':
                                    badgeClass = "bg-warning/10 text-warning-strong border-warning/20"
                                    badgeText = `Vence em ${status.dias}d`
                                    break
                                case 'a_receber_futuro':
                                    badgeClass = "bg-foreground/5 text-foreground/80 border-foreground/20"
                                    badgeText = "A Receber"
                                    break
                                case 'brinde':
                                    badgeClass = "bg-muted text-muted-foreground border-border"
                                    badgeText = "Brinde"
                                    break
                                case 'pendente':
                                case 'sem_data':
                                default:
                                    badgeClass = "bg-warning/10 text-warning-strong border-warning/20"
                                    badgeText = "Pendente"
                                    break
                            }

                            return (
                                <div className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border shadow-card",
                                    badgeClass
                                )}>
                                    <DollarSign className="h-3.5 w-3.5" />
                                    <span>{badgeText}</span>
                                </div>
                            )
                        })()}

                        {/* Origin Badge */}
                        {venda.origem === 'catalogo' && (
                            <div className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-card flex items-center gap-1.5">
                                <Monitor className="h-3.5 w-3.5" />
                                <span>Catálogo Online</span>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pb-4 p-5 pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(venda.data)}</span>
                        {venda.formaPagamento === 'fiado' && venda.dataPrevistaPagamento && (
                            <span className="text-muted-foreground">· Vence {formatDate(venda.dataPrevistaPagamento)}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4" />
                        <span>{FORMA_PAGAMENTO_LABELS[venda.formaPagamento] || venda.formaPagamento}</span>
                    </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                    {venda.itens.length} {venda.itens.length === 1 ? 'item' : 'itens'}
                </div>
            </CardContent>

            <CardFooter className="pt-0 p-5 bg-muted/30 flex items-center justify-between border-t border-border">
                {venda.status !== 'cancelada' && venda.origem !== 'catalogo' ? (
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir venda"
                        className="h-9 w-9 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 -ml-2 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDeleteClick(venda.id)
                        }}
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                ) : <div />}

                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Total</span>
                    <span className="text-2xl font-bold font-mono tracking-tight text-primary tabular-nums">
                        {formatCurrency(venda.total)}
                    </span>
                </div>
            </CardFooter>
        </Card>
    )
}
