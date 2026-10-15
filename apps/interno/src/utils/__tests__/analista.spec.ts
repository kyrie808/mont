import { describe, it, expect } from 'vitest'
import {
    segmentar,
    validarVeredito,
    montarPromptUsuario,
    PROMPT_SISTEMA,
    type MensagemPendente,
    type Segmento,
} from '@mont/shared'

// Camada pura: sem banco, sem rede.

const A = 'contato-a'
const B = 'contato-b'

function msg(
    id: string, contato: string, direcao: 'entrada' | 'saida', em: string, conteudo: string | null = id, falhas = 0,
): MensagemPendente {
    return { message_id: id, contato_id: contato, direcao, conteudo, tipo_midia: 'texto', enviada_em: em, analise_falhas: falhas }
}

const AGORA = Date.parse('2026-10-15T12:00:00Z')

describe('segmentar — conversas separadas por silêncio', () => {
    it('reativação de 12/10 e resposta de 14/10 viram dois segmentos, do mais antigo ao mais novo', () => {
        const segs = segmentar([
            msg('r2', A, 'entrada', '2026-10-14T18:40:00Z'),
            msg('r1', A, 'saida', '2026-10-14T18:37:00Z'),
            msg('s1', A, 'saida', '2026-10-12T13:59:00Z'),
        ], { agoraMs: AGORA })

        expect(segs.map((s) => s.messageIds)).toEqual([['s1'], ['r1', 'r2']])
        expect(segs[0].sentido).toBe('saida')
        expect(segs[0].temMensagemDoCliente).toBe(false)
        expect(segs[1].sentido).toBe('entrada')
        expect(segs[1].inicio).toBe('2026-10-14T18:37:00Z')
        expect(segs[1].fim).toBe('2026-10-14T18:40:00Z')
    })

    it('silêncio de exatamente 6h já separa; 5h59 não', () => {
        const separados = segmentar([
            msg('a', A, 'saida', '2026-10-14T00:00:00Z'),
            msg('b', A, 'entrada', '2026-10-14T06:00:00Z'),
        ], { agoraMs: AGORA })
        expect(separados).toHaveLength(2)

        const juntos = segmentar([
            msg('a', A, 'saida', '2026-10-14T00:00:00Z'),
            msg('b', A, 'entrada', '2026-10-14T05:59:00Z'),
        ], { agoraMs: AGORA })
        expect(juntos).toHaveLength(1)
    })

    it('a conversa com menos de 30 min de silêncio espera; a anterior do mesmo contato segue', () => {
        const segs = segmentar([
            msg('velha', A, 'saida', '2026-10-14T10:00:00Z'),
            msg('quente', A, 'entrada', '2026-10-15T11:45:00Z'),
        ], { agoraMs: AGORA })
        expect(segs.map((s) => s.messageIds)).toEqual([['velha']])
    })

    it('ordena os segmentos de todos os contatos pelo fim', () => {
        const segs = segmentar([
            msg('b1', B, 'entrada', '2026-10-13T10:00:00Z'),
            msg('a1', A, 'entrada', '2026-10-14T10:00:00Z'),
            msg('a0', A, 'saida', '2026-10-12T10:00:00Z'),
        ], { agoraMs: AGORA })
        expect(segs.map((s) => s.messageIds[0])).toEqual(['a0', 'b1', 'a1'])
    })

    it('leva todos os ids, mas só as últimas mensagens ao prompt, e o maior contador de falhas', () => {
        const linhas = Array.from({ length: 5 }, (_, i) =>
            msg(`m${i}`, A, i % 2 ? 'entrada' : 'saida', `2026-10-14T10:0${i}:00Z`, `texto ${i}`, i === 2 ? 3 : 0))
        const [seg] = segmentar(linhas, { agoraMs: AGORA, maxMensagensPrompt: 2 })

        expect(seg.messageIds).toEqual(['m0', 'm1', 'm2', 'm3', 'm4'])
        expect(seg.mensagens.map((m) => m.texto)).toEqual(['texto 3', 'texto 4'])
        expect(seg.falhas).toBe(3)
    })

    it('mídia sem texto entra como [tipo]', () => {
        const [seg] = segmentar([{ ...msg('x', A, 'entrada', '2026-10-14T10:00:00Z', null), tipo_midia: 'audio' }], { agoraMs: AGORA })
        expect(seg.mensagens[0]).toMatchObject({ de: 'cliente', texto: '[audio]' })
    })
})

