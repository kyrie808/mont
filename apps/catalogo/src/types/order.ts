export interface Order {
    id: string
    order_number: number
    customer_name: string
    customer_phone: string
    customer_address: string | null
    delivery_method: 'entrega' | 'retirada'
    status: 'pendente' | 'confirmado' | 'preparando' | 'enviado' | 'entregue' | 'cancelado'
    subtotal: number
    delivery_fee: number
    total: number
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
    unit_price: number
    total: number
}

export interface OrderWithItems extends Order {
    items: OrderItem[]
}
