import { describe, it, expect } from 'vitest'
import {
    normalizePhone,
    splitName,
    normalizeCity,
    normalizeState,
    normalizeZip,
    sha256Hex,
    hashField,
} from '@mont/shared'

/**
 * Unit (sem banco) das normalizações/hash das chaves de match da Meta CAPI.
 * Blueprint §7.1: vetores conhecidos por chave. Fonte: packages/shared/src/metaNormalize.ts.
 */

describe('normalizePhone (BR → DDI 55)', () => {
    it('celular nacional mascarado ganha DDI 55', () => {
        expect(normalizePhone('(11) 95555-0000')).toBe('5511955550000')
    })
    it('celular nacional só dígitos (11) ganha DDI 55', () => {
        expect(normalizePhone('11955550000')).toBe('5511955550000')
    })
    it('fixo nacional (10 dígitos) ganha DDI 55', () => {
        expect(normalizePhone('1155550000')).toBe('551155550000')
    })
    it('número que já tem DDI (13 dígitos) é mantido', () => {
        expect(normalizePhone('5511955550000')).toBe('5511955550000')
    })
    it('DDD 55 (RS) não é confundido com DDI — ganha 55 na frente', () => {
        // 55 (DDD) + 999998888 (9) = 11 dígitos nacional → 5555999998888
        expect(normalizePhone('55999998888')).toBe('5555999998888')
    })
    it('vazio/nulo → null', () => {
        expect(normalizePhone('')).toBeNull()
        expect(normalizePhone(null)).toBeNull()
        expect(normalizePhone('abc')).toBeNull()
    })
})

describe('splitName', () => {
    it('parte nome composto em fn + ln, sem acento/pontuação, minúsculo', () => {
        expect(splitName('José da Silva')).toEqual({ fn: 'jose', ln: 'da silva' })
    })
    it('nome único → ln null', () => {
        expect(splitName('Maria')).toEqual({ fn: 'maria', ln: null })
    })
    it('vazio → { null, null }', () => {
        expect(splitName(null)).toEqual({ fn: null, ln: null })
    })
})

describe('normalizeCity / normalizeState / normalizeZip', () => {
    it('cidade sem espaço/acento minúscula', () => {
        expect(normalizeCity('São Paulo')).toBe('saopaulo')
    })
    it('uf 2 letras minúsculas', () => {
        expect(normalizeState('SP')).toBe('sp')
        expect(normalizeState('sp')).toBe('sp')
    })
    it('cep só dígitos', () => {
        expect(normalizeZip('01310-100')).toBe('01310100')
    })
    it('vazios → null', () => {
        expect(normalizeCity(null)).toBeNull()
        expect(normalizeState('')).toBeNull()
        expect(normalizeZip(undefined)).toBeNull()
    })
})

describe('sha256Hex / hashField', () => {
    it('vetor conhecido de SHA-256', async () => {
        expect(await sha256Hex('test')).toBe(
            '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        )
        expect(await sha256Hex('a')).toBe(
            'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
        )
    })
    it('hashField retorna array de 1 hash', async () => {
        expect(await hashField('a')).toEqual([
            'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
        ])
    })
    it('hashField de vazio → undefined', async () => {
        expect(await hashField('')).toBeUndefined()
        expect(await hashField(null)).toBeUndefined()
    })
})
