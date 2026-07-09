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
    // Chave de idempotência do checkout atual. Persistida junto com o carrinho:
    // sobrevive a reload/retry (sinal fraco) e faz o backend deduplicar reenvios
    // e cliques duplos no MESMO id de venda. Só é resetada ao concluir (clearCart).
    idempotencyKey: string | null
    addItem: (item: CartItem) => void
    removeItem: (produtoId: string) => void
    updateQuantity: (produtoId: string, quantidade: number) => void
    setCliente: (cliente: DomainContato | null) => void
    setItems: (items: CartItem[]) => void
    // Retorna a chave do checkout atual, gerando uma nova se ainda não houver.
    ensureIdempotencyKey: () => string
    clearCart: () => void
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            cliente: null,
            idempotencyKey: null,
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
            ensureIdempotencyKey: () => {
                const existing = get().idempotencyKey
                if (existing) return existing
                const key = crypto.randomUUID()
                set({ idempotencyKey: key })
                return key
            },
            clearCart: () => set({ items: [], cliente: null, idempotencyKey: null }),
        }),
        {
            name: 'massas-cart-storage',
        }
    )
)
