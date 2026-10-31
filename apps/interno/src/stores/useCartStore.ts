import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DomainContato, DomainProduto } from '../types/domain'
import type { ItemVendaFormData } from '../schemas/venda'
import type { EscolhaCombo, TabelaPreco } from '../utils/tabelaPreco'

export interface CartItem extends ItemVendaFormData {
    /**
     * Identidade da linha. Avulso e combo fixo: o próprio produto_id (somar = mais quantidade).
     * Combo montado: uma chave nova por montagem — dois Combo Família com sabores diferentes
     * são duas linhas.
     */
    chave: string
    produto: DomainProduto
    /** Só em combo: os sabores escolhidos (vazio no combo fixo, ex.: Dupla Zero). */
    escolhas?: EscolhaCombo[]
}

interface CartState {
    items: CartItem[]
    cliente: DomainContato | null
    /**
     * Tabela de preço do carrinho (Black: Pix/dinheiro, cartão ou normal). Fora de campanha as
     * três dão o mesmo número. No checkout, fiado/brinde e a forma de pagamento escolhida
     * passam por cima dela (ver `tabelaDaVenda`).
     */
    tabela: TabelaPreco
    // Chave de idempotência do checkout atual. Persistida junto com o carrinho:
    // sobrevive a reload/retry (sinal fraco) e faz o backend deduplicar reenvios
    // e cliques duplos no MESMO id de venda. Só é resetada ao concluir (clearCart).
    idempotencyKey: string | null
    addItem: (item: CartItem) => void
    removeItem: (chave: string) => void
    updateQuantity: (chave: string, quantidade: number) => void
    trocarEscolhas: (chave: string, escolhas: EscolhaCombo[]) => void
    /** A tabela escolhida no carrinho. Os preços das linhas saem de `precificar`, na hora. */
    setTabela: (tabela: TabelaPreco) => void
    setCliente: (cliente: DomainContato | null) => void
    setItems: (items: CartItem[]) => void
    // Retorna a chave do checkout atual, gerando uma nova se ainda não houver.
    ensureIdempotencyKey: () => string
    clearCart: () => void
}

/** Subtotal em centavos inteiros: 3 × 26,33 não pode virar 78,99000000000001. */
function subtotal(quantidade: number, precoUnitario: number): number {
    return (Math.round(precoUnitario * 100) * quantidade) / 100
}

/**
 * As linhas com o preço da tabela que está VALENDO agora (a escolhida no carrinho ou, no
 * checkout, a que a forma de pagamento impõe). Não grava nada: o store guarda só a escolha,
 * e voltar de "Fiado" para "Balcão" devolve o carrinho ao preço escolhido.
 */
export function precificar(items: CartItem[], precoDe: (produto: DomainProduto) => number): CartItem[] {
    return items.map((i) => {
        const preco = precoDe(i.produto)
        return { ...i, preco_unitario: preco, subtotal: subtotal(i.quantidade, preco) }
    })
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            cliente: null,
            tabela: 'pix',
            idempotencyKey: null,
            addItem: (item) =>
                set((state) => {
                    const existente = state.items.find((i) => i.chave === item.chave)
                    if (existente) {
                        const quantidade = existente.quantidade + item.quantidade
                        return {
                            items: state.items.map((i) =>
                                i.chave === item.chave
                                    ? { ...i, quantidade, subtotal: subtotal(quantidade, i.preco_unitario) }
                                    : i
                            ),
                        }
                    }
                    return { items: [...state.items, item] }
                }),
            removeItem: (chave) =>
                set((state) => ({
                    items: state.items.filter((i) => i.chave !== chave),
                })),
            updateQuantity: (chave, quantidade) =>
                set((state) => ({
                    items: state.items.map((i) =>
                        i.chave === chave
                            ? { ...i, quantidade, subtotal: subtotal(quantidade, i.preco_unitario) }
                            : i
                    ),
                })),
            trocarEscolhas: (chave, escolhas) =>
                set((state) => ({
                    items: state.items.map((i) => (i.chave === chave ? { ...i, escolhas } : i)),
                })),
            setTabela: (tabela) => set({ tabela }),
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
            // v1 (30/10/2026): linhas ganharam `chave` (combos montados) e o carrinho, a tabela
            // de preço. Carrinho salvo na v0 vira v1 sem perder item.
            version: 1,
            migrate: (salvo, versao) => {
                const estado = (salvo ?? {}) as Partial<CartState> & { items?: Partial<CartItem>[] }
                if (versao < 1) {
                    return {
                        ...estado,
                        tabela: 'pix',
                        items: (estado.items ?? []).map((i) => ({ ...i, chave: i.chave ?? i.produto_id })),
                    } as CartState
                }
                return estado as CartState
            },
        }
    )
)
