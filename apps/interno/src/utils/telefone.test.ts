import { describe, it, expect } from 'vitest'
import { normalizarTelefone, filtroBuscaContato } from './telefone'

describe('normalizarTelefone', () => {
    it('reduz qualquer máscara ao mesmo identificador', () => {
        const esperado = '11969791012'
        expect(normalizarTelefone('11969791012')).toBe(esperado)
        expect(normalizarTelefone('11 96979-1012')).toBe(esperado)
        expect(normalizarTelefone('(11) 96979-1012')).toBe(esperado)
        expect(normalizarTelefone('(11)96979-1012')).toBe(esperado)
        expect(normalizarTelefone(' 11 9 6979 1012 ')).toBe(esperado)
    })

    it('tolera vazio e nulo', () => {
        expect(normalizarTelefone('')).toBe('')
        expect(normalizarTelefone(null)).toBe('')
        expect(normalizarTelefone(undefined)).toBe('')
    })
})

describe('filtroBuscaContato', () => {
    it('busca telefone SEMPRE contra telefone_norm, não contra o texto cru', () => {
        // Este é o motivo de o Gilmar não achar o cliente e cadastrar duplicado:
        // antes o filtro era `telefone.ilike.%(11) 96979-1012%` e não casava nada.
        const filtro = filtroBuscaContato('(11) 96979-1012')
        expect(filtro).toContain('telefone_norm.ilike.%11969791012%')
        expect(filtro).not.toContain('telefone.ilike')
    })

    it('acha pelo número solto, sem DDD', () => {
        expect(filtroBuscaContato('96979-1012')).toContain('telefone_norm.ilike.%969791012%')
    })

    it('busca por nome não gera cláusula de telefone', () => {
        const filtro = filtroBuscaContato('Beth')
        expect(filtro).toContain('nome.ilike.%Beth%')
        expect(filtro).toContain('apelido.ilike.%Beth%')
        expect(filtro).not.toContain('telefone_norm')
    })

    it('neutraliza caracteres que quebram o filtro do PostgREST', () => {
        const filtro = filtroBuscaContato('a%b_c,d)e(')
        expect(filtro).not.toContain('%b')
        expect(filtro).not.toContain('_c')
        expect(filtro).not.toContain(',d')
    })

    it('termo vazio não filtra nada', () => {
        expect(filtroBuscaContato('   ')).toBe('')
    })
})
