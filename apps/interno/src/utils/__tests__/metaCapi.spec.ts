import { describe, it, expect } from 'vitest'
import { escolherCanal, montarEvento, erroTransitorio, lerEventIds } from '@mont/shared'

/**
 * Unit (sem banco) da decisão de canal da Meta CAPI. Fonte: packages/shared/src/metaCapi.ts.
 *
 * O bug que isto fecha: os triggers gravavam `business_messaging` para todo contato com
 * `ctwa_clid`, e a Meta recusava 100% deles (erro 100, subcode 2804063, "parâmetro de
 * canal de mensagens ausente") — esse canal exige `messaging_channel` e o WABA, que a
 * Mont não tem (WhatsApp Business app via Evolution, sem API oficial).
 */

const WABA = '123456789012345'
const CLID = 'ARAkLkA8rmlFeiCktEJQ-QTwRiyYHAFDLMNDBH0CD3qpjd0HR4irJ6LEkR7JwFF4XvnO2E4Nx0-eM-GABDLOPaOdRMv-_zfUQ2a'

const BASE = {
    ph: ['hash-telefone'],
    fn: ['hash-nome'],
    ct: ['hash-cidade'],
    external_id: ['hash-id'],
}

const LEAD = {
    evento: 'Lead',
    event_id: 'lead_abc',
    event_time: '2026-10-13T12:00:00.000Z',
    valor: null,
    moeda: 'BRL',
}

const PURCHASE = {
    evento: 'Purchase',
    event_id: 'venda_xyz',
    event_time: '2026-10-13T12:00:00.000Z',
    valor: 157.5,
    moeda: 'BRL',
}

describe('escolherCanal', () => {
    it('sem WABA vai physical_store, mesmo com clid (o caso da Mont hoje)', () => {
        expect(escolherCanal(CLID, null)).toBe('physical_store')
        expect(escolherCanal(CLID, undefined)).toBe('physical_store')
        expect(escolherCanal(CLID, '')).toBe('physical_store')
    })

    it('sem clid vai physical_store, mesmo com WABA', () => {
        expect(escolherCanal(null, WABA)).toBe('physical_store')
        expect(escolherCanal('', WABA)).toBe('physical_store')
    })

    it('só com clid E WABA vai business_messaging', () => {
        expect(escolherCanal(CLID, WABA)).toBe('business_messaging')
    })
})

describe('montarEvento', () => {
    it('physical_store leva o clid cru no user_data e nenhum campo de mensagem', () => {
        const e = montarEvento(LEAD, BASE, CLID, 'physical_store', null)

        expect(e.action_source).toBe('physical_store')
        expect(e).not.toHaveProperty('messaging_channel')
        expect(e.user_data).toEqual({ ...BASE, ctwa_clid: CLID })
        expect(e.user_data).not.toHaveProperty('whatsapp_business_account_id')
        expect(e.event_name).toBe('Lead')
        expect(e.event_id).toBe('lead_abc')
        expect(e.event_time).toBe(Math.floor(Date.parse(LEAD.event_time) / 1000))
        expect(e.custom_data).toEqual({})
    })

    it('physical_store sem clid não inventa a chave', () => {
        const e = montarEvento(LEAD, BASE, null, 'physical_store', null)
        expect(e.user_data).toEqual(BASE)
    })

    it('business_messaging leva messaging_channel e o WABA — o que faltava no erro 2804063', () => {
        const e = montarEvento(LEAD, BASE, CLID, 'business_messaging', WABA)

        expect(e.action_source).toBe('business_messaging')
        expect(e.messaging_channel).toBe('whatsapp')
        expect(e.user_data).toEqual({ ...BASE, ctwa_clid: CLID, whatsapp_business_account_id: WABA })
    })

    it('business_messaging sem WABA é erro de programação, não payload torto', () => {
        expect(() => montarEvento(LEAD, BASE, CLID, 'business_messaging', null)).toThrow()
        expect(() => montarEvento(LEAD, BASE, null, 'business_messaging', WABA)).toThrow()
    })

    it('Purchase leva valor e moeda no custom_data, em qualquer canal', () => {
        for (const canal of ['physical_store', 'business_messaging'] as const) {
            const e = montarEvento(PURCHASE, BASE, CLID, canal, WABA)
            expect(e.custom_data).toEqual({ value: 157.5, currency: 'BRL', content_type: 'product' })
        }
    })

    it('Purchase com valor nulo vai 0, não NaN', () => {
        const e = montarEvento({ ...PURCHASE, valor: null }, BASE, null, 'physical_store', null)
        expect(e.custom_data).toEqual({ value: 0, currency: 'BRL', content_type: 'product' })
    })

    it('não muta o user_data base (o fallback reaproveita o mesmo objeto)', () => {
        const base = { ...BASE }
        montarEvento(LEAD, base, CLID, 'business_messaging', WABA)
        expect(base).toEqual(BASE)
    })
})

describe('erroTransitorio', () => {
    // Formato real do erro que motivou a correção.
    const ERRO_CANAL = {
        error: {
            message: 'Invalid parameter',
            type: 'OAuthException',
            code: 100,
            error_subcode: 2804063,
            is_transient: false,
            fbtrace_id: 'Axyz',
        },
    }

    it('erro 2804063 é definitivo: dispara o fallback', () => {
        expect(erroTransitorio(400, ERRO_CANAL)).toBe(false)
    })

    it('qualquer 4xx sem sinal de passageiro é definitivo', () => {
        expect(erroTransitorio(400, { error: { code: 100 } })).toBe(false)
        expect(erroTransitorio(400, {})).toBe(false)
        expect(erroTransitorio(400, null)).toBe(false)
    })

    it('falha de rede (sem status) é passageira', () => {
        expect(erroTransitorio(null, null)).toBe(true)
    })

    it('5xx e 429 são passageiros', () => {
        expect(erroTransitorio(500, {})).toBe(true)
        expect(erroTransitorio(503, null)).toBe(true)
        expect(erroTransitorio(429, {})).toBe(true)
    })

    it('a Meta marcando is_transient manda mais que o status', () => {
        expect(erroTransitorio(400, { error: { code: 100, is_transient: true } })).toBe(true)
    })

    it('limite de taxa da Graph API (1, 2, 4, 17, 341) é passageiro', () => {
        for (const code of [1, 2, 4, 17, 341]) {
            expect(erroTransitorio(400, { error: { code } })).toBe(true)
        }
    })
})

describe('lerEventIds', () => {
    it('sem corpo ou sem a chave → null (rodada normal do cron)', () => {
        expect(lerEventIds(null)).toBeNull()
        expect(lerEventIds({})).toBeNull()
        expect(lerEventIds('texto')).toBeNull()
    })

    it('lista de strings não vazias passa', () => {
        expect(lerEventIds({ event_ids: ['lead_a', 'venda_b'] })).toEqual(['lead_a', 'venda_b'])
    })

    it('lista vazia, não-lista ou item inválido → null (não vira "todos")', () => {
        expect(lerEventIds({ event_ids: [] })).toBeNull()
        expect(lerEventIds({ event_ids: 'lead_a' })).toBeNull()
        expect(lerEventIds({ event_ids: ['lead_a', 3] })).toBeNull()
        expect(lerEventIds({ event_ids: ['lead_a', ''] })).toBeNull()
    })
})
