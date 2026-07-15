import { describe, it, expect } from 'vitest'
import { classificarContato, SEGMENTO_CONFIG } from './segmentoCliente'
import type { ContatoResumo } from '../hooks/useContatosResumo'

const hoje = new Date('2026-07-15T12:00:00')

// Contato "cliente comum" (o tipo/status stored não deve mandar no funil, exceto fornecedor)
const contato = { tipo: 'B2C' as const, status: 'cliente' as const }

// Helper: data N dias atrás de `hoje`, no formato 'YYYY-MM-DD'
function diasAtras(n: number): string {
    const d = new Date(hoje)
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
}

function resumo(compras: number, gasto: number, ultimaDiasAtras: number): ContatoResumo {
    return { totalCompras: compras, totalGasto: gasto, ultimaCompra: diasAtras(ultimaDiasAtras) }
}

describe('classificarContato', () => {
    it('sem resumo (0 compras) → lead', () => {
        expect(classificarContato(contato, undefined, hoje)).toBe('lead')
    })

    it('resumo com totalCompras=0 → lead', () => {
        expect(classificarContato(contato, resumo(0, 0, 0), hoje)).toBe('lead')
    })

    it('fornecedor por tipo → fornecedor (mesmo com compras)', () => {
        expect(classificarContato({ tipo: 'FORNECEDOR', status: 'cliente' }, resumo(9, 900, 1), hoje)).toBe('fornecedor')
    })

    it('fornecedor por status → fornecedor', () => {
        expect(classificarContato({ tipo: 'B2C', status: 'fornecedor' }, resumo(1, 50, 1), hoje)).toBe('fornecedor')
    })

    describe('Inativo — recência > 90 dias', () => {
        it('exatamente 90 dias ainda é ativo (cliente)', () => {
            expect(classificarContato(contato, resumo(2, 120, SEGMENTO_CONFIG.inativoDias), hoje)).toBe('cliente')
        })

        it('91 dias → inativo', () => {
            expect(classificarContato(contato, resumo(2, 120, SEGMENTO_CONFIG.inativoDias + 1), hoje)).toBe('inativo')
        })

        it('recência vence VIP: comprador ≥7 mas parou há >90d → inativo', () => {
            expect(classificarContato(contato, resumo(9, 900, 120), hoje)).toBe('inativo')
        })
    })

    describe('VIP — ativo E (≥7 compras OU ≥R$500)', () => {
        it('7ª compra ativa → vip (fronteira de frequência)', () => {
            expect(classificarContato(contato, resumo(SEGMENTO_CONFIG.vipMinCompras, 100, 10), hoje)).toBe('vip')
        })

        it('6 compras e gasto baixo, ativo → cliente (abaixo das duas réguas)', () => {
            expect(classificarContato(contato, resumo(6, 300, 10), hoje)).toBe('cliente')
        })

        it('R$500 gastos com poucas compras, ativo → vip (fronteira de gasto)', () => {
            expect(classificarContato(contato, resumo(3, SEGMENTO_CONFIG.vipMinGasto, 10), hoje)).toBe('vip')
        })

        it('R$499 com poucas compras, ativo → cliente', () => {
            expect(classificarContato(contato, resumo(3, SEGMENTO_CONFIG.vipMinGasto - 1, 10), hoje)).toBe('cliente')
        })
    })

    it('comprador ativo comum (2 compras, ticket normal) → cliente', () => {
        expect(classificarContato(contato, resumo(2, 130, 20), hoje)).toBe('cliente')
    })
})
