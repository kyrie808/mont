import type { ProdutoCatalogo } from '@mont/shared'

export interface CartItem {
    product: ProdutoCatalogo
    quantity: number
}

export interface CartState {
    items: CartItem[]
    addItem: (product: ProdutoCatalogo, quantity: number) => void
    removeItem: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clearCart: () => void
    getTotalItems: () => number
    getTotalPrice: () => number
}
