import { hashField, normalizePhone, splitName } from '@mont/shared'
import { z } from 'zod'
import type { Atribuicao } from './origem'

/**
 * API de Conversões da Meta, pelo servidor da loja (InitiateCheckout e Lead).
 *
 * Mesma normalização do `meta-capi-worker` e do catálogo antigo (`@mont/shared`): telefone na
 * forma do WhatsApp, nome sem acento partido em fn/ln, tudo com SHA-256. `fbp`/`fbc` vão crus.
 * O `event_id` é o mesmo do evento do navegador (GTM), e a Meta deduplica os dois.
 *
 * `META_TEST_EVENT_CODE` (opcional, só fora de produção): manda para "Testar eventos". ⚠️ Se o
 * código não bater com uma sessão ATIVA dessa aba, a Meta processa o evento como REAL (blueprint
 * §10.3). Em produção (`VERCEL_ENV=production`) ele é ignorado.
 */

const VERSAO_GRAPH = 'v21.0'

export type EventoSite = 'InitiateCheckout' | 'Lead'

export interface EnvioSite {
    evento: EventoSite
    eventId: string
    /** Página onde aconteceu, sem query string. */
    url: string
    atribuicao: Atribuicao
    ip: string | null
    userAgent: string
    pessoa?: { telefone: string; nome: string }
    dados: Record<string, unknown>
    /** Segundos desde 1970. */
    instante: number
}

/** O evento no formato da Meta. */
export async function montarEventoSite(e: EnvioSite) {
    const { fn, ln } = splitName(e.pessoa?.nome)
    const user_data: Record<string, string | string[]> = { client_user_agent: e.userAgent }
    if (e.ip) user_data.client_ip_address = e.ip
    if (e.atribuicao.fbp) user_data.fbp = e.atribuicao.fbp
    if (e.atribuicao.fbc) user_data.fbc = e.atribuicao.fbc
    const ph = await hashField(normalizePhone(e.pessoa?.telefone))
    if (ph) user_data.ph = ph
    const fnHash = await hashField(fn)
    if (fnHash) user_data.fn = fnHash
    const lnHash = await hashField(ln)
    if (lnHash) user_data.ln = lnHash

    return {
        event_name: e.evento,
        event_time: e.instante,
        event_id: e.eventId,
        action_source: 'website' as const,
        event_source_url: e.url,
        user_data,
        custom_data: e.dados,
    }
}

const esquemaCredenciais = z.object({
    META_PIXEL_ID: z.string().regex(/^\d+$/),
    META_CAPI_TOKEN: z.string().min(1),
})

/** Envia e registra o resultado no log. Nunca lança: medição não pode derrubar o pedido. */
export async function enviarEventoSite(e: EnvioSite): Promise<void> {
    try {
        const credenciais = esquemaCredenciais.safeParse({
            META_PIXEL_ID: process.env.META_PIXEL_ID,
            META_CAPI_TOKEN: process.env.META_CAPI_TOKEN,
        })
        if (!credenciais.success) {
            console.warn('[meta-capi] META_PIXEL_ID/META_CAPI_TOKEN ausentes: evento não enviado', e.evento)
            return
        }
        const testEventCode =
            process.env.VERCEL_ENV === 'production' ? undefined : process.env.META_TEST_EVENT_CODE || undefined

        const resposta = await fetch(
            `https://graph.facebook.com/${VERSAO_GRAPH}/${credenciais.data.META_PIXEL_ID}/events`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: [await montarEventoSite(e)],
                    access_token: credenciais.data.META_CAPI_TOKEN,
                    ...(testEventCode ? { test_event_code: testEventCode } : {}),
                }),
                signal: AbortSignal.timeout(8000),
            },
        )
        const corpo: unknown = await resposta.json().catch(() => null)
        if (!resposta.ok) {
            console.error('[meta-capi] recusado', e.evento, e.eventId, resposta.status, JSON.stringify(corpo))
            return
        }
        console.log('[meta-capi] ok', e.evento, e.eventId, JSON.stringify(corpo), testEventCode ? '(teste)' : '')
    } catch (erro) {
        console.error('[meta-capi] falha', e.evento, e.eventId, erro)
    }
}
