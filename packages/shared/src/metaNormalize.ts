/**
 * Normalização + hashing das chaves de match para a Meta Conversions API (CAPI).
 * Fonte única, sem dependências — usado pelo worker (Deno Edge Function) e testado
 * por unit tests no interno (jsdom). Spec Meta: trim → lowercase → SHA-256 hex.
 *
 * `crypto.subtle` é global tanto no Deno quanto no Node 20+ (usado no Vitest).
 *
 * ⚠️ `normalizePhone` NÃO mora aqui — mora em `whatsapp.ts`, porque depende da forma
 * canônica `telefoneWa` (a Meta precisa do telefone no mesmo formato que o WhatsApp
 * usa, senão o match falha). Este arquivo é mantido SEM imports relativos de
 * propósito: a Edge Function o importa direto por caminho, e o Deno exigiria
 * extensão `.ts` explícita — que o tsconfig do catálogo não aceita.
 */

export function stripAccents(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** nome → { fn: primeiro token, ln: resto }, lowercase, sem acento/pontuação. */
export function splitName(raw: string | null | undefined): { fn: string | null; ln: string | null } {
    if (!raw) return { fn: null, ln: null }
    const clean = stripAccents(raw)
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
    if (!clean) return { fn: null, ln: null }
    const parts = clean.split(' ')
    const fn = parts[0]
    const ln = parts.length > 1 ? parts.slice(1).join(' ') : null
    return { fn, ln }
}

/** cidade → minúscula, sem espaços/pontuação/acento. */
export function normalizeCity(raw: string | null | undefined): string | null {
    if (!raw) return null
    const clean = stripAccents(raw).toLowerCase().replace(/[^a-z0-9]/g, '')
    return clean || null
}

/** uf → 2 letras minúsculas. */
export function normalizeState(raw: string | null | undefined): string | null {
    if (!raw) return null
    const clean = stripAccents(raw).toLowerCase().replace(/[^a-z]/g, '')
    return clean ? clean.slice(0, 2) : null
}

/** cep → só dígitos. */
export function normalizeZip(raw: string | null | undefined): string | null {
    if (!raw) return null
    const digits = raw.replace(/\D/g, '')
    return digits || null
}

/** SHA-256 hex minúsculo de uma string. */
export async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/** Hasheia um campo já normalizado; retorna array (formato Meta) ou undefined se vazio. */
export async function hashField(value: string | null | undefined): Promise<string[] | undefined> {
    if (!value) return undefined
    return [await sha256Hex(value)]
}
