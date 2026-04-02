import type { Product } from './product'

export interface CartItem {
    product: Product
    quantity: number
}

export interface CartState {
    items: CartItem[]
    addItem: (product: Product, quantity: number) => void
    removeItem: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clearCart: () => void
    getTotalItems: () => number
    getTotalPrice: () => number
}
