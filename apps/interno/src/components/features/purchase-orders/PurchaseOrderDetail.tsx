import { Trash2, PackageCheck, DollarSign } from 'lucide-react'
import { Button } from '../../ui'
import { formatCurrency, formatDate } from '@mont/shared'
import type { DomainPurchaseOrderWithItems } from '../../../types/domain'

interface PurchaseOrderDetailProps {
    order: DomainPurchaseOrderWithItems
    onDeletePayment: (paymentId: string) => void
    onConfirmReceipt: (order: DomainPurchaseOrderWithItems) => void
    onQuitar: (order: DomainPurchaseOrderWithItems) => void
}

/**
 * Corpo do pedido de compra — itens + pagamentos registrados + ações.
 * Compartilhado entre o card mobile (PedidosCompra) e a linha expandida do
 * DataGrid desktop (PedidosCompraDataGrid). NÃO inclui o cabeçalho
 * (data/fornecedor/total/status): no mobile é o header do card, no desktop é a
 * própria linha do grid.
 */
export function PurchaseOrderDetail({ order, onDeletePayment, onConfirmReceipt, onQuitar }: PurchaseOrderDetailProps) {
    return (
        <>
            {/* Tabela de itens */}
            {order.items && order.items.length > 0 && (
                <table className="w-full text-left text-sm">
                    <thead className="text-xs text-muted-foreground border-b border-border">
                        <tr>
                            <th className="px-4 py-2 font-medium">Produto</th>
                            <th className="px-4 py-2 font-medium text-center">Qtd</th>
                            <th className="px-4 py-2 font-medium text-right">Custo Unit.</th>
                            <th className="px-4 py-2 font-medium text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item) => (
                            <tr key={item.id} className="border-b border-border last:border-0">
                                <td className="px-4 py-2">{item.product?.nome || item.productId}</td>
                                <td className="px-4 py-2 text-center">{item.quantity}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(item.unitCost)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(item.totalCost)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Histórico de Pagamentos */}
            {order.payments && order.payments.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-muted">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                        Pagamentos registrados
                    </h4>
                    <div className="space-y-1">
                        {order.payments.map((payment) => (
                            <div key={payment.id} className="flex flex-wrap items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <span>{formatDate(payment.payment_date || payment.created_at)}</span>
                                    <span className="capitalize">{payment.payment_method?.replace('_', ' ')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(payment.amount)}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDeletePayment(payment.id)
                                        }}
                                        className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                                        title="Excluir pagamento"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ações (Recebimento / Pagamento) */}
            {(order.status === 'pending' || order.paymentStatus !== 'paid') && (
                <div className="px-4 py-3 border-t border-border">
                    <div className="mb-3 text-xs text-muted-foreground text-left">
                        Valor do pedido {order.fornecedor?.nome || 'não informado'}:{' '}
                        <span className="font-medium text-foreground">
                            {formatCurrency(order.totalAmount)}
                        </span>{' '}
                        = ({order.totalAmount > 0 ? Math.round((order.amountPaid / order.totalAmount) * 100) : 0}% pago)
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        {order.status === 'pending' && (
                            <Button
                                variant="success"
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    onConfirmReceipt(order)
                                }}
                                className="flex-1 flex items-center justify-center gap-2"
                            >
                                <PackageCheck size={16} />
                                Confirmar Recebimento
                            </Button>
                        )}
                        {order.paymentStatus !== 'paid' && (
                            <Button
                                variant="outline"
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    onQuitar(order)
                                }}
                                className="flex items-center justify-center gap-2 border-border hover:bg-muted"
                            >
                                <DollarSign size={16} />
                                Quitar
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
