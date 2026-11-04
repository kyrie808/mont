import { z } from 'zod'

/**
 * De onde a pessoa veio (UTMs + fbclid do anúncio) e os cookies do pixel da Meta.
 *
 * A pessoa chega com `?utm_source=…&fbclid=…` na home e só envia o pedido duas telas depois,
 * quando a URL já não tem nada disso. Então a entrada fica guardada no aparelho e vai junto com
 * o pedido (cat_pedidos), para o Purchase da entrega sair ligado ao anúncio.
 *
 * Nada aqui é dado pessoal: são parâmetros de campanha e identificadores de clique.
 */

export const CHAVE_ORIGEM = 'mont-loja:origem'

/** A Meta atribui clique em até 7 dias; depois disso a origem guardada não vale mais. */
export const VALIDADE_ORIGEM_MS = 7 * 24 * 3_600_000

const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

const textoCurto = z.string().trim().min(1).max(200)
const fbclid = z.string().regex(/^[A-Za-z0-9_.-]{1,500}$/)

const esquemaOrigem = z.object({
    utm_source: textoCurto.optional(),
    utm_medium: textoCurto.optional(),
    utm_campaign: textoCurto.optional(),
    utm_content: textoCurto.optional(),
    utm_term: textoCurto.optional(),
    fbclid: fbclid.optional(),
    /** Quando a pessoa chegou com esses parâmetros (ms). */
    em: z.number().int().positive(),
})

export type Origem = z.infer<typeof esquemaOrigem>

/** Parâmetros de campanha da URL de entrada; null quando ela não traz nenhum. */
export function origemDaUrl(busca: string, agora: number): Origem | null {
    const params = new URLSearchParams(busca)
    const bruta: Record<string, string | number> = { em: agora }
    for (const chave of UTMS) {
        const valor = params.get(chave)?.trim()
        if (valor) bruta[chave] = valor.slice(0, 200)
    }
    const clique = params.get('fbclid')?.trim()
    if (clique && fbclid.safeParse(clique).success) bruta.fbclid = clique
    if (Object.keys(bruta).length === 1) return null
    const lida = esquemaOrigem.safeParse(bruta)
    return lida.success ? lida.data : null
}

/** A origem guardada, se ainda estiver dentro dos 7 dias. */
export function interpretarOrigem(bruto: string | null, agora: number): Origem | null {
    try {
        const lida = esquemaOrigem.safeParse(JSON.parse(bruto ?? 'null'))
        if (!lida.success || agora - lida.data.em > VALIDADE_ORIGEM_MS) return null
        return lida.data
    } catch {
        return null
    }
}

export function lerCookie(cookies: string, nome: string): string | undefined {
    for (const parte of cookies.split(';')) {
        const [chave, ...resto] = parte.trim().split('=')
        if (chave === nome) return decodeURIComponent(resto.join('='))
    }
    return undefined
}

/** Cookies do pixel da Meta, no formato fb.<sub>.<ms>.<id>. */
const FORMATO_FBP = /^fb\.\d\.\d{10,13}\.\d+$/
const FORMATO_FBC = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_.-]+$/

export interface Atribuicao {
    fbp?: string
    fbc?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
}

/**
 * O que vai com o pedido e com os eventos do servidor.
 *
 * `fbc`: o cookie `_fbc` do pixel; sem ele (pixel bloqueado, ou o cookie ainda não foi gravado),
 * montado do fbclid guardado no formato da Meta, com o instante da chegada.
 */
export function atribuicaoDe(cookies: string, origem: Origem | null): Atribuicao {
    const atribuicao: Atribuicao = {}
    const fbp = lerCookie(cookies, '_fbp')
    if (fbp && FORMATO_FBP.test(fbp)) atribuicao.fbp = fbp
    const fbc = lerCookie(cookies, '_fbc')
    if (fbc && FORMATO_FBC.test(fbc)) atribuicao.fbc = fbc
    else if (origem?.fbclid) atribuicao.fbc = `fb.1.${origem.em}.${origem.fbclid}`
    if (origem) {
        for (const chave of UTMS) {
            const valor = origem[chave]
            if (valor) atribuicao[chave] = valor
        }
    }
    return atribuicao
}

/** Esquema do que chega ao servidor (vem do navegador: não confiar). */
export const esquemaAtribuicao = z.object({
    fbp: z.string().regex(FORMATO_FBP).max(100).optional(),
    fbc: z.string().regex(FORMATO_FBC).max(600).optional(),
    utm_source: textoCurto.optional(),
    utm_medium: textoCurto.optional(),
    utm_campaign: textoCurto.optional(),
    utm_content: textoCurto.optional(),
    utm_term: textoCurto.optional(),
})

// ── Navegador ──────────────────────────────────────────────────────────────────

/** Na chegada: guarda a origem quando a URL traz campanha (a mais recente vence). */
export function guardarOrigemDaUrl(): void {
    try {
        const origem = origemDaUrl(window.location.search, Date.now())
        if (origem) localStorage.setItem(CHAVE_ORIGEM, JSON.stringify(origem))
    } catch {
        // Armazenamento bloqueado (aba anônima de alguns navegadores): segue sem origem.
    }
}

export function atribuicaoAtual(): Atribuicao {
    let origem: Origem | null = null
    try {
        origem = interpretarOrigem(localStorage.getItem(CHAVE_ORIGEM), Date.now())
    } catch {
        origem = null
    }
    return atribuicaoDe(document.cookie, origem)
}
