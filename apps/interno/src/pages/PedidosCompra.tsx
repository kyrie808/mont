import { useState } from 'react'
import { Plus, TrendingUp, DollarSign, Wallet, Settings, PackageCheck, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, EmptyState, Button, Badge } from '../components/ui'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PurchaseOrderForm } from '../components/features/purchase-orders/PurchaseOrderForm'
import { PurchaseOrderPaymentModal } from '../components/features/purchase-orders/PurchaseOrderPaymentModal'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import type { DomainPurchaseOrderWithItems, CreatePurchaseOrder, UpdatePurchaseOrder, PurchaseOrderPaymentStatus, CreatePurchaseOrderItem } from '../types/domain'
import { formatCurrency, formatDate } from '@mont/shared'
import { WidgetSkeleton } from '../components/ui'
import { ProductNicknamesModal } from '../components/features/purchase-orders/ProductNicknamesModal'
import { KpiCard } from '../components/dashboard/KpiCard'

// Mapa de tradução e estilo para paymentStatus
const PAYMENT_STATUS_MAP: Record<PurchaseOrderPaymentStatus, { label: string; variant: 'danger' | 'warning' | 'success' }> = {
    unpaid: { label: 'Em Aberto', variant: 'danger' },
    partial: { label: 'Parcialmente Pago', variant: 'warning' },
    paid: { label: 'Pago', variant: 'success' },
}

