import { describe, it, expect } from 'vitest'
import {
    calcularTempoDigitacaoMs,
    particionarResposta,
    humanoAssumiu,
    estaLiberado,
    pedidoVigente,
    type IntencaoRegistrada,
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

    // A janela é relativa ao "agora", então todo caso que depende dela fixa o relógio.
    const agora = new Date('2026-08-13T10:02:00Z')

    it('humano falou depois do cliente → assumiu', () => {
        const msgs = [cliente('c1', '2026-08-13T10:00:00Z'), nos('h1', '2026-08-13T10:01:00Z')]
        expect(humanoAssumiu(msgs, new Set(), agora)).toBe(true)
    })

    it('quem falou depois foi a PRÓPRIA agente → não assumiu', () => {
        const msgs = [cliente('c1', '2026-08-13T10:00:00Z'), nos('a1', '2026-08-13T10:01:00Z')]
        expect(humanoAssumiu(msgs, new Set(['a1']), agora)).toBe(false)
    })

    it('cliente voltou a falar, mas o humano atendeu há pouco → ainda é dele', () => {
        const msgs = [
            nos('h1', '2026-08-13T10:00:00Z'),
            cliente('c1', '2026-08-13T10:05:00Z'),
        ]
        // Regra ANTIGA olhava só quem falou por último, então bastava o cliente
        // escrever de novo para a agente atropelar o atendimento em curso. Quem pegou
        // a conversa fica com ela por uma janela de tempo.
        expect(humanoAssumiu(msgs, new Set(), new Date('2026-08-13T10:06:00Z'))).toBe(true)
    })

    it('humano atendeu há muito tempo → a conversa volta para a agente', () => {
        const msgs = [
            nos('h1', '2026-08-13T10:00:00Z'),
            cliente('c1', '2026-08-13T14:00:00Z'),
        ]
        // Sem expirar, um atendimento humano de terça calaria a agente para sempre.
        expect(humanoAssumiu(msgs, new Set(), new Date('2026-08-13T14:01:00Z'))).toBe(false)
    })

    it('a janela conta a fala do HUMANO, não a da agente', () => {
        const msgs = [
            nos('h1', '2026-08-13T10:00:00Z'), // humano, fora da janela
            nos('a1', '2026-08-13T13:59:00Z'), // agente, dentro — não conta
            cliente('c1', '2026-08-13T14:00:00Z'),
        ]
        expect(humanoAssumiu(msgs, new Set(['a1']), new Date('2026-08-13T14:01:00Z'))).toBe(false)
    })

    it('janela é configurável', () => {
        const msgs = [
            nos('h1', '2026-08-13T10:00:00Z'),
            cliente('c1', '2026-08-13T10:40:00Z'),
        ]
        const t = new Date('2026-08-13T10:41:00Z')
        expect(humanoAssumiu(msgs, new Set(), t, 60 * 60 * 1000)).toBe(true)
        expect(humanoAssumiu(msgs, new Set(), t, 10 * 60 * 1000)).toBe(false)
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

describe('pedidoVigente', () => {
    // Nasceu de um defeito em produção (21/08): o cliente pediu "2 kg de pão de queijo"
    // e a agente respondeu "4 kg + 1 kg de chipa". Ela não alucinou — SOMOU com o pedido
    // do dia anterior, porque o contexto dela são as últimas 30 mensagens, sem data.
    // A correção é parar de fazê-la deduzir o pedido do histórico: a função entrega o
    // pedido vigente como FATO, e ela só modifica esse fato.
    const intencao = (id: string, resumo: string, em: string): IntencaoRegistrada => ({ id, resumo, em })

    it('pedido dentro da janela → é o pedido vigente', () => {
        const msgs = [intencao('i1', '2 kg de pão de queijo', '2026-08-20T20:51:00Z')]
        expect(pedidoVigente(msgs, new Date('2026-08-20T21:30:00Z'))?.resumo).toBe('2 kg de pão de queijo')
    })

    it('pedido de ONTEM → não é vigente (o bug do "4 kg")', () => {
        const msgs = [intencao('i1', '2 kg de pão de queijo + 1 kg de chipa', '2026-08-20T20:51:00Z')]
        // 22 horas depois: é outro pedido, não a continuação daquele.
        expect(pedidoVigente(msgs, new Date('2026-08-21T18:47:00Z'))).toBeNull()
    })

    it('vários dentro da janela → vale o mais recente', () => {
        const msgs = [
            intencao('i1', '2 kg de pão de queijo', '2026-08-21T18:47:00Z'),
            intencao('i2', '2 kg de pão de queijo + 1 kg de chipa', '2026-08-21T18:49:00Z'),
        ]
        expect(pedidoVigente(msgs, new Date('2026-08-21T18:50:00Z'))?.id).toBe('i2')
    })

    it('ordem de chegada não importa', () => {
        const msgs = [
            intencao('i2', 'mais novo', '2026-08-21T18:49:00Z'),
            intencao('i1', 'mais velho', '2026-08-21T18:47:00Z'),
        ]
        expect(pedidoVigente(msgs, new Date('2026-08-21T18:50:00Z'))?.id).toBe('i2')
    })

    it('sem pedido nenhum → null', () => {
        expect(pedidoVigente([], new Date('2026-08-21T18:50:00Z'))).toBeNull()
    })

    it('janela é configurável', () => {
        const msgs = [intencao('i1', '2 kg', '2026-08-21T10:00:00Z')]
        const agora = new Date('2026-08-21T13:00:00Z')
        expect(pedidoVigente(msgs, agora, 4 * 60 * 60 * 1000)?.id).toBe('i1')
        expect(pedidoVigente(msgs, agora, 1 * 60 * 60 * 1000)).toBeNull()
    })
})
