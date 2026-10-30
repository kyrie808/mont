import { z } from 'zod'

const esquemaAmbiente = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^55\d{10,11}$/, 'Número no formato 55DDNNNNNNNNN'),
    // Só fora de produção: simula o "agora" para conferir a campanha antes de ela começar.
    LOJA_AGORA: z.iso.datetime({ offset: true }).optional(),
})

export type Ambiente = z.infer<typeof esquemaAmbiente>

let cache: Ambiente | null = null

export function ambiente(): Ambiente {
    if (cache) return cache
    const resultado = esquemaAmbiente.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
        LOJA_AGORA: process.env.LOJA_AGORA || undefined,
    })
    if (!resultado.success) {
        const campos = resultado.error.issues.map((i) => i.path.join('.')).join(', ')
        throw new Error(`apps/loja: variáveis de ambiente inválidas ou ausentes (${campos}). Veja apps/loja/.env.local.`)
    }
    cache = resultado.data
    return cache
}

/**
 * Instante usado para decidir qual campanha vale. Em produção é sempre o relógio.
 * Fora dela, LOJA_AGORA permite ver a Black antes de 03/11 (ex.: 2026-11-05T10:00:00-03:00).
 */
export function instanteDeReferencia(): Date {
    const { LOJA_AGORA } = ambiente()
    if (process.env.NODE_ENV !== 'production' && LOJA_AGORA) return new Date(LOJA_AGORA)
    return new Date()
}
