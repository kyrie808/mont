import { z } from 'zod'

const esquemaAmbiente = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^55\d{10,11}$/, 'Número no formato 55DDNNNNNNNNN'),
})

export type Ambiente = z.infer<typeof esquemaAmbiente>

let cache: Ambiente | null = null

export function ambiente(): Ambiente {
    if (cache) return cache
    const resultado = esquemaAmbiente.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    })
    if (!resultado.success) {
        const campos = resultado.error.issues.map((i) => i.path.join('.')).join(', ')
        throw new Error(`apps/loja: variáveis de ambiente inválidas ou ausentes (${campos}). Veja apps/loja/.env.local.`)
    }
    cache = resultado.data
    return cache
}

const esquemaAgoraSimulado = z.iso.datetime({ offset: true })

/**
 * Instante usado para decidir qual campanha vale.
 *
 * LOJA_AGORA simula o "agora" (ex.: 2026-11-05T10:00:00-03:00) para conferir a Black antes de 03/11,
 * no dev e nos previews da Vercel. Em produção (VERCEL_ENV=production) é ignorado SEMPRE — nem é lido —
 * e vale só o relógio.
 */
export function instanteDeReferencia(): Date {
    if (process.env.VERCEL_ENV === 'production') return new Date()
    const simulado = esquemaAgoraSimulado.safeParse(process.env.LOJA_AGORA)
    return simulado.success ? new Date(simulado.data) : new Date()
}
