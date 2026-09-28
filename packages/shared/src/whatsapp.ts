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
 * É também a base do `normalizePhone` logo abaixo (hash da Meta), para que banco,
 * WhatsApp e CAPI enxerguem a mesma pessoa no mesmo formato.
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

/**
 * Telefone BR → dígitos com DDI 55 pro hash da Meta CAPI, no MESMO formato que o
 * WhatsApp usa.
 *
 * Mora aqui, e não em `metaNormalize.ts`, porque depende de `telefoneWa` — e é
 * exatamente essa dependência que é o ponto: a Meta casa a pessoa pelo hash do
 * telefone, então mandar um formato que o aparelho dela não usa faz o evento não
 * casar e o Event Match Quality cair sem avisar.
 *
 * O bug que isso corrige: um celular antigo cadastrado com 10 dígitos
 * (`1181234567`) saía como `551181234567`, mas o WhatsApp da pessoa é
 * `5511981234567` — faltava recompor o 9º dígito. 15 contatos da base nessa
 * situação, 1 evento já enviado torto.
 *
 * Fixo (assinante em 2-5) NÃO ganha o 9: não tem WhatsApp, mas o número existe e
 * segue sendo E.164 válido pra Meta tentar casar por ele.
 *
 * Placeholder (`0000000000`, `999999924`) vira `null` de propósito — hash de número
 * inventado não casa com ninguém e só suja a qualidade do match.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null
    const digits = raw.replace(/\D/g, '')
    if (!digits) return null

    // Celular: forma canônica de 13 dígitos, idêntica à do banco e à do WhatsApp.
    const celular = telefoneWa(digits)
    if (celular) return celular

    // Fixo nacional: DDD válido + 8 dígitos começando em 2-5.
    const nacional =
        (digits.length === 12 || digits.length === 13) && digits.startsWith('55')
            ? digits.slice(2)
            : digits

    if (
        nacional.length === 10 &&
        /^(1[1-9]|[2-9][0-9])$/.test(nacional.slice(0, 2)) &&
        /^[2-5]/.test(nacional.slice(2))
    ) {
        return `55${nacional}`
    }

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
    let dentroDeObjetoDeAtribuicao = false

    // Só ESTES campos são copiados, e só se forem escalares. O primeiro referral real
    // capturado em produção (11/08/2026) gravou 43 KB porque a versão anterior copiava
    // o `externalAdReply` inteiro — que carrega `thumbnail` em base64. Guardar miniatura
    // de anúncio não serve pra nada e multiplica o custo por mensagem.
    const CHAVES = new Set([
        'ctwaClid', 'ctwa_clid', 'sourceId', 'source_id', 'sourceUrl', 'source_url',
        'sourceType', 'source_type', 'conversionSource', 'entryPointConversionSource',
        'entryPointConversionApp', 'ctwaSignals', 'showAdAttribution', 'headline', 'title',
    ])
    // A presença destes objetos já é sinal de atribuição, mesmo que o conteúdo varie.
    const OBJETOS_DE_ATRIBUICAO = new Set(['externalAdReply', 'referral', 'adReferral'])

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
            if (OBJETOS_DE_ATRIBUICAO.has(chave) && isObj(valor)) {
                dentroDeObjetoDeAtribuicao = true
            } else if (CHAVES.has(chave) && !(chave in achado)) {
                // Escalar só: nada de objeto, array ou binário entra no jsonb.
                const escalar = typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean'
                if (escalar && valor !== '') achado[chave] = valor
            }
            anda(valor, profundidade + 1)
        }
    }

    anda(payload, 0)

    // `headline`/`title` sozinhos são de citação de link comum, não de anúncio.
    // Só vale como referral se houver sinal real de origem externa.
    const temSinal =
        dentroDeObjetoDeAtribuicao ||
        'ctwaClid' in achado || 'ctwa_clid' in achado ||
        'sourceId' in achado || 'source_id' in achado ||
        typeof achado.conversionSource === 'string' ||
        typeof achado.entryPointConversionSource === 'string' ||
        achado.showAdAttribution === true

    return temSinal ? achado : null
}

/**
 * `true` só quando a origem é anúncio PAGO.
 *
 * Distinção descoberta com dado real: em 11/08/2026 a primeira atribuição capturada em
 * produção veio de um POST orgânico do Facebook com botão de CTA
 * (`conversionSource: 'FB_Post'`, `entryPointConversionSource: 'post_cta'`, sem clid),
 * de uma cliente que já existia na base como `origem: 'direto'`.
 *
 * Tratar isso como anúncio reescreveria a origem dela e enfileiraria um Lead na CAPI
 * por causa de tráfego orgânico — sujando exatamente o dado de aquisição que este
 * projeto existe para limpar. O referral orgânico é guardado (é informação boa: sabemos
 * que ela veio de um post), mas não vira `origem = 'anuncio'`.
 */
