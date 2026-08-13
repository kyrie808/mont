import { describe, it, expect } from 'vitest'
import {
    calcularTempoDigitacaoMs,
    particionarResposta,
    humanoAssumiu,
    estaLiberado,
    type MensagemDaConversa,
} from '@mont/shared'

describe('calcularTempoDigitacaoMs', () => {
    // Âncora: estudo da Aalto (37 mil voluntários) = 36,2 wpm = 0,6 palavras/s.
    // Fator 0,45 porque quem atende comercialmente digita em rajada, não em lazer.
    const semJitter = () => 0.5 // devolve o meio da faixa: jitter neutro

    it('respeita o piso: resposta de 1 palavra não sai instantânea', () => {
        expect(calcularTempoDigitacaoMs('Oi', semJitter)).toBe(4000)
    })

    it('respeita o teto: resposta enorme não trava por meio minuto', () => {
        const texto = Array(200).fill('palavra').join(' ')
        expect(calcularTempoDigitacaoMs(texto, semJitter)).toBe(15000)
    })

    it('escala com o tamanho entre o piso e o teto', () => {
        // 10 palavras: 10 / 0,6 * 0,45 = 7,5s
        const texto = Array(10).fill('pao').join(' ')
        expect(calcularTempoDigitacaoMs(texto, semJitter)).toBe(7500)
    })

    it('aplica jitter de ±20% — duas respostas iguais nunca demoram igual', () => {
        const texto = Array(10).fill('pao').join(' ')
        expect(calcularTempoDigitacaoMs(texto, () => 0)).toBe(6000)   // -20%
        expect(calcularTempoDigitacaoMs(texto, () => 1)).toBe(9000)   // +20%
    })
})

describe('particionarResposta', () => {
    it('mantém resposta curta inteira', () => {
        expect(particionarResposta('Temos sim, R$ 25.')).toEqual(['Temos sim, R$ 25.'])
    })

    it('parte resposta longa em duas, quebrando entre frases', () => {
        const texto = 'Temos pão de queijo de 1kg por R$ 25. A entrega na sua região sai por R$ 5. Posso separar pra você?'
        const partes = particionarResposta(texto, 80)
        expect(partes.length).toBe(2)
        expect(partes.join(' ')).toBe(texto)
        expect(partes[0].endsWith('.')).toBe(true) // não corta no meio da frase
    })

    it('nunca devolve parte vazia', () => {
        expect(particionarResposta('   ', 60)).toEqual([])
    })
})

describe('humanoAssumiu', () => {
    // A mensagem da agente volta pelo webhook como fromMe=true, idêntica à dos 4
    // humanos que dividem a conta. Sem os ids dela, ela se calaria para sempre.
    const cliente = (id: string, em: string): MensagemDaConversa => ({ messageId: id, direcao: 'entrada', enviadaEm: em })
    const nos = (id: string, em: string): MensagemDaConversa => ({ messageId: id, direcao: 'saida', enviadaEm: em })

    it('humano falou depois do cliente → assumiu', () => {
        const msgs = [cliente('c1', '2026-08-13T10:00:00Z'), nos('h1', '2026-08-13T10:01:00Z')]
        expect(humanoAssumiu(msgs, new Set())).toBe(true)
    })

    it('quem falou depois foi a PRÓPRIA agente → não assumiu', () => {
        const msgs = [cliente('c1', '2026-08-13T10:00:00Z'), nos('a1', '2026-08-13T10:01:00Z')]
        expect(humanoAssumiu(msgs, new Set(['a1']))).toBe(false)
    })

    it('cliente falou por último → não assumiu, mesmo com humano antes', () => {
        const msgs = [
            nos('h1', '2026-08-13T10:00:00Z'),
            cliente('c1', '2026-08-13T10:05:00Z'),
        ]
        // Prioridade humana vale enquanto ele foi o ÚLTIMO. Aqui o cliente respondeu
        // depois, então a conversa voltou para a agente.
        expect(humanoAssumiu(msgs, new Set())).toBe(false)
    })

    it('conversa sem mensagem nossa → não assumiu', () => {
        expect(humanoAssumiu([cliente('c1', '2026-08-13T10:00:00Z')], new Set())).toBe(false)
    })

    it('conversa vazia → não assumiu', () => {
        expect(humanoAssumiu([], new Set())).toBe(false)
    })
})

describe('estaLiberado — a gaiola', () => {
    it('em dev, só número da allowlist passa', () => {
        expect(estaLiberado('5511934417085', ['5511934417085'], 'dev')).toBe(true)
        expect(estaLiberado('5511964911627', ['5511934417085'], 'dev')).toBe(false)
    })

    it('em produção, qualquer número passa', () => {
        expect(estaLiberado('5511964911627', ['5511934417085'], 'producao')).toBe(true)
    })

    it('allowlist vazia em dev bloqueia tudo — falha fechada', () => {
        expect(estaLiberado('5511934417085', [], 'dev')).toBe(false)
    })
})
