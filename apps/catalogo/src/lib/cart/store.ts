'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ProdutoCatalogo } from '@mont/shared'

export interface CartItem {
    id: string
    produto: ProdutoCatalogo
    quantidade: number
}

interface CartStore {
    items: CartItem[]
    isOpen: boolean
    addItem: (produto: ProdutoCatalogo, quantidade?: number) => void
    removeItem: (id: string) => void
    updateQuantity: (id: string, quantidade: number) => void
    updateQuantidade: (id: string, quantidade: number) => void // Alias
    clearCart: () => void
    setIsOpen: (open: boolean) => void
    toggleCart: () => void
    getTotalItems: () => number
    getSubtotal: () => number
    getTotalPrice: () => number // Alias
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,

            addItem: (produto, quantidade = 1) => {
                const id = produto.id!
                const currentItems = get().items
                const existingItem = currentItems.find((item) => item.id === id)

                if (existingItem) {
                    const updatedItems = currentItems.map((item) =>
                        item.id === id
                            ? { ...item, quantidade: item.quantidade + quantidade }
                            : item
                    )
                    set({ items: updatedItems, isOpen: true })
                } else {
                    set({
                        items: [...currentItems, { id, produto, quantidade }],
                        isOpen: true,
                    })
                }
            },

            removeItem: (id) => {
                set({
                    items: get().items.filter((item) => item.id !== id),
                })
            },

            updateQuantity: (id, quantidade) => {
                if (quantidade <= 0) {
                    get().removeItem(id)
                    return
                }

                set({
                    items: get().items.map((item) =>
                        item.id === id ? { ...item, quantidade } : item
                    ),
                })
            },
            
            updateQuantidade: (id, quantidade) => get().updateQuantity(id, quantidade),

            clearCart: () => set({ items: [] }),

            setIsOpen: (isOpen) => set({ isOpen }),
            toggleCart: () => set({ isOpen: !get().isOpen }),

            getTotalItems: () => {
                return get().items.reduce((total, item) => total + item.quantidade, 0)
            },

            getSubtotal: () => {
                return get().items.reduce(
                    (total, item) => total + (item.produto.preco || 0) * item.quantidade,
                    0
                )
            },
            
            getTotalPrice: () => get().getSubtotal(),
        }),
        {
            name: 'mont-massas-cart',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
