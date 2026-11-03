import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Descrição da seção (Parte B da paridade, 03/11/2026): frase sob o título da seção na loja,
 * editada na tela Catálogo. Camada unit: supabase mockado; o CHECK do banco está em
 * supabase/tests/loja_salvar_vitrine.sql (S6).
 */

const updateSpy = vi.fn()

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: () => ({
            update: (patch: unknown) => {
                updateSpy(patch)
                return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }
            },
        }),
    },
}))

import { secaoService } from '../secaoService'

describe('secaoService.updateSecao — descrição da seção', () => {
    beforeEach(() => updateSpy.mockClear())

    it('grava a descrição sem espaços nas pontas', async () => {
        await secaoService.updateSecao('s1', { descricao: '  Queijo Canastra de verdade. ' })
        expect(updateSpy.mock.calls[0][0]).toMatchObject({ descricao: 'Queijo Canastra de verdade.' })
    })

    it('descrição vazia vira NULL (sem frase na loja)', async () => {
        await secaoService.updateSecao('s1', { descricao: '   ' })
        expect(updateSpy.mock.calls[0][0]).toMatchObject({ descricao: null })
    })

    it('sem descrição no patch, não mexe nela', async () => {
        await secaoService.updateSecao('s1', { nome: 'Doces' })
        expect(updateSpy.mock.calls[0][0]).not.toHaveProperty('descricao')
    })

    it('recusa antes do banco: mais de 120 caracteres ou quebra de linha', async () => {
        await expect(secaoService.updateSecao('s1', { descricao: 'a'.repeat(121) })).rejects.toThrow(/120/)
        await expect(secaoService.updateSecao('s1', { descricao: 'duas\nlinhas' })).rejects.toThrow(/uma linha/)
        expect(updateSpy).not.toHaveBeenCalled()
    })
})
