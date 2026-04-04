import type { ProdutoCatalogo } from '@mont/shared'

export interface ItemCarrinho {
    produto: ProdutoCatalogo
    quantidade: number
}

export interface CartState {
    items: ItemCarrinho[]
    addItem: (produto: ProdutoCatalogo, quantidade: number) => void
    removeItem: (produtoId: string) => void
    updateQuantidade: (produtoId: string, quantidade: number) => void
    clearCart: () => void
    getTotalItems: () => number
    getTotalPrice: () => number
}
