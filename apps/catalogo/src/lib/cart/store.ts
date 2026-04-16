'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { pushEvent } from '@/lib/analytics/dataLayer'
import type { CartState, CartItem } from '@/types/cart'
import type { ProdutoCatalogo } from '@mont/shared'

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (product: ProdutoCatalogo, quantity: number) => {
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

                pushEvent({
                    event: 'add_to_cart',
                    ecommerce: {
                        currency: 'BRL',
                        value: (product.preco ?? 0) * quantity,
                        items: [{
                            item_id: product.id ?? '',
                            item_name: product.nome ?? '',
                            price: product.preco ?? 0,
                            quantity: quantity
                        }]
                    }
                })
            },

            removeItem: (productId: string) => {
                const itemToRemove = get().items.find((item) => item.product.id === productId)
                set({ items: get().items.filter((item) => item.product.id !== productId) })

                if (itemToRemove) {
                    pushEvent({
                        event: 'remove_from_cart',
                        ecommerce: {
                            currency: 'BRL',
                            value: (itemToRemove.product.preco ?? 0) * itemToRemove.quantity,
                            items: [{
                                item_id: itemToRemove.product.id ?? '',
                                item_name: itemToRemove.product.nome ?? '',
                                price: itemToRemove.product.preco ?? 0,
                                quantity: itemToRemove.quantity
                            }]
                        }
                    })
                }
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
                    (total, item) => total + (item.product.preco ?? 0) * item.quantity,
                    0
                )
            },
        }),
        {
            name: 'mont-cart-storage',
        }
    )
)
