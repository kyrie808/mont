'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartState, CartItem } from '@/types/cart'
import type { Product } from '@/types/product'

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (product: Product, quantity: number) => {
                const items = get().items
                const existingItem = items.find((item) => item.product.id === product.id)

                if (existingItem) {
                    set({
                        items: items.map((item) =>
                            item.product.id === product.id
                                ? { ...item, quantity: item.quantity + quantity }
                                : item
                        ),
                    })
                } else {
                    set({ items: [...items, { product, quantity }] })
                }
            },

            removeItem: (productId: string) => {
                set({ items: get().items.filter((item) => item.product.id !== productId) })
            },

            updateQuantity: (productId: string, quantity: number) => {
                if (quantity <= 0) {
                    get().removeItem(productId)
                } else {
                    set({
                        items: get().items.map((item) =>
                            item.product.id === productId ? { ...item, quantity } : item
                        ),
                    })
                }
            },

            clearCart: () => {
                set({ items: [] })
            },

            getTotalItems: () => {
                return get().items.reduce((total, item) => total + item.quantity, 0)
            },

            getTotalPrice: () => {
                return get().items.reduce(
                    (total, item) => total + item.product.price_cents * item.quantity,
                    0
                )
            },
        }),
        {
            name: 'mont-cart-storage',
        }
    )
)
