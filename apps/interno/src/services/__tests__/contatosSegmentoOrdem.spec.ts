import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { ordemDaGrade, ORDEM_PADRAO_CONTATOS } from '../contatosSegmentoService'

describe('ordemDaGrade (grade de Clientes → ordem da consulta)', () => {
    it('coluna ordenável vira a ordem da consulta, com a direção', () => {
        expect(ordemDaGrade([{ id: 'nome', desc: false }])).toEqual({ coluna: 'nome', desc: false })
        expect(ordemDaGrade([{ id: 'temperatura', desc: true }])).toEqual({ coluna: 'temperatura', desc: true })
        expect(ordemDaGrade([{ id: 'ultimaCompra', desc: false }])).toEqual({ coluna: 'ultimaCompra', desc: false })
    })

    it('sem ordenação (3º clique no cabeçalho) = ordem de cadastro, mais novos primeiro, como antes', () => {
        expect(ordemDaGrade([])).toEqual(ORDEM_PADRAO_CONTATOS)
        expect(ORDEM_PADRAO_CONTATOS).toEqual({ coluna: 'criadoEm', desc: true })
    })

    it('coluna que não ordena (telefone, cidade, ações) cai na ordem padrão', () => {
        expect(ordemDaGrade([{ id: 'telefone', desc: false }])).toEqual(ORDEM_PADRAO_CONTATOS)
        expect(ordemDaGrade([{ id: 'acoes', desc: true }])).toEqual(ORDEM_PADRAO_CONTATOS)
    })
})
