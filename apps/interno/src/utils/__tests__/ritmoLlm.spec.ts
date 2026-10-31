import { describe, it, expect } from 'vitest'
import { esperaParaChamar, lerRetryAfterMs, lerDuracaoMs } from '@mont/shared'

/**
 * Ritmo das chamadas do analista ao LLM (31/10/2026): uma conversa por vez, espaçadas, sem
 * passar dos tokens por minuto do plano. No 429, vale o retry-after.
 */

const T = 1_800_000_000_000
const PLANO = { tpm: 8000, intervaloMinMs: 2100 }

describe('esperaParaChamar', () => {
    it('sem histórico, chama na hora', () => {
        expect(esperaParaChamar([], T, 2000, PLANO)).toBe(0)
    })

    it('respeita o intervalo mínimo entre duas chamadas', () => {
        expect(esperaParaChamar([{ em: T - 500, tokens: 100 }], T, 100, PLANO)).toBe(1600)
    })

    it('espera a chamada mais antiga sair da janela de 1 min quando o orçamento não cabe', () => {
        const hist = [{ em: T - 50_000, tokens: 4000 }, { em: T - 20_000, tokens: 3000 }]
        // 7000 na janela + 2000 > 8000: precisa liberar a de 4000, que sai em 10 s.
        expect(esperaParaChamar(hist, T, 2000, PLANO)).toBe(10_000)
    })

    it('o que já saiu da janela de 1 min não conta', () => {
        const hist = [{ em: T - 61_000, tokens: 7900 }]
        expect(esperaParaChamar(hist, T, 2000, PLANO)).toBe(0)
    })

    it('estimativa maior que o plano inteiro: espera a janela esvaziar', () => {
        const hist = [{ em: T - 30_000, tokens: 100 }]
        expect(esperaParaChamar(hist, T, 9000, PLANO)).toBe(30_000)
    })
})

describe('lerRetryAfterMs', () => {
    it('segundos (inteiro ou decimal)', () => {
        expect(lerRetryAfterMs('3')).toBe(3000)
        expect(lerRetryAfterMs('1.5')).toBe(1500)
    })

    it('data HTTP', () => {
        expect(lerRetryAfterMs('Sat, 31 Oct 2026 06:30:10 GMT', Date.parse('Sat, 31 Oct 2026 06:30:00 GMT'))).toBe(10_000)
    })

    it('ausente ou ilegível: null', () => {
        expect(lerRetryAfterMs(null)).toBeNull()
        expect(lerRetryAfterMs('logo')).toBeNull()
    })
})

describe('lerDuracaoMs (x-ratelimit-reset-*)', () => {
    it('formatos do Groq', () => {
        expect(lerDuracaoMs('7.66s')).toBe(7660)
        expect(lerDuracaoMs('1m2.5s')).toBe(62_500)
        expect(lerDuracaoMs('120ms')).toBe(120)
        expect(lerDuracaoMs(null)).toBeNull()
    })
})
