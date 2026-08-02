import { describe, it, expect } from 'vitest'
import { formatPhone } from '@mont/shared'
import { normalizarTelefone, filtroBuscaContato } from './telefone'

/**
 * `formatPhone` é a máscara única: usada tanto no input (enquanto digita)
 * quanto na exibição em lista/perfil. `packages/shared` não tem test runner,
 * então a cobertura mora aqui, que já consome o pacote.
 */
describe('formatPhone', () => {
    it('formata celular de 11 dígitos', () => {
        expect(formatPhone('11969791012')).toBe('(11) 96979-1012')
    })

    it('formata telefone FIXO de 10 dígitos com o split certo', () => {
        // Regressão: o escalonamento antigo assumia celular e devolvia
        // '(11) 33334-444'. Há 21 contatos de 10 dígitos na base.
        expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
    })

    it('aceita entrada parcial sem quebrar (digitação progressiva)', () => {
        expect(formatPhone('')).toBe('')
        expect(formatPhone('1')).toBe('1')
        expect(formatPhone('11')).toBe('11')
        expect(formatPhone('1196')).toBe('(11) 96')
        expect(formatPhone('119697')).toBe('(11) 9697')
        expect(formatPhone('1196979')).toBe('(11) 9697-9')
    })

    it('é idempotente sobre valor já formatado', () => {
        expect(formatPhone('(11) 96979-1012')).toBe('(11) 96979-1012')
    })

    it('capa em 11 dígitos e ignora lixo não numérico', () => {
        expect(formatPhone('11969791012999')).toBe('(11) 96979-1012')
        expect(formatPhone('abc11969791012')).toBe('(11) 96979-1012')
    })
})

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
