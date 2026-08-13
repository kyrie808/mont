/**
 * Lógica pura da secretária de WhatsApp.
 *
 * Mora em `packages/shared` pelo mesmo motivo de `whatsapp.ts`: é a única pasta que o
 * runtime Deno da Edge Function E o Vitest do interno alcançam. Sem dependências.
 */

/** Palavras por segundo. Estudo da Aalto: 36,2 wpm em celular ÷ 60. */
const PALAVRAS_POR_SEGUNDO = 0.6
/** Atendimento comercial digita em rajada, não em ritmo de conversa de lazer. */
const FATOR_COMERCIAL = 0.45
const PISO_MS = 4000
const TETO_MS = 15000
const JITTER = 0.2

/**
 * Tempo de "digitando…" proporcional ao tamanho da resposta.
 *
 * Piso e teto existem por realismo: sem piso, uma resposta de uma palavra sairia
 * instantânea (denuncia robô); sem teto, uma resposta longa passaria de meio minuto
 * digitando, o que não parece humano — parece travado.
 *
 * `aleatorio` é injetável para o teste conseguir fixar o jitter.
 */
export function calcularTempoDigitacaoMs(texto: string, aleatorio: () => number = Math.random): number {
    const palavras = texto.trim().split(/\s+/).filter(Boolean).length
    if (palavras === 0) return PISO_MS

    const base = (palavras / PALAVRAS_POR_SEGUNDO) * FATOR_COMERCIAL * 1000
    const limitado = Math.min(Math.max(base, PISO_MS), TETO_MS)

    // aleatorio() ∈ [0,1] → multiplicador ∈ [1-JITTER, 1+JITTER]
    const fator = 1 - JITTER + aleatorio() * (2 * JITTER)
    return Math.round(limitado * fator)
}

/**
 * Parte resposta longa em mensagens separadas, quebrando ENTRE frases.
 *
 * Ninguém manda um parágrafo de seis linhas de uma vez no WhatsApp; manda duas
 * mensagens com uma pausa. É a assinatura mais humana do aplicativo.
 */
export function particionarResposta(texto: string, maxPorParte = 180): string[] {
    const limpo = texto.trim()
    if (!limpo) return []
    if (limpo.length <= maxPorParte) return [limpo]

    const frases = limpo.match(/[^.!?]+[.!?]*\s*/g) ?? [limpo]
    const partes: string[] = []
    let atual = ''

    for (const frase of frases) {
        if (atual && (atual + frase).trim().length > maxPorParte) {
            partes.push(atual.trim())
            atual = frase
        } else {
            atual += frase
        }
    }
    if (atual.trim()) partes.push(atual.trim())

    return partes
}

export interface MensagemDaConversa {
    messageId: string
    direcao: 'entrada' | 'saida'
    enviadaEm: string
}

/**
 * `true` quando um humano da equipe falou por último — e a agente deve calar.
 *
 * A sutileza que justifica `wa_envios`: a mensagem que a própria agente envia volta
 * pelo webhook com `direcao: 'saida'`, IDÊNTICA à de qualquer um dos quatro humanos que
 * dividem a conta. Sem o conjunto de ids dela, ela leria a própria fala como "humano
 * assumiu" e se calaria para sempre na primeira resposta que desse.
 *
 * A prioridade vale enquanto o humano foi o ÚLTIMO a falar: se o cliente respondeu
 * depois dele, a conversa volta para a agente.
 */
export function humanoAssumiu(msgs: MensagemDaConversa[], idsDaAgente: Set<string>): boolean {
    if (msgs.length === 0) return false

    const ordenadas = [...msgs].sort(
        (a, b) => new Date(a.enviadaEm).getTime() - new Date(b.enviadaEm).getTime(),
    )
    const ultima = ordenadas[ordenadas.length - 1]

    return ultima.direcao === 'saida' && !idsDaAgente.has(ultima.messageId)
}

/**
 * A gaiola. Em `dev` só a allowlist recebe mensagem.
 *
 * Falha FECHADA de propósito: allowlist vazia bloqueia tudo. O mesmo mecanismo do modo
 * sombra do ingestor, que impediu milhares de contatos-lixo quando o WhatsApp migrou
 * para LID.
 */
export function estaLiberado(telefoneWa: string, allowlist: string[], modo: 'dev' | 'producao'): boolean {
    if (modo === 'producao') return true
    return allowlist.includes(telefoneWa)
}
