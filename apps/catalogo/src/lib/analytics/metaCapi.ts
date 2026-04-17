/**
 * Client-side helper for Meta Conversions API (CAPI).
 * Envia eventos para a nossa API route que encaminha para o Meta.
 */

interface MetaUserData {
    em?: string; // email
    ph?: string; // phone
    fn?: string; // first name
    ln?: string; // last name
}

function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift()
    return undefined
}

/**
 * Envia um evento de conversão para o servidor (CAPI) de forma assíncrona.
 * Não bloqueia o fluxo principal da UI.
 */
export const sendServerEvent = (
    eventName: string,
    customData: Record<string, unknown> = {},
    userData: MetaUserData = {},
    eventId?: string
) => {
    try {
        if (typeof window === 'undefined') return

        const fbp = getCookie('_fbp')
        const fbc = getCookie('_fbc')

        const body = {
            event_name: eventName,
            event_id: eventId,
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: window.location.href,
            user_data: {
                ...userData,
                fbp,
                fbc
            },
            custom_data: customData
        }

        // Fire-and-forget: não usamos await para não atrasar redirecionamentos ou UI
        fetch('/api/meta-capi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).catch(err => {
            console.warn('[Meta CAPI] failed to send background event', err)
        })

    } catch (error) {
        // Falha no tracking não deve quebrar a experiência do usuário
        console.warn('[Meta CAPI] error preparing event', error)
    }
}