export function isAnuncioPago(referral: Record<string, unknown> | null): boolean {
    if (!referral) return false
    if (lerCtwaClid(referral)) return true
    return (
        referral.conversionSource === 'FB_Ads' ||
        referral.entryPointConversionSource === 'ctwa_ad' ||
        referral.sourceType === 'ad'
    )
}

/**
 * `true` quando a atribuição de anúncio pode ser gravada num contato QUE JÁ EXISTE.
 *
 * **Nenhuma origem é neutra — nunca sobrescreve.** Decisão do diretor em 20/08/2026,
 * em duas etapas. A primeira veio do caso da Najla: trazida pelo Rodrigo da Daniele e
 * cliente no mesmo dia; se clicar num anúncio amanhã, sobrescrever `origem='anuncio'`
 * apagaria quem de fato a trouxe.
 *
 * A segunda etapa desfez a premissa da primeira. Esta função já tratou `'direto'` como
 * balde neutro ("não sabemos de onde veio") — está errado: **`'direto'` é a venda que
 * nasce da atitude do Gilmar de prospectar**. É uma declaração como qualquer outra, e um
 * anúncio que o cliente veja depois não apaga o trabalho dele.
 *
 * Sobram duas, e nenhuma delas é declaração de gente:
 *
 * - `'anuncio'` não muda história nenhuma — só COMPLETA o `ctwa_clid` de quem já era de
 *   anúncio (os 62 leads que o Luccas cadastrou à mão nunca tiveram um).
 * - `'whatsapp'` é o palpite do PRÓPRIO ingestor, gravado quando um estranho aparece na
 *   conversa sem referral. Corrigir o próprio palpite quando o clique de anúncio enfim
 *   chega não apaga trabalho de ninguém — é o único lugar onde a atribuição realmente
 *   acrescenta informação.
 *
 * Isto vale só pro caminho de UPDATE. Contato NOVO que chega clicando num anúncio pago
 * continua nascendo `origem='anuncio'` — ali não há declaração nenhuma pra preservar.
 *
 * Não é preciosismo: `rpt_campanhas_roas_mensal` atribui receita pela coluna
 * `contatos.campanha_id`, então uma venda do Gilmar viraria receita de uma campanha que
 * não a trouxe. O referral nunca se perde — fica gravado em `mensagens_whatsapp.referral`,
 * mesma regra já usada pro referral orgânico.
 */
export function podeGravarAtribuicao(
    origemAtual: string | null | undefined,
    jaTemClid: boolean,
): boolean {
    // O primeiro clique é o que a Meta atribui; regravar apagaria a origem verdadeira.
    if (jaTemClid) return false
    return origemAtual === 'anuncio' || origemAtual === 'whatsapp'
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
 *
 * `telefoneForcado` existe por causa do LID: na carga de histórico o `remoteJid` vem
 * como `269466768244766@lid`, um id opaco do qual NÃO dá pra derivar telefone. Quem
 * resolve essa tradução é o resgatador (que enxerga a Evolution e correlaciona por
 * timestamp); aqui a gente só aceita o telefone já resolvido. Sem isso, a mensagem
 * histórica seria descartada — foi o que aconteceu com as 6.098 do pareamento.
 */
export function normalizarMensagem(crua: Json, telefoneForcado?: string | null): MensagemNormalizada | null {
    const key = isObj(crua.key) ? crua.key : null
    if (!key) return null

    const jid = typeof key.remoteJid === 'string' ? key.remoteJid : null
    // Grupo/status ficam de fora mesmo com telefone forçado: não são conversa 1:1.
    if (isJidIgnorado(jid)) return null

    const messageId = typeof key.id === 'string' && key.id ? key.id : null
    if (!messageId) return null

    const tel = telefoneForcado ?? telefoneWaDeJid(jid)
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
