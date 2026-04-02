import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchaseOrderService } from '../services/purchaseOrderService'
import type { CreatePurchaseOrder, UpdatePurchaseOrder, CreatePurchaseOrderItem } from '../types/domain'

export function usePurchaseOrders() {
    const queryClient = useQueryClient()

    const { data: orders, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['purchase_orders'],
        queryFn: () => purchaseOrderService.fetchOrders(),
    })

    const createMutation = useMutation({
        mutationFn: ({ order, items }: { order: CreatePurchaseOrder, items: CreatePurchaseOrderItem[] }) =>
            purchaseOrderService.createOrder(order, items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
            queryClient.invalidateQueries({ queryKey: ['produtos'] }) // Refresh stock
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, updates, items }: { id: string, updates: UpdatePurchaseOrder, items?: CreatePurchaseOrderItem[] }) =>
            purchaseOrderService.updateOrder(id, updates, items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => purchaseOrderService.deleteOrder(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
        }
    })

    const addPaymentMutation = useMutation({
        mutationFn: ({ orderId, payment }: { orderId: string, payment: { amount: number, method: string, contaId: string, notes?: string, paymentDate?: string } }) =>
            purchaseOrderService.addPayment(orderId, payment),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
        }
    })

    const deletePaymentMutation = useMutation({
        mutationFn: (paymentId: string) => purchaseOrderService.deletePayment(paymentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
        }
    })

    return {
        orders: orders || [],
        loading,
        error: error ? (error as Error).message : null,
        refetch,
        createOrder: createMutation.mutateAsync,
        updateOrder: updateMutation.mutateAsync,
        deleteOrder: deleteMutation.mutateAsync,
        addPayment: addPaymentMutation.mutateAsync,
        deletePayment: deletePaymentMutation.mutateAsync
    }
}

export function usePurchaseOrder(id: string | undefined) {
    const { data: order, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['purchase_order', id],
        queryFn: () => id ? purchaseOrderService.fetchOrderById(id) : null,
        enabled: !!id,
    })

    return {
        order: order || null,
        loading,
        error: error ? (error as Error).message : null,
        refetch
    }
}
