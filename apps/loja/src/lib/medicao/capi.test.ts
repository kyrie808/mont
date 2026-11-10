import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { montarEventoSite, type EnvioSite } from './capi'

const sha = (v: string) => createHash('sha256').update(v).digest('hex')

const BASE: EnvioSite = {
    evento: 'Lead',
    eventId: 'lead_0b0c',
    url: 'https://loja.montdistribuidora.com.br/checkout/dados',
    atribuicao: { fbp: 'fb.1.1762169000000.123', fbc: 'fb.1.1762169000000.IwAR2', utm_source: 'facebook' },
    ip: '200.1.2.3',
    userAgent: 'Mozilla/5.0',
    pessoa: { telefone: '11987654321', nome: 'Maria da Silva', cep: '09750-000' },
    dados: { value: 65, currency: 'BRL' },
    instante: 1_762_170_000,
}

describe('montarEventoSite', () => {
    it('canal website, mesmo event_id, cookies crus e dado pessoal só em hash', async () => {
        const e = await montarEventoSite(BASE)
        expect(e).toMatchObject({
            event_name: 'Lead',
            event_id: 'lead_0b0c',
            action_source: 'website',
            event_source_url: BASE.url,
            event_time: 1_762_170_000,
            custom_data: { value: 65, currency: 'BRL' },
        })
        expect(e.user_data).toEqual({
            client_user_agent: 'Mozilla/5.0',
            client_ip_address: '200.1.2.3',
            fbp: 'fb.1.1762169000000.123',
            fbc: 'fb.1.1762169000000.IwAR2',
            // Telefone na forma do WhatsApp (55 + DDD + 9 dígitos), como o worker.
            ph: [sha('5511987654321')],
            fn: [sha('maria')],
            ln: [sha('da silva')],
            // CEP com os 8 dígitos, sem traço.
            zp: [sha('09750000')],
        })
        expect(JSON.stringify(e)).not.toMatch(/Maria|98765|09750|utm_source/)
    })

    it('CEP ausente ou inválido não vai', async () => {
        for (const cep of [null, undefined, '', '0975-00']) {
            const e = await montarEventoSite({ ...BASE, pessoa: { telefone: '11987654321', nome: 'Maria', cep } })
            expect(e.user_data).not.toHaveProperty('zp')
        }
    })

    it('InitiateCheckout sem pessoa nem cookies leva só o navegador', async () => {
        const e = await montarEventoSite({ ...BASE, evento: 'InitiateCheckout', pessoa: undefined, atribuicao: {}, ip: null })
        expect(e.user_data).toEqual({ client_user_agent: 'Mozilla/5.0' })
    })
})
