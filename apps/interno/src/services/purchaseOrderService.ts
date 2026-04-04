import { supabase } from '../lib/supabase'
import type { DomainPurchaseOrderWithItems, CreatePurchaseOrder, UpdatePurchaseOrder } from '../types/domain'
import { toDomainPurchaseOrderWithItems } from './mappers'
import type { Database } from '@mont/shared'

export interface CreatePurchaseOrderItem {
    productId: string
    quantity: number
    unitCost: number
}

export const purchaseOrderService = {
    async fetchOrders(): Promise<DomainPurchaseOrderWithItems[]> {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                fornecedor:contatos(nome),
                items:purchase_order_items(
                    *,
                    product:produtos(*)
                ),
                payments:purchase_order_payments(*)
            `)
            .order('order_date', { ascending: false })

        if (error) throw error
        return (data || []).map(toDomainPurchaseOrderWithItems)
    },

    async fetchOrderById(id: string): Promise<DomainPurchaseOrderWithItems | null> {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                fornecedor:contatos(nome),
                items:purchase_order_items(
                    *,
                    product:produtos(*)
                ),
                payments:purchase_order_payments(*)
            `)
            .eq('id', id)
            .single()

        if (error) throw error
        if (!data) return null

        return toDomainPurchaseOrderWithItems(data)
    },

    async createOrder(order: CreatePurchaseOrder, items: CreatePurchaseOrderItem[]): Promise<DomainPurchaseOrderWithItems> {
        // Implementation remains similar but uses mappers for return
        const { data: newOrder, error: orderError } = await supabase
            .from('purchase_orders')
            .insert({
                fornecedor_id: order.fornecedorId,
                order_date: order.orderDate,
                total_amount: order.totalAmount,
                notes: order.notes,
                payment_status: 'unpaid',
                status: 'pending'
            })
            .select()
            .single()

        if (orderError) throw orderError

        const orderItems = items.map(item => ({
            purchase_order_id: newOrder.id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_cost: item.unitCost
        }))

        const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(orderItems)

        if (itemsError) throw itemsError

        return this.fetchOrderById(newOrder.id) as Promise<DomainPurchaseOrderWithItems>
    },

    async updateOrder(id: string, updates: UpdatePurchaseOrder, items?: CreatePurchaseOrderItem[]): Promise<DomainPurchaseOrderWithItems> {
        // When items are provided, use the atomic RPC that does DELETE + INSERT in one transaction.
        // This guarantees that if the INSERT fails, the prior DELETE is rolled back.
        if (items !== undefined) {
            const { error } = await supabase.rpc('update_purchase_order_with_items', {
                p_order_id:       id,
                p_fornecedor_id:  updates.fornecedorId!,
                p_order_date:     updates.orderDate!,
                p_total_amount:   updates.totalAmount!,
                p_notes:          updates.notes ?? '',
                p_status:         updates.status ?? 'pending',
                p_payment_status: updates.paymentStatus ?? 'unpaid',
                p_items:          items.map(i => ({
                    product_id: i.productId,
                    quantity:   i.quantity,
                    unit_cost:  i.unitCost
                }))
            })
            if (error) throw error
            return this.fetchOrderById(id) as Promise<DomainPurchaseOrderWithItems>
        }

        // No items provided — simple header-only update (e.g. confirm receipt, status change)
        const dbUpdates: Database['public']['Tables']['purchase_orders']['Update'] = {}
        if (updates.fornecedorId !== undefined) dbUpdates.fornecedor_id = updates.fornecedorId
        if (updates.orderDate !== undefined) dbUpdates.order_date = updates.orderDate
        if (updates.status !== undefined) dbUpdates.status = updates.status
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes
        if (updates.totalAmount !== undefined) dbUpdates.total_amount = updates.totalAmount
        if (updates.paymentStatus !== undefined) dbUpdates.payment_status = updates.paymentStatus
        if (updates.dataRecebimento !== undefined) dbUpdates.data_recebimento = updates.dataRecebimento

        const { error } = await supabase
            .from('purchase_orders')
            .update(dbUpdates)
            .eq('id', id)

        if (error) throw error
        return this.fetchOrderById(id) as Promise<DomainPurchaseOrderWithItems>
    },

    async deleteOrder(id: string): Promise<void> {
        const { error } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', id)

        if (error) throw error
    },

    async addPayment(orderId: string, payment: { amount: number, method: string, contaId: string, notes?: string, paymentDate?: string }): Promise<void> {
        const { error: paymentError } = await supabase
            .from('purchase_order_payments')
            .insert({
                purchase_order_id: orderId,
                amount: Math.round(payment.amount * 100) / 100,
                payment_method: payment.method,
                conta_id: payment.contaId,
                notes: payment.notes,
                payment_date: payment.paymentDate
                    ? new Date(payment.paymentDate + 'T12:00:00').toISOString()
                    : new Date().toISOString()
            })

        if (paymentError) throw paymentError
    },

    async deletePayment(paymentId: string): Promise<void> {
        const { error } = await supabase
            .from('purchase_order_payments')
            .delete()
            .eq('id', paymentId)

        if (error) throw error
    }
}
