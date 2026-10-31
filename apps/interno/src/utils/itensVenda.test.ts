import { describe, it, expect } from 'vitest'
import { agruparItensVenda } from './itensVenda'
import type { DomainItemVenda } from '../types/domain'

function item(id: string, produtoId: string, subtotal: number, combo: [string, string] | null = null): DomainItemVenda {
    return {
        id, produtoId, quantidade: 1, precoUnitario: subtotal, subtotal,
        comboId: combo ? combo[0] : null, comboInstancia: combo ? combo[1] : null,
    }
}

describe('agruparItensVenda', () => {
    it('avulsos ficam uma linha cada; o combo vira um bloco com o total dele', () => {
        const blocos = agruparItensVenda([
            item('1', 'balde', 65),
            item('2', 'balde', 52.43, ['familia', 'a']),
            item('3', 'dl', 26.34, ['familia', 'a']),
            item('4', 'dl', 26.33, ['familia', 'a']),
        ])
        expect(blocos.map((b) => b.tipo)).toEqual(['avulso', 'combo'])
        const combo = blocos[1]
        expect(combo.tipo === 'combo' && combo.total).toBe(105.1)
        expect(combo.tipo === 'combo' && combo.itens).toHaveLength(3)
    })

    it('dois Combo Família na mesma venda são dois blocos', () => {
        const blocos = agruparItensVenda([
            item('1', 'balde', 52.43, ['familia', 'a']),
            item('2', 'balde', 52.43, ['familia', 'b']),
        ])
        expect(blocos).toHaveLength(2)
    })

    it('venda antiga, sem combo: igual a antes', () => {
        const blocos = agruparItensVenda([item('1', 'balde', 75), item('2', 'chipa', 40)])
        expect(blocos.every((b) => b.tipo === 'avulso')).toBe(true)
    })
})
