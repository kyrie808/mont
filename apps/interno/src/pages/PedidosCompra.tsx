import { useState } from 'react'
import { Plus, TrendingUp, DollarSign, Wallet, Settings } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, EmptyState, Button, Badge } from '../components/ui'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PurchaseOrderForm } from '../components/features/purchase-orders/PurchaseOrderForm'
import { PedidosCompraDataGrid } from '../components/features/purchase-orders/PedidosCompraDataGrid'
import { PurchaseOrderDetail } from '../components/features/purchase-orders/PurchaseOrderDetail'
import { PurchaseOrderPaymentModal } from '../components/features/purchase-orders/PurchaseOrderPaymentModal'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { useToast } from '../components/ui/Toast'
import type { DomainPurchaseOrderWithItems, CreatePurchaseOrder, UpdatePurchaseOrder, PurchaseOrderPaymentStatus, CreatePurchaseOrderItem } from '../types/domain'
import { formatCurrency, formatDate } from '@mont/shared'
import { WidgetSkeleton } from '../components/ui'
import { ProductNicknamesModal } from '../components/features/purchase-orders/ProductNicknamesModal'
import { KpiCard } from '../components/dashboard/KpiCard'
import { KpiCardDesktop } from '../components/dashboard/KpiCardDesktop'

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
        receberPedido,
        addPayment,
        deletePayment,
        refetch
    } = usePurchaseOrders()
    const toast = useToast()

    // Confirmar recebimento agora DÁ ENTRADA no estoque (RPC receive_purchase_order):
    // incrementa o estoque_atual dos itens e recalcula o custo médio. Antes só mudava o status.
    const handleConfirmReceipt = async (order: DomainPurchaseOrderWithItems) => {
        try {
            await receberPedido(order.id)
            toast.success('Recebimento confirmado — estoque atualizado.')
        } catch (e) {
            const msg = (e as Error)?.message ?? ''
            toast.error(msg.includes('already received') ? 'Este pedido já foi recebido.' : 'Não foi possível confirmar o recebimento.')
        }
    }

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
                            <button onClick={() => setIsNicknamesOpen(true)} aria-label="Configurar apelidos de produtos" className="p-2 rounded-full"><Settings /></button>
                            <button onClick={handleCreateNew} aria-label="Novo pedido de compra" className="p-2 rounded-full text-primary"><Plus /></button>
                        </div>
                    }
                />

                <PageContainer className="pt-6! px-4 pb-24">
                    {/* KPIs — MOBILE/TABLET (<lg): intocado */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 lg:hidden">
                        <KpiCard
                            title="Total Pedido"
                            value={formatCurrency(kpis.totalPedido)}
                            icon={DollarSign}
                            progress={100}
                            progressColor="bg-primary"
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
                            progressColor="bg-warning"
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
                            progressColor="bg-success"
                            trend={`${kpis.totalPedido > 0
                                ? Math.round((kpis.totalPago / kpis.totalPedido) * 100)
                                : 0}% Quitado`}
                            trendColor="green"
                        />
                    </div>

                    {/* KPIs — DESKTOP (≥lg): padrão v2 */}
                    <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4 mb-6">
                        <KpiCardDesktop title="Total Pedido" value={formatCurrency(kpis.totalPedido)} subtitle="Total bruto (sem cancelados)" />
                        <KpiCardDesktop
                            title="Valor em Aberto"
                            value={formatCurrency(kpis.totalAberto)}
                            subtitle={`${kpis.totalPedido > 0 ? Math.round((kpis.totalAberto / kpis.totalPedido) * 100) : 0}% pendente`}
                        />
                        <KpiCardDesktop
                            title="Valor Pago"
                            value={formatCurrency(kpis.totalPago)}
                            subtitle={`${kpis.totalPedido > 0 ? Math.round((kpis.totalPago / kpis.totalPedido) * 100) : 0}% quitado`}
                        />
                    </div>

                    {loading && !orders.length ? <WidgetSkeleton height="h-48" lines={3} /> : orders.length === 0 ? (
                        <EmptyState title="Nenhum pedido" description="Crie seu primeiro pedido." action={<Button onClick={handleCreateNew}>Novo Pedido</Button>} />
                    ) : (
                        <>
                        {/* MOBILE (<lg): cards expansíveis — intocados (mobile sagrado) */}
                        <div className="flex flex-col gap-4 lg:hidden">
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
                                                <span className="text-xs text-muted-foreground">{formatDate(order.orderDate)}</span>
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

                                        <PurchaseOrderDetail
                                            order={orderWithItems}
                                            onDeletePayment={setPaymentToDelete}
                                            onConfirmReceipt={handleConfirmReceipt}
                                            onQuitar={setPaymentModalOrder}
                                        />
                                    </Card>
                                )
                            })}
                        </div>

                        {/* DESKTOP (≥lg): data grid denso — uma linha por pedido, ações inline */}
                        <div className="hidden lg:block">
                            <PedidosCompraDataGrid
                                orders={orders}
                                onEdit={handleEdit}
                                onDeletePayment={setPaymentToDelete}
                                onConfirmReceipt={handleConfirmReceipt}
                                onQuitar={(order) => setPaymentModalOrder(order)}
                            />
                        </div>
                        </>
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
