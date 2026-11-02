import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, precificar, type CartItem } from './useCartStore'
import type { DomainProduto } from '../types/domain'

/**
 * Carrinho da Nova Venda com combos montados e tabela de preço (30/10/2026).
 * Unit, sem banco.
 */

function produto(id: string, preco: number, ehCombo = false): DomainProduto {
    return {
        id, nome: id, codigo: id, preco, custo: 0, ativo: true, ehCombo,
        estoqueAtual: 0, estoqueMinimo: 0, unidade: 'un',
        criadoEm: '2026-10-30T00:00:00Z', atualizadoEm: '2026-10-30T00:00:00Z',
    } as DomainProduto
}

function linha(chave: string, p: DomainProduto, quantidade: number, preco: number, extra: Partial<CartItem> = {}): CartItem {
    return { chave, produto: p, produto_id: p.id, quantidade, preco_unitario: preco, subtotal: quantidade * preco, ...extra }
}

const BALDE = produto('balde', 75)
const FAMILIA = produto('familia', 199, true)
const PRECOS: Record<string, { pix: number; cartao: number; normal: number }> = {
    balde: { pix: 65, cartao: 68, normal: 75 },
    familia: { pix: 199, cartao: 206, normal: 199 },
}

beforeEach(() => {
    useCartStore.setState({ items: [], cliente: null, tabela: 'pix', idempotencyKey: null })
})

describe('linhas por chave', () => {
    it('o mesmo avulso soma quantidade na mesma linha', () => {
        const { addItem } = useCartStore.getState()
        addItem(linha('balde', BALDE, 1, 65))
        addItem(linha('balde', BALDE, 2, 65))
        const { items } = useCartStore.getState()
        expect(items).toHaveLength(1)
        expect(items[0].quantidade).toBe(3)
        expect(items[0].subtotal).toBe(195)
    })

    it('dois Combo Família com sabores diferentes são duas linhas', () => {
        const { addItem } = useCartStore.getState()
        addItem(linha('c1', FAMILIA, 1, 199, { escolhas: [{ grupoId: 'g', produtoId: 'dl', quantidade: 6 }] }))
        addItem(linha('c2', FAMILIA, 1, 199, { escolhas: [{ grupoId: 'g', produtoId: 'coco', quantidade: 6 }] }))
        expect(useCartStore.getState().items).toHaveLength(2)
    })

    it('mexer em uma linha de combo não mexe na outra', () => {
        const { addItem } = useCartStore.getState()
        addItem(linha('c1', FAMILIA, 1, 199))
        addItem(linha('c2', FAMILIA, 1, 199))
        useCartStore.getState().updateQuantity('c2', 3)
        useCartStore.getState().trocarEscolhas('c1', [{ grupoId: 'g', produtoId: 'milho', quantidade: 6 }])
        useCartStore.getState().removeItem('c2')
        const { items } = useCartStore.getState()
        expect(items).toHaveLength(1)
        expect(items[0].chave).toBe('c1')
        expect(items[0].escolhas?.[0].produtoId).toBe('milho')
    })
})

describe('precificar', () => {
    it('reprecifica as linhas pela tabela que está valendo, sem mexer no store', () => {
        const { addItem } = useCartStore.getState()
        addItem(linha('balde', BALDE, 2, 65))
        addItem(linha('c1', FAMILIA, 1, 199))
        const noCartao = precificar(useCartStore.getState().items, (p) => PRECOS[p.id].cartao)
        expect(noCartao.map((i) => i.subtotal)).toEqual([136, 206])
        // O carrinho continua com o que tinha: a escolha é do vendedor.
        expect(useCartStore.getState().items.map((i) => i.subtotal)).toEqual([130, 199])
    })

    it('subtotal em centavos exatos', () => {
        const [l] = precificar([linha('x', produto('x', 26.33), 3, 26.33)], () => 26.33)
        expect(l.subtotal).toBe(78.99)
    })

    it('setTabela só troca a escolha', () => {
        useCartStore.getState().setTabela('cartao')
        expect(useCartStore.getState().tabela).toBe('cartao')
    })
})

describe('carrinho salvo antes de 30/10 (v0)', () => {
    it('ganha chave = produto_id e tabela pix, sem perder item', () => {
        const migrate = useCartStore.persist.getOptions().migrate
        expect(migrate).toBeDefined()
        const antigo = { items: [{ produto_id: 'balde', quantidade: 2, preco_unitario: 75, subtotal: 150, produto: BALDE }], cliente: null, idempotencyKey: 'k' }
        const novo = migrate!(antigo, 0) as { items: CartItem[]; tabela: string; idempotencyKey: string }
        expect(novo.items[0].chave).toBe('balde')
        expect(novo.items[0].quantidade).toBe(2)
        expect(novo.tabela).toBe('pix')
        expect(novo.idempotencyKey).toBe('k')
    })
})
