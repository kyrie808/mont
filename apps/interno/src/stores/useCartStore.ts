import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DomainContato, DomainProduto } from '../types/domain'
import type { ItemVendaFormData } from '../schemas/venda'

export interface CartItem extends ItemVendaFormData {
    produto: DomainProduto
}

interface CartState {
    items: CartItem[]
    cliente: DomainContato | null
    addItem: (item: CartItem) => void
    removeItem: (produtoId: string) => void
    updateQuantity: (produtoId: string, quantidade: number) => void
    setCliente: (cliente: DomainContato | null) => void
    setItems: (items: CartItem[]) => void
    clearCart: () => void
}

export const useCartStore = create<CartState>()(
    persist(
        (set) => ({
            items: [],
            cliente: null,
            addItem: (item) =>
                set((state) => {
                    const existingItem = state.items.find(
                        (i) => i.produto_id === item.produto_id
                    )
                    if (existingItem) {
                        return {
                            items: state.items.map((i) =>
                                i.produto_id === item.produto_id
                                    ? {
                                        ...i,
                                        quantidade: i.quantidade + item.quantidade,
                                        subtotal:
                                            (i.quantidade + item.quantidade) *
                                            i.preco_unitario,
                                    }
                                    : i
                            ),
                        }
                    }
                    return { items: [...state.items, item] }
                }),
            removeItem: (produtoId) =>
                set((state) => ({
                    items: state.items.filter((i) => i.produto_id !== produtoId),
                })),
            updateQuantity: (produtoId, quantidade) =>
                set((state) => ({
                    items: state.items.map((i) =>
                        i.produto_id === produtoId
                            ? {
                                ...i,
                                quantidade,
                                subtotal: quantidade * i.preco_unitario,
                            }
                            : i
                    ),
                })),
            setCliente: (cliente) => set({ cliente }),
            setItems: (items) => set({ items }),
            clearCart: () => set({ items: [], cliente: null }),
        }),
        {
            name: 'massas-cart-storage',
        }
    )
)
