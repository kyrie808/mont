/**
 * Parsing do webhook da Evolution API + chave canônica de WhatsApp.
 *
 * Mora aqui (e não dentro da Edge Function) pelo mesmo motivo de `metaNormalize.ts`:
 * é a única pasta que o runtime Deno da função E o Vitest do interno alcançam. Sem
 * dependências — código puro, testável sem banco e sem rede.
 */

// ─── Chave canônica ───────────────────────────────────────────────────────────

/**
 * Telefone BR → forma canônica de WhatsApp: `55` + DDD + 9 dígitos (13 no total).
 * Retorna `null` quando não é um celular brasileiro válido.
 *
 * ⚠️ ESPELHO EXATO da função SQL `public.fn_telefone_wa`, que alimenta a coluna
 * gerada `contatos.telefone_wa`. Se as duas divergirem, o ingestor casa um contato
 * que o banco considera outro — e nascem duplicatas. Mudou uma, muda a outra.
 *
 * NÃO confundir com `normalizePhone` (metaNormalize), que serve pro hash da Meta e
 * trata o número de 10 dígitos de forma diferente — lá é outro sistema, outra regra.
 */
export function telefoneWa(raw: string | null | undefined): string | null {
    if (!raw) return null
    const digitos = raw.replace(/\D/g, '')
    if (!digitos) return null

    // Tira o DDI só quando o resto sobra com tamanho nacional plausível. Um número
    // de 10/11 dígitos que por acaso comece com 55 é DDD 55 (RS) e fica intacto.
    const nac =
        (digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')
            ? digitos.slice(2)
            : digitos

    const ddd = nac.slice(0, 2)
    if (!/^(1[1-9]|[2-9][0-9])$/.test(ddd)) return null
    const assinante = nac.slice(2)

    // Celular com 9 dígitos sempre começa em 9.
    if (nac.length === 11) return assinante.startsWith('9') ? `55${nac}` : null

    // 8 dígitos começando em 6-9 = celular antigo, cadastrado antes do 9º dígito.
    // Começando em 2-5 é telefone fixo, que não existe no WhatsApp.
    if (nac.length === 10) return /^[6-9]/.test(assinante) ? `55${ddd}9${assinante}` : null

    return null
}

/** JID da Evolution (`5511999999999@s.whatsapp.net`) → forma canônica, ou null. */
export function telefoneWaDeJid(jid: string | null | undefined): string | null {
    if (!jid) return null
    // O JID pode vir com sufixo de device (`:12@`) e com o domínio.
    return telefoneWa(jid.split('@')[0].split(':')[0])
}

/**
 * `true` quando o JID não é conversa 1:1 com cliente: grupo (`@g.us`), lista de
 * transmissão/status (`@broadcast`), newsletter/canal. Essas não entram no CRM.
 */
export function isJidIgnorado(jid: string | null | undefined): boolean {
    if (!jid) return true
    return (
        jid.endsWith('@g.us') ||
        jid.includes('@broadcast') ||
        jid.endsWith('@newsletter') ||
        jid === 'status@broadcast'
    )
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoMidia =
    | 'texto' | 'audio' | 'imagem' | 'video'
    | 'documento' | 'sticker' | 'localizacao' | 'contato' | 'outro'

export interface MensagemNormalizada {
    messageId: string
    telefoneWa: string
    direcao: 'entrada' | 'saida'
    conteudo: string | null
    tipoMidia: TipoMidia
    /** Atribuição de anúncio, quando encontrada. `null` na esmagadora maioria. */
    referral: Record<string, unknown> | null
    enviadaEm: string // ISO
    pushName: string | null
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Mapa messageType da Evolution → nosso vocabulário de `tipo_midia`. */
const MIDIA_POR_CHAVE: Record<string, TipoMidia> = {
    conversation: 'texto',
    extendedTextMessage: 'texto',
    audioMessage: 'audio',
    imageMessage: 'imagem',
    videoMessage: 'video',
    documentMessage: 'documento',
    documentWithCaptionMessage: 'documento',
    stickerMessage: 'sticker',
    locationMessage: 'localizacao',
    liveLocationMessage: 'localizacao',
    contactMessage: 'contato',
    contactsArrayMessage: 'contato',
}

function extrairTipoEConteudo(message: Json | undefined): { tipo: TipoMidia; conteudo: string | null } {
    if (!isObj(message)) return { tipo: 'outro', conteudo: null }

    if (typeof message.conversation === 'string') {
        return { tipo: 'texto', conteudo: message.conversation }
    }

    const ext = message.extendedTextMessage
    if (isObj(ext) && typeof ext.text === 'string') {
        return { tipo: 'texto', conteudo: ext.text }
    }

    for (const [chave, tipo] of Object.entries(MIDIA_POR_CHAVE)) {
        const node = message[chave]
        if (!isObj(node)) continue
        // Legenda é o que o cliente escreveu — vale mais que o nome do arquivo.
        const caption =
            typeof node.caption === 'string' ? node.caption
            : typeof node.fileName === 'string' ? node.fileName
            : typeof node.displayName === 'string' ? node.displayName
            : null
        return { tipo, conteudo: caption }
    }

    return { tipo: 'outro', conteudo: null }
}

/**
 * Procura a atribuição de anúncio em QUALQUER profundidade do payload.
 *
 * Busca ampla de propósito: o local exato desses campos é justamente o que ainda
 * não está provado. A Evolution já mudou a posição entre versões, o modo Cloud API
 * descarta o objeto (issue #2645) e a carga de histórico pode trazer num formato
 * diferente da mensagem ao vivo. Varrer o payload inteiro custa nada num objeto
 * desse tamanho e é o que impede de perder o clique — que não volta.
 */
export function extrairReferral(payload: unknown): Record<string, unknown> | null {
    const achado: Record<string, unknown> = {}

    const CHAVES_DIRETAS = new Set([
        'ctwaClid', 'ctwa_clid', 'sourceId', 'source_id', 'sourceUrl', 'source_url',
        'sourceType', 'source_type', 'conversionSource', 'conversionData',
        'entryPointConversionSource', 'entryPointConversionApp', 'ctwaPayload',
        'ctwaSignals', 'showAdAttribution', 'mediaType', 'headline', 'body',
    ])
    const CHAVES_OBJETO = new Set(['externalAdReply', 'referral', 'adReferral'])

    const visitados = new Set<unknown>()

    function anda(node: unknown, profundidade: number): void {
        if (profundidade > 12 || node === null || typeof node !== 'object') return
        if (visitados.has(node)) return // payloads da Evolution têm auto-referência
        visitados.add(node)

        if (Array.isArray(node)) {
            for (const item of node) anda(item, profundidade + 1)
            return
        }

        for (const [chave, valor] of Object.entries(node as Json)) {
            if (CHAVES_OBJETO.has(chave) && isObj(valor)) {
                Object.assign(achado, valor)
                achado[chave] = valor
            } else if (CHAVES_DIRETAS.has(chave) && valor !== null && valor !== undefined && valor !== '') {
                // Primeiro achado vence: o nível mais externo é o mais confiável.
                if (!(chave in achado)) achado[chave] = valor
            }
            anda(valor, profundidade + 1)
        }
    }

    anda(payload, 0)

    // `body`/`headline`/`mediaType` sozinhos são de citação de link comum, não de
    // anúncio. Só vale como referral se houver sinal real de Click-to-WhatsApp.
    const temSinalDeAnuncio =
        'ctwaClid' in achado || 'ctwa_clid' in achado ||
        'sourceId' in achado || 'source_id' in achado ||
        'externalAdReply' in achado || 'referral' in achado || 'adReferral' in achado ||
        achado.conversionSource === 'FB_Ads' ||
        achado.entryPointConversionSource === 'ctwa_ad' ||
        achado.showAdAttribution === true

    return temSinalDeAnuncio ? achado : null
}

/** Lê o ctwa_clid de um referral já extraído, aceitando as duas grafias. */
export function lerCtwaClid(referral: Record<string, unknown> | null): string | null {
    if (!referral) return null
    const v = referral.ctwaClid ?? referral.ctwa_clid
    return typeof v === 'string' && v.trim() !== '' ? v : null
}

/** Lê o id do anúncio (`source_id`) de um referral já extraído. */
export function lerSourceId(referral: Record<string, unknown> | null): string | null {
    if (!referral) return null
    const v = referral.sourceId ?? referral.source_id
    return typeof v === 'string' && v.trim() !== '' ? v : null
}

/** `messageTimestamp` vem como número, string ou Long (`{ low, high }`). */
function lerTimestamp(raw: unknown): string {
    let segundos: number | null = null

    if (typeof raw === 'number') segundos = raw
    else if (typeof raw === 'string' && /^\d+$/.test(raw)) segundos = Number(raw)
    else if (isObj(raw) && typeof raw.low === 'number') segundos = raw.low

    // Sem timestamp confiável, `now()` é melhor que descartar a mensagem.
    if (segundos === null || !Number.isFinite(segundos) || segundos <= 0) {
        return new Date().toISOString()
    }
    // Alguns caminhos entregam milissegundos.
    const ms = segundos > 1e11 ? segundos : segundos * 1000
    return new Date(ms).toISOString()
}

/**
 * Extrai a lista de mensagens cruas de um webhook da Evolution.
 *
 * `MESSAGES_UPSERT` traz uma mensagem em `data`; `MESSAGES_SET` (a carga de
 * histórico do pareamento) traz VÁRIAS — ora como array em `data`, ora em
 * `data.messages`. Tratar os dois formatos é obrigatório, senão o histórico entra
 * pela metade ou não entra.
 */
export function extrairMensagensCruas(body: unknown): Json[] {
    if (!isObj(body)) return []
    const data = body.data

    if (Array.isArray(data)) return data.filter(isObj)
    if (isObj(data)) {
        if (Array.isArray(data.messages)) return data.messages.filter(isObj)
        return [data]
    }
    return []
}

/**
 * Mensagem crua da Evolution → forma normalizada, ou `null` quando deve ser
 * ignorada (grupo, status, sem id, telefone não-canonizável).
 */
export function normalizarMensagem(crua: Json): MensagemNormalizada | null {
    const key = isObj(crua.key) ? crua.key : null
    if (!key) return null

    const jid = typeof key.remoteJid === 'string' ? key.remoteJid : null
    if (isJidIgnorado(jid)) return null

    const messageId = typeof key.id === 'string' && key.id ? key.id : null
    if (!messageId) return null

    const tel = telefoneWaDeJid(jid)
    if (!tel) return null

    const message = isObj(crua.message) ? crua.message : undefined
    const { tipo, conteudo } = extrairTipoEConteudo(message)

    return {
        messageId,
        telefoneWa: tel,
        direcao: key.fromMe === true ? 'saida' : 'entrada',
        conteudo,
        tipoMidia: tipo,
        referral: extrairReferral(crua),
        enviadaEm: lerTimestamp(crua.messageTimestamp),
        pushName: typeof crua.pushName === 'string' && crua.pushName ? crua.pushName : null,
    }
}