function seg(mensagens: Array<[('cliente' | 'nos'), string]>): Segmento {
    return {
        contatoId: A,
        messageIds: mensagens.map((_, i) => `m${i}`),
        inicio: '2026-10-14T10:00:00Z',
        fim: '2026-10-14T10:10:00Z',
        sentido: mensagens[mensagens.length - 1][0] === 'cliente' ? 'entrada' : 'saida',
        falhas: 0,
        temMensagemDoCliente: mensagens.some(([de]) => de === 'cliente'),
        mensagens: mensagens.map(([de, texto]) => ({ de, texto, em: '2026-10-14T10:00:00Z' })),
    }
}

const conversaComRecusa = seg([
    ['nos', 'Oi! Temos pão de queijo fresquinho, quer aproveitar a promoção?'],
    ['cliente', 'Não tenho interesse,   obrigada'],
])

describe('validarVeredito — o que pode ir para a RPC', () => {
    it('aceita um ponto de contato comum e troca "nenhum" por nulo', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'nenhum', observacao: 'Enviamos a oferta.', trecho_recusa: null }),
            seg([['nos', 'oferta']]),
        )
        expect(r).toEqual({ ok: true, veredito: { tipo: 'ponto_contato', resultado: null, observacao: 'Enviamos a oferta.', trechoRecusa: null } })
    })

    it('recusa: aceita quando o trecho está numa mensagem do cliente (ignora caixa, espaços e aspas)', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Cliente recusou a oferta.', trecho_recusa: '"não tenho interesse, obrigada"' }),
            conversaComRecusa,
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: 'recusou', trechoRecusa: 'não tenho interesse, obrigada' } })
    })

    it('recusa sem trecho é inválida (pede outra resposta)', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Recusou.', trecho_recusa: null }),
            conversaComRecusa,
        )
        expect(r.ok).toBe(false)
    })

    it('recusa com trecho inventado é inválida', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Recusou.', trecho_recusa: 'pode tirar meu número' }),
            conversaComRecusa,
        )
        expect(r).toMatchObject({ ok: false })
    })

    it('recusa citando uma mensagem NOSSA é inválida', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Recusou.', trecho_recusa: 'quer aproveitar a promoção' }),
            conversaComRecusa,
        )
        expect(r).toMatchObject({ ok: false })
    })

    it('segmento só com mensagens nossas não tem resposta do cliente: resultado vira nulo', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao: 'Oferta enviada.' }),
            seg([['nos', 'oferta'], ['nos', 'lembrete']]),
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: null } })
    })

    it('feedback com resultado vira ponto_contato, para o "aceitou" não se perder', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'feedback', resultado: 'aceitou', observacao: 'Elogiou e pediu mais 2 baldes.' }),
            seg([['cliente', 'amei, manda mais 2 baldes']]),
        )
        expect(r).toMatchObject({ ok: true, veredito: { tipo: 'ponto_contato', resultado: 'aceitou' } })
    })

    it.each([
        ['não é JSON', 'resposta solta'],
        ['tipo fora do vocabulário', JSON.stringify({ tipo: 'venda', resultado: 'nenhum', observacao: 'x' })],
        ['resultado fora do vocabulário', JSON.stringify({ tipo: 'ponto_contato', resultado: 'em_negociacao', observacao: 'x' })],
        ['observação vazia', JSON.stringify({ tipo: 'ponto_contato', resultado: 'nenhum', observacao: '  ' })],
        ['observação longa demais', JSON.stringify({ tipo: 'ponto_contato', resultado: 'nenhum', observacao: 'x'.repeat(401) })],
        ['array em vez de objeto', '[]'],
    ])('rejeita: %s', (_caso, texto) => {
        expect(validarVeredito(texto, seg([['cliente', 'oi']])).ok).toBe(false)
    })
})

describe('prompt', () => {
    it('regras de recusa: exemplos explícitos, adiamento não é recusa, trecho obrigatório', () => {
        expect(PROMPT_SISTEMA).toContain('não tenho interesse')
        expect(PROMPT_SISTEMA).toContain('pode tirar')
        expect(PROMPT_SISTEMA).toContain('Adiamento NÃO é recusa')
        expect(PROMPT_SISTEMA).toContain('semana que vem')
        expect(PROMPT_SISTEMA).toContain('trecho_recusa')
    })

    it('transcrição com nome, horário de Brasília e aviso de mensagens omitidas', () => {
        const s: Segmento = { ...conversaComRecusa, messageIds: ['a', 'b', 'c'], inicio: '2026-10-12T13:59:00Z', fim: '2026-10-12T14:30:00Z' }
        const p = montarPromptUsuario(s, 'Ana Paula')
        expect(p).toContain('Cliente: Ana Paula')
        expect(p).toContain('12/10, 10:59')
        expect(p).toContain('(Mensagens mais antigas omitidas: 1.)')
        expect(p).toContain('NÓS: Oi! Temos pão de queijo')
        expect(p).toContain('CLIENTE: Não tenho interesse')
    })
})
