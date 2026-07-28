import { describe, it, expect } from 'vitest'
import { temperaturaCliente, TEMPERATURA_ORDEM, type RitmoCliente } from './temperaturaCliente'

// Helper: monta um ritmo (subset da kanban row) só com o que o util lê.
function ritmo(p: Partial<RitmoCliente>): RitmoCliente {
    return {
        total_pedidos: 5,
        intervalo_medio: 20,
        atraso: -3,
        sumido: false,
        dias_sem_compra: 10,
        ...p,
    } as RitmoCliente
}

describe('temperaturaCliente', () => {
    it('null/undefined → novo', () => {
        expect(temperaturaCliente(null).estado).toBe('novo')
        expect(temperaturaCliente(undefined).estado).toBe('novo')
    })

    it('0 compras → novo', () => {
        expect(temperaturaCliente(ritmo({ total_pedidos: 0 })).estado).toBe('novo')
    })

    it('1 compra → novo (ritmo se formando)', () => {
        const r = temperaturaCliente(ritmo({ total_pedidos: 1, intervalo_medio: null, atraso: null }))
        expect(r.estado).toBe('novo')
        expect(r.motivo).toContain('1ª compra')
    })

    it('≥2 compras + sumido → frio (mesmo com atraso alto)', () => {
        expect(temperaturaCliente(ritmo({ sumido: true, atraso: 40 })).estado).toBe('frio')
    })

    it('≥2 compras + atraso < 0 (dentro do ciclo) → quente', () => {
        expect(temperaturaCliente(ritmo({ atraso: -3, sumido: false })).estado).toBe('quente')
    })

    it('atraso = 0 (no dia esperado) → morno', () => {
        expect(temperaturaCliente(ritmo({ atraso: 0, sumido: false })).estado).toBe('morno')
    })

    it('atraso > 0 e não-sumido → morno', () => {
        const r = temperaturaCliente(ritmo({ atraso: 8, intervalo_medio: 20, sumido: false }))
        expect(r.estado).toBe('morno')
        expect(r.motivo).toContain('8d')
    })

    it('guard: ≥2 compras mas sem intervalo/atraso → novo', () => {
        expect(temperaturaCliente(ritmo({ total_pedidos: 3, intervalo_medio: null, atraso: null })).estado).toBe('novo')
    })

    it('ordem: frio antes de morno antes de quente antes de novo', () => {
        expect(TEMPERATURA_ORDEM.frio).toBeLessThan(TEMPERATURA_ORDEM.morno)
        expect(TEMPERATURA_ORDEM.morno).toBeLessThan(TEMPERATURA_ORDEM.quente)
        expect(TEMPERATURA_ORDEM.quente).toBeLessThan(TEMPERATURA_ORDEM.novo)
    })
})
