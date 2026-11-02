// Ritmo das chamadas do analista ao LLM — lógica pura, sem import (lida também pelo Deno).
//
// O plano gratuito do Groq limita tokens por minuto (8K no gpt-oss-20b) e pedidos por
// minuto (30). Em vez de bater no limite e ler o 429, o analista se espaça: uma conversa por
// vez, um intervalo mínimo entre chamadas e, antes de cada uma, a conta dos tokens gastos no
// último minuto. O 429 ainda pode vir (outra rodada, estimativa curta): aí vale o retry-after.

export interface ChamadaRegistrada {
    /** Epoch ms da chamada. */
    em: number
    /** Tokens que ela consumiu (ou a estimativa, se a resposta não informou). */
    tokens: number
}

export interface PlanoLlm {
    /** Tokens por minuto do plano. */
    tpm: number
    /** Intervalo mínimo entre duas chamadas (60 000 / pedidos por minuto, com folga). */
    intervaloMinMs: number
}

const JANELA_MS = 60_000

/** ms a esperar antes de uma chamada que deve gastar `estimativa` tokens. */
export function esperaParaChamar(historico: ChamadaRegistrada[], agora: number, estimativa: number, plano: PlanoLlm): number {
    const recentes = historico.filter((c) => agora - c.em < JANELA_MS).sort((a, b) => a.em - b.em)
    const ultima = recentes[recentes.length - 1]
    const porIntervalo = ultima ? Math.max(0, ultima.em + plano.intervaloMinMs - agora) : 0

    let usados = recentes.reduce((s, c) => s + c.tokens, 0)
    const teto = Math.min(estimativa, plano.tpm)
    if (usados + teto <= plano.tpm) return porIntervalo

    // Libera as mais antigas até caber; espera a última liberada sair da janela.
    for (const c of recentes) {
        usados -= c.tokens
        if (usados + teto <= plano.tpm) return Math.max(porIntervalo, c.em + JANELA_MS - agora)
    }
    return porIntervalo
}

/** Header retry-after (segundos ou data HTTP) em ms; null se ausente ou ilegível. */
export function lerRetryAfterMs(valor: string | null, agora = Date.now()): number | null {
    if (!valor) return null
    const t = valor.trim()
    if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 1000)
    const data = Date.parse(t)
    return Number.isNaN(data) ? null : Math.max(0, data - agora)
}

/** "7.66s", "1m2.5s", "120ms" (x-ratelimit-reset-*) em ms; null se ilegível. */
export function lerDuracaoMs(valor: string | null): number | null {
    if (!valor) return null
    const m = valor.trim().match(/^(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?$/)
    if (!m || (!m[1] && !m[2] && !m[3])) return null
    return Math.round(Number(m[1] ?? 0) * 60_000 + Number(m[2] ?? 0) * 1000 + Number(m[3] ?? 0))
}
