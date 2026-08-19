import { describe, it, expect } from 'vitest'
import { precisaRevisao } from './filaRevisao'

describe('precisaRevisao — a fila "Novos da IA"', () => {
    it('contato cru da secretária entra na fila', () => {
        expect(precisaRevisao({ origemCadastro: 'whatsapp', revisadoEm: null })).toBe(true)
    })

    it('sai da fila assim que um humano salva (revisadoEm carimbado)', () => {
        expect(
            precisaRevisao({ origemCadastro: 'whatsapp', revisadoEm: '2026-08-19T22:03:59Z' }),
        ).toBe(false)
    })

    it('cadastro do catálogo NÃO entra: o cliente digitou nome e endereço reais', () => {
        expect(precisaRevisao({ origemCadastro: 'catalogo', revisadoEm: null })).toBe(false)
    })

    it('cadastro digitado no interno nunca entra', () => {
        expect(precisaRevisao({ origemCadastro: 'manual', revisadoEm: null })).toBe(false)
    })

    it('trata `revisadoEm` ausente como não revisado', () => {
        expect(precisaRevisao({ origemCadastro: 'whatsapp' })).toBe(true)
    })
})
