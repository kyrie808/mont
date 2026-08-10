import { describe, it, expect } from 'vitest'
import {
    normalizePhone,
    splitName,
    normalizeCity,
    normalizeState,
    normalizeZip,
    sha256Hex,
    hashField,
    telefoneWa,
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

/**
 * Regressão: o hash do telefone precisa sair no MESMO formato que o WhatsApp usa,
 * senão a Meta não casa o evento com a pessoa e o Event Match Quality cai calado.
 *
 * O bug: `normalizePhone` só prefixava `55` em número de 10 dígitos, sem recompor
 * o 9º dígito. Um celular antigo cadastrado como `1181234567` ia pra Meta como
 * `551181234567`, mas o WhatsApp dessa pessoa é `5511981234567` — nunca casava.
 * 15 contatos da base nessa situação (1 evento já enviado torto).
 */
describe('normalizePhone — paridade com o formato do WhatsApp', () => {
    it('celular antigo de 10 dígitos recompõe o 9º dígito', () => {
        expect(normalizePhone('1181234567')).toBe('5511981234567')
        expect(normalizePhone('1161234567')).toBe('5511961234567')
    })

    it('concorda com telefoneWa em todo celular — são a mesma pessoa', () => {
        for (const entrada of ['11910049290', '(11) 96979-1012', '1181234567', '5511910049290']) {
            expect(normalizePhone(entrada)).toBe(telefoneWa(entrada))
        }
    })

    it('fixo NÃO ganha 9º dígito — continua E.164 válido', () => {
        // Casos reais: Amanda (4 vendas) e Cira (1 venda). Fixo não tem WhatsApp,
        // mas o número existe e a Meta ainda pode casar por ele.
        expect(normalizePhone('1148041265')).toBe('551148041265')
        expect(normalizePhone('1143359605')).toBe('551143359605')
    })

    it('placeholder não vira hash — mandar lixo só suja o match', () => {
        expect(normalizePhone('0000000000')).toBeNull() // "Mont Massas"
        expect(normalizePhone('999999924')).toBeNull() // 9 dígitos
        expect(normalizePhone('1101010101')).toBeNull() // assinante começa em 0
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