export function PedidosCompra() {
    const {
        orders,
        loading,
        createOrder,
        updateOrder,
        addPayment,
        deletePayment,
        refetch
    } = usePurchaseOrders()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isNicknamesOpen, setIsNicknamesOpen] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<DomainPurchaseOrderWithItems | null>(null)
    const [paymentModalOrder, setPaymentModalOrder] = useState<DomainPurchaseOrderWithItems | null>(null)
    const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null)

    // Calcula KPIs
    const kpis = orders.reduce((acc, order) => {
        if (order.status === 'cancelled') return acc
        return {
            totalPedido: acc.totalPedido + order.totalAmount,
            totalPago: acc.totalPago + order.amountPaid,
            totalAberto: acc.totalAberto + (order.totalAmount - order.amountPaid)
        }
    }, { totalPedido: 0, totalPago: 0, totalAberto: 0 })

    const handleCreateNew = () => {
        setSelectedOrder(null)
        setIsFormOpen(true)
    }

    const handleEdit = (order: DomainPurchaseOrderWithItems) => {
        setSelectedOrder(order)
        setIsFormOpen(true)
    }

    const handleSave = async (orderData: CreatePurchaseOrder | UpdatePurchaseOrder, items: CreatePurchaseOrderItem[]) => {
        if (selectedOrder) {
            await updateOrder({ id: selectedOrder.id, updates: orderData as UpdatePurchaseOrder, items })
        } else {
            await createOrder({ order: orderData as CreatePurchaseOrder, items })
        }
        refetch()
    }

    return (
        <>
            <Header
                    title="Pedidos de Compra"
                    showBack
                    centerTitle
                    rightAction={
                        <div className="flex gap-2">
                            <button onClick={() => setIsNicknamesOpen(true)} className="p-2 rounded-full"><Settings /></button>
                            <button onClick={handleCreateNew} className="p-2 rounded-full text-semantic-green"><Plus /></button>
                        </div>
                    }
                />

                <PageContainer className="!pt-6 px-4 pb-24">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <KpiCard
                            title="Total Pedido"
                            value={formatCurrency(kpis.totalPedido)}
                            icon={DollarSign}
                            progress={100}
                            progressColor="bg-blue-500"
                            trend="Total Bruto"
                            trendColor="primary"
                        />
                        <KpiCard
                            title="Valor em Aberto"
                            value={formatCurrency(kpis.totalAberto)}
                            icon={Wallet}
                            progress={kpis.totalPedido > 0
                                ? Math.round((kpis.totalAberto / kpis.totalPedido) * 100)
                                : 0}
                            progressColor="bg-yellow-500"
                            trend={`${kpis.totalPedido > 0
                                ? Math.round((kpis.totalAberto / kpis.totalPedido) * 100)
                                : 0}% Pendente`}
                            trendColor="yellow"
                        />
                        <KpiCard
                            title="Valor Pago"
                            value={formatCurrency(kpis.totalPago)}
                            icon={TrendingUp}
                            progress={kpis.totalPedido > 0
                                ? Math.round((kpis.totalPago / kpis.totalPedido) * 100)
                                : 0}
                            progressColor="bg-emerald-500"
                            trend={`${kpis.totalPedido > 0
                                ? Math.round((kpis.totalPago / kpis.totalPedido) * 100)
                                : 0}% Quitado`}
                            trendColor="green"
                        />
                    </div>

                    {loading && !orders.length ? <WidgetSkeleton height="h-48" lines={3} /> : orders.length === 0 ? (
                        <EmptyState title="Nenhum pedido" description="Crie seu primeiro pedido." action={<Button onClick={handleCreateNew}>Novo Pedido</Button>} />
                    ) : (
                        <div className="flex flex-col gap-4">
                            {orders.map((order) => {
                                const statusInfo = PAYMENT_STATUS_MAP[order.paymentStatus] || PAYMENT_STATUS_MAP.unpaid
                                const orderWithItems = order as DomainPurchaseOrderWithItems
                                return (
                                    <Card key={order.id} className="p-0 overflow-hidden">
                                        {/* Header do pedido */}
                                        <div
                                            onClick={() => handleEdit(orderWithItems)}
                                            className="flex items-center justify-between px-4 py-3 bg-muted cursor-pointer hover:bg-muted transition-colors"
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(order.orderDate)}</span>
                                                <span className="font-semibold text-sm">
                                                    {orderWithItems.fornecedor?.nome || 'Fornecedor não informado'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-sm">
                                                    {order.paymentStatus === 'paid'
                                                        ? formatCurrency(order.totalAmount)
                                                        : `Em aberto: ${formatCurrency(order.totalAmount - order.amountPaid)}`}
                                                </span>
                                                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                                            </div>
                                        </div>

                                        {/* Tabela de itens */}
                                        {orderWithItems.items && orderWithItems.items.length > 0 && (
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
                                                    {orderWithItems.items.map((item) => (
                                                        <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
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
                                        {orderWithItems.payments && orderWithItems.payments.length > 0 && (
                                            <div className="px-4 py-3 border-t border-border bg-muted">
                                                <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                                                    Pagamentos registrados
                                                </h4>
                                                <div className="space-y-1">
                                                    {orderWithItems.payments.map((payment) => (
                                                        <div key={payment.id} className="flex flex-wrap items-center justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                                            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                                                                <span>{formatDate(payment.payment_date || payment.created_at)}</span>
                                                                <span className="capitalize">{payment.payment_method?.replace('_', ' ')}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                                    {formatCurrency(payment.amount)}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setPaymentToDelete(payment.id)
                                                                    }}
                                                                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
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
                                                <div className="mb-3 text-xs text-gray-500 dark:text-gray-400 text-left">
                                                    Valor do pedido {orderWithItems.fornecedor?.nome || 'não informado'}:{' '}
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">
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
                                                                updateOrder({ id: order.id, updates: { status: 'received', dataRecebimento: new Date().toISOString() } })
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
                                                                setPaymentModalOrder(orderWithItems)
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
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    {isFormOpen && (
                        <PurchaseOrderForm
                            isOpen={isFormOpen}
                            onClose={() => setIsFormOpen(false)}
                            onSave={handleSave}
                            initialData={selectedOrder}
                        />
                    )}

                    {isNicknamesOpen && (
                        <ProductNicknamesModal
                            isOpen={isNicknamesOpen}
                            onClose={() => setIsNicknamesOpen(false)}
                        />
                    )}

                    {paymentModalOrder && (
                        <PurchaseOrderPaymentModal
                            isOpen={!!paymentModalOrder}
                            onClose={() => setPaymentModalOrder(null)}
                            order={paymentModalOrder}
                            onConfirm={async (data) => {
                                await addPayment({
                                    orderId: paymentModalOrder.id,
                                    payment: {
                                        amount: data.amount,
                                        method: data.payment_method,
                                        contaId: data.conta_id,
                                        notes: data.notes,
                                        paymentDate: data.payment_date
                                    }
                                })
                                refetch()
                            }}
                        />
                    )}

                    <ConfirmDialog
                        open={!!paymentToDelete}
                        title="Excluir Pagamento"
                        message="Tem certeza que deseja excluir este pagamento? O valor total pago do pedido será recalculado automaticamente."
                        confirmLabel="Excluir"
                        variant="danger"
                        onConfirm={async () => {
                            if (paymentToDelete) {
                                try {
                                    await deletePayment(paymentToDelete)
                                    refetch()
                                } finally {
                                    setPaymentToDelete(null)
                                }
                            }
                        }}
                        onCancel={() => setPaymentToDelete(null)}
                    />
                </PageContainer>
        </>
    )
}
