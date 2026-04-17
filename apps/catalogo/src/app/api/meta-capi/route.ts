import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Meta Conversions API (CAPI) Proxy Route
 * Recebe eventos do cliente, higieniza dados sensíveis com SHA256 e envia para o Meta.
 */

function hashData(data: string | undefined): string[] {
    if (!data) return []
    const cleanData = data.trim().toLowerCase()
    return [crypto.createHash('sha256').update(cleanData).digest('hex')]
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

        if (!PIXEL_ID || !ACCESS_TOKEN) {
            console.error('[Meta CAPI] Missing environment variables')
            return NextResponse.json({ error: 'Configuração incompleta' }, { status: 500 })
        }

        // Extrai headers para user_data
        const forwarded = req.headers.get('x-forwarded-for')
        const ip = forwarded ? forwarded.split(',')[0].trim() : ''
        const userAgent = req.headers.get('user-agent') || ''

        // Prepara dados do usuário com hashing SHA256 conforme requisitos do Meta
        const metaUserData = {
            em: hashData(user_data.em),
            ph: hashData(user_data.ph),
            fn: hashData(user_data.fn),
            ln: hashData(user_data.ln),
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
            }]
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

        return NextResponse.json({ success: true, fbtrace_id: result.fbtrace_id })

    } catch (error) {
        console.error('[Meta CAPI Internal Error]', error)
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
    }
}
