export interface Order {
    id: string
    order_number: number
    customer_name: string
    customer_phone: string
    customer_address: string | null
    delivery_method: 'entrega' | 'retirada'
    status: 'pendente' | 'confirmado' | 'preparando' | 'enviado' | 'entregue' | 'cancelado'
    subtotal_cents: number
    delivery_fee_cents: number
    total_cents: number
    payment_method: 'pix' | 'dinheiro' | 'cartao' | 'fiado'
    payment_status: 'pendente' | 'pago' | 'parcial'
    notes: string | null
    referred_by: string | null
    created_at: string
    updated_at: string
}

export interface OrderItem {
    id: string
    order_id: string
    product_id: string
    product_name: string
    quantity: number
    unit_price_cents: number
    total_cents: number
}

export interface OrderWithItems extends Order {
    items: OrderItem[]
}
