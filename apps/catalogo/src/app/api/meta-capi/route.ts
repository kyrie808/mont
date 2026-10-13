import { NextRequest, NextResponse } from 'next/server'
import { hashField, normalizePhone, splitName } from '@mont/shared'

/**
 * Meta Conversions API (CAPI) Proxy Route
 * Recebe eventos do cliente, normaliza e higieniza dados sensíveis com SHA256 e envia para o Meta.
 *
 * A normalização é a MESMA do `meta-capi-worker` (`@mont/shared`): telefone com DDI 55 no
 * formato do WhatsApp, nome sem acento/pontuação partido em fn/ln. Antes o telefone ia
 * hasheado do jeito que foi digitado ("(11) 95555-0000") e nunca casava com ninguém.
 *
 * `META_TEST_EVENT_CODE` (opcional, só pra teste local): manda pro Test Events. ⚠️ Se o
 * código não bater com uma sessão ATIVA da aba "Testar eventos", a Meta processa o evento
 * como REAL e só avisa em `messages` — que esta rota devolve na resposta (blueprint §10.3).
 */

async function hashEmail(raw: string | undefined): Promise<string[] | undefined> {
    const email = raw?.trim().toLowerCase()
    return hashField(email || null)
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        console.log('[Meta CAPI] Received:', {
            event_name: body.event_name,
            event_id: body.event_id,
            has_fbp: !!body.user_data?.fbp,
            has_fbc: !!body.user_data?.fbc
        })

        const { event_name, event_id, event_time, user_data = {}, custom_data = {}, event_source_url } = body

        const PIXEL_ID = process.env.META_PIXEL_ID
        const ACCESS_TOKEN = process.env.META_CAPI_TOKEN
        const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || undefined

        if (!PIXEL_ID || !ACCESS_TOKEN) {
            console.error('[Meta CAPI] Missing environment variables')
            return NextResponse.json({ error: 'Configuração incompleta' }, { status: 500 })
        }

        // Extrai headers para user_data
        const forwarded = req.headers.get('x-forwarded-for')
        const ip = forwarded ? forwarded.split(',')[0].trim() : ''
        const userAgent = req.headers.get('user-agent') || ''

        // `fn` pode chegar com o nome completo; splitName parte e normaliza (o `ln`
        // explícito, quando vier, é concatenado pra não perder sobrenome).
        const nome = [user_data.fn, user_data.ln].filter(Boolean).join(' ')
        const { fn, ln } = splitName(nome)

        const metaUserData = {
            em: await hashEmail(user_data.em),
            ph: await hashField(normalizePhone(user_data.ph)),
            fn: await hashField(fn),
            ln: await hashField(ln),
            client_ip_address: ip,
            client_user_agent: userAgent,
            fbp: user_data.fbp,
            fbc: user_data.fbc
        }

        const payload = {
            data: [{
                event_name,
                event_time: event_time || Math.floor(Date.now() / 1000),
                event_id,
                action_source: 'website',
                event_source_url: event_source_url || req.headers.get('referer') || '',
                user_data: metaUserData,
                custom_data
            }],
            ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {})
        }

        const response = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...payload,
                access_token: ACCESS_TOKEN
            }),
        })

        const result = await response.json()

        if (!response.ok) {
            console.error('[Meta CAPI Error]', result)
            return NextResponse.json({ error: 'Erro ao enviar para o Meta', details: result }, { status: response.status })
        }

        console.log('[Meta CAPI] Success:', {
            event_name,
            event_id,
            meta_status: response.status,
            meta_response: result
        })

        return NextResponse.json({
            success: true,
            fbtrace_id: result.fbtrace_id,
            events_received: result.events_received,
            test_mode: !!TEST_EVENT_CODE,
            // Aviso de sessão de teste inativa vem aqui — ver o cabeçalho.
            ...(result.messages ? { messages: result.messages } : {})
        })

    } catch (error) {
        console.error('[Meta CAPI Internal Error]', error)
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
    }
}
