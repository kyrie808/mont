/**
 * Meta Conversions API — decisão de canal e montagem do evento.
 *
 * Mora aqui pelo mesmo motivo de `metaNormalize.ts`: é a única pasta que o runtime Deno
 * do `meta-capi-worker` E o Vitest do interno alcançam. Sem imports relativos de
 * propósito (o Deno exigiria extensão `.ts`, que o tsconfig do catálogo recusa).
 *
 * ── Por que o canal é decidido AQUI, no envio, e não no banco ────────────────────
 * Os triggers de `meta_eventos` gravavam `business_messaging` para todo contato com
 * `ctwa_clid`, e a Meta recusava 100% deles: erro 100, subcode 2804063, "parâmetro de
 * canal de mensagens ausente". Evento de WhatsApp com essa origem exige
 * `messaging_channel: 'whatsapp'` e `user_data.whatsapp_business_account_id` — o WABA,
 * que só existe com a API oficial. A Mont usa o WhatsApp Business app pela Evolution.
 *
 * `physical_store` funciona e aceita o `ctwa_clid` no `user_data` (39 de 39 reenviados
 * assim em 13/10/2026). Então o trigger só registra o fato, e quem decide o canal é quem
 * sabe se o WABA existe: o worker, pelo segredo `META_WABA_ID`.
 */

export type CanalMeta = 'business_messaging' | 'physical_store'

/** Chaves de match já normalizadas e hasheadas (formato Meta: array de hex). */
export interface UserDataBase {
    ph?: string[]
    fn?: string[]
    ln?: string[]
    ct?: string[]
    st?: string[]
    zip?: string[]
    external_id?: string[]
}

export interface UserDataMeta extends UserDataBase {
    /** Cru, sem hash — a Meta casa o clique pelo valor exato. */
    ctwa_clid?: string
    whatsapp_business_account_id?: string
}

export interface EventoFila {
    evento: string
    event_id: string
    /** ISO, como vem do Postgres. */
    event_time: string
    valor: number | null
    moeda: string
}

export interface EventoMeta {
    event_name: string
    event_time: number
    event_id: string
    action_source: CanalMeta
    messaging_channel?: 'whatsapp'
    user_data: UserDataMeta
    custom_data: Record<string, unknown>
}

/**
 * `business_messaging` só com clid E WABA. Faltando qualquer um, `physical_store` —
 * que é o que a Meta aceita hoje.
 */
export function escolherCanal(
    ctwaClid: string | null | undefined,
    wabaId: string | null | undefined,
): CanalMeta {
    return ctwaClid && wabaId ? 'business_messaging' : 'physical_store'
}

export function montarEvento(
    ev: EventoFila,
    base: UserDataBase,
    ctwaClid: string | null | undefined,
    canal: CanalMeta,
    wabaId: string | null | undefined,
): EventoMeta {
    const user_data: UserDataMeta = { ...base }
    if (ctwaClid) user_data.ctwa_clid = ctwaClid

    const evento: EventoMeta = {
        event_name: ev.evento,
        event_time: Math.floor(new Date(ev.event_time).getTime() / 1000),
        event_id: ev.event_id,
        action_source: canal,
        user_data,
        custom_data:
            ev.evento === 'Purchase'
                ? { value: Number(ev.valor ?? 0), currency: ev.moeda || 'BRL', content_type: 'product' }
                : {},
    }

    if (canal === 'business_messaging') {
        // Montar sem um dos dois é exatamente o payload que a Meta recusava. Melhor
        // estourar aqui do que mandar e descobrir no `resposta_meta` dias depois.
        if (!ctwaClid || !wabaId) {
            throw new Error('business_messaging exige ctwa_clid e WABA — use escolherCanal()')
        }
        evento.messaging_channel = 'whatsapp'
        user_data.whatsapp_business_account_id = wabaId
    }

    return evento
}

/** Códigos de limite de taxa da Graph API — passam sozinhos se esperar. */
const CODIGOS_LIMITE_DE_TAXA = new Set([1, 2, 4, 17, 341])

/**
 * `true` quando vale tentar de novo amanhã com o MESMO payload; `false` quando a Meta
 * recusou o conteúdo — aí o worker troca para `physical_store` na hora.
 *
 * `httpStatus` nulo = a requisição nem completou (rede, JSON inválido).
 */
export function erroTransitorio(httpStatus: number | null, corpo: unknown): boolean {
    if (httpStatus === null) return true
    if (httpStatus >= 500 || httpStatus === 429) return true

    if (typeof corpo !== 'object' || corpo === null || !('error' in corpo)) return false
    const erro = corpo.error
    if (typeof erro !== 'object' || erro === null) return false

    if ('is_transient' in erro && erro.is_transient === true) return true
    return 'code' in erro && typeof erro.code === 'number' && CODIGOS_LIMITE_DE_TAXA.has(erro.code)
}

/**
 * Lê o filtro `{ "event_ids": [...] }` do corpo da chamada ao worker.
 *
 * Qualquer coisa fora de uma lista não vazia de strings não vazias vira `null` — e no
 * modo teste `null` faz o worker RECUSAR a rodada, nunca processar a fila inteira. É o
 * que impede uma venda real de ir parar no Test Events (e nunca chegar à produção).
 */
export function lerEventIds(corpo: unknown): string[] | null {
    if (typeof corpo !== 'object' || corpo === null || !('event_ids' in corpo)) return null
    const ids: unknown = corpo.event_ids
    if (!Array.isArray(ids) || ids.length === 0) return null
    return ids.every((id): id is string => typeof id === 'string' && id !== '') ? ids : null
}
