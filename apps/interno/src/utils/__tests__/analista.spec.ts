import { describe, it, expect } from 'vitest'
import {
    segmentar,
    validarVeredito,
    montarPromptUsuario,
    referenciaDatas,
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
        expect(r).toEqual({ ok: true, veredito: { tipo: 'ponto_contato', resultado: null, observacao: 'Enviamos a oferta.', trechoRecusa: null, retomarEm: null } })
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

    it.each(['Não obrigada', 'não, obrigado!', 'Nao obrigada.'])(
        'recusa cujo trecho é só um "não, obrigada" educado é inválida (%s)',
        (trecho) => {
            const andreia = seg([['nos', 'Essa é a semana do seu balde'], ['cliente', trecho], ['cliente', 'Estou viajando']])
            const r = validarVeredito(
                JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Recusou o balde.', trecho_recusa: trecho }),
                andreia,
            )
            expect(r).toMatchObject({ ok: false })
        },
    )

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

    it('com mensagem do cliente, ponto de contato não pode sair "nenhum" (Maria: pedido fechado lido como nada)', () => {
        const maria = seg([['nos', 'Pão de queijo congelado 1kg, total R$ 35'], ['cliente', 'Pode ser amanhã'], ['nos', 'Fechado e registrado!']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'nenhum', observacao: 'Confirmado pedido para amanhã, Pix na entrega.' }),
            maria,
        )
        expect(r).toMatchObject({ ok: false })
        // Feedback continua sem resultado, mesmo com mensagem do cliente.
        const fb = validarVeredito(
            JSON.stringify({ tipo: 'feedback', resultado: 'nenhum', observacao: 'Elogiou o pão de queijo.' }),
            seg([['cliente', 'Fiz na air fryer e ficou ótimo']]),
        )
        expect(fb).toMatchObject({ ok: true, veredito: { tipo: 'feedback', resultado: null } })
    })

    it.each([
        'Cliente em hospital com mãe; pediu para chamar depois.',
        'Mãe internada, retomar depois.',
        'Está na clínica com o pai.',
        'Filho fez cirurgia, falar semana que vem.',
    ])('nota com detalhe de saúde pede outra resposta: %s', (observacao) => {
        const zelia = seg([['nos', 'Sua mãe decidiu pelo balde?'], ['cliente', 'estou no hospital com minha mãe'], ['nos', 'Cuida dela!']])
        const r = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao }), zelia)
        expect(r).toMatchObject({ ok: false })
    })

    it('nota de saúde no mínimo passa', () => {
        const zelia = seg([['nos', 'Sua mãe decidiu pelo balde?'], ['cliente', 'estou no hospital com minha mãe'], ['nos', 'Cuida dela!']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Acompanhando a mãe; pediu para retomar depois.' }),
            zelia,
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: 'adiou' } })
    })

    it('a palavra recusa só cabe na nota quando o resultado é recusou', () => {
        const andreia = seg([['nos', 'Essa é a semana do seu balde'], ['cliente', 'Não obrigada'], ['cliente', 'Estou viajando']])
        const errada = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Cliente recusou o pedido porque está viajando.' }),
            andreia,
        )
        expect(errada).toMatchObject({ ok: false })
        const certa = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Está viajando; pediu para retomar na volta.', retomar_em: null }),
            andreia,
        )
        expect(certa).toMatchObject({ ok: true, veredito: { resultado: 'adiou', retomarEm: null } })
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

describe('validarVeredito — adiou e retomar_em', () => {
    // fim do segmento: 14/10 19:10Z = 14/10 16:10 em Brasília (quarta-feira)
    const lena = seg([['nos', 'O balde de 4kg sai R$ 75'], ['cliente', 'Vou ver se consigo pegar amanhã viu'], ['cliente', 'Pra fim de semana']])
    lena.fim = '2026-10-14T19:10:00Z'

    it('adiou com prazo: guarda a data', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Vai ver se pega amanhã.', retomar_em: '2026-10-15' }),
            lena,
        )
        expect(r).toEqual({ ok: true, veredito: { tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Vai ver se pega amanhã.', trechoRecusa: null, retomarEm: '2026-10-15' } })
    })

    it.each([
        ['formato errado', '15/10/2026'],
        ['data que não existe', '2026-02-30'],
        ['o próprio dia da conversa', '2026-10-14'],
        ['data no passado', '2026-10-01'],
        ['mais de 60 dias à frente', '2026-12-20'],
    ])('adiou com retomar_em inválido (%s) pede outra resposta', (_caso, data) => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Adiou.', retomar_em: data }),
            lena,
        )
        expect(r.ok).toBe(false)
    })

    it('adiou sem data quando o CLIENTE citou um prazo ("amanhã", "fim de semana") pede outra resposta', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Vai ver se pega no fim de semana.', retomar_em: null }),
            lena,
        )
        expect(r).toMatchObject({ ok: false })
    })

    it('adiou sem data passa quando o prazo foi só nosso ou não há prazo', () => {
        const s = seg([['nos', 'Posso levar amanhã?'], ['cliente', 'Estou viajando, quando voltar te chamo']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Viajando; retomar na volta.', retomar_em: null }),
            s,
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: 'adiou', retomarEm: null } })
    })

    it('retomar_em em outro resultado é descartado (só adiamento tem data de retomada)', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao: 'Fechou 1kg para amanhã.', retomar_em: '2026-10-15' }),
            lena,
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: 'aceitou', retomarEm: null } })
    })

    it('adiou sem mensagem do cliente vira nulo, e a data vai junto', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Lembrete enviado.', retomar_em: '2026-10-15' }),
            seg([['nos', 'oi']]),
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: null, retomarEm: null } })
    })
})

describe('referenciaDatas — o calendário que vai junto com a conversa', () => {
    it('quarta 14/10 (16:10 em Brasília): amanhã 15/10, sábado 17/10, segunda 19/10', () => {
        expect(referenciaDatas('2026-10-14T19:10:00Z')).toEqual({
            hoje: '2026-10-14', diaSemana: 'quarta-feira', amanha: '2026-10-15', proximoSabado: '2026-10-17', proximaSegunda: '2026-10-19',
        })
    })

    it('usa o dia de Brasília: 15/10 01:00Z ainda é 14/10 lá', () => {
        expect(referenciaDatas('2026-10-15T01:00:00Z').hoje).toBe('2026-10-14')
    })

    it('no sábado, o próximo sábado é o da semana seguinte', () => {
        expect(referenciaDatas('2026-10-17T15:00:00Z')).toMatchObject({ hoje: '2026-10-17', proximoSabado: '2026-10-24', proximaSegunda: '2026-10-19' })
    })
})

describe('prompt', () => {
    it('adiou, retomar_em, quem é quem e pedido confirmado = aceitou', () => {
        expect(PROMPT_SISTEMA).toContain('"adiou"')
        expect(PROMPT_SISTEMA).toContain('retomar_em')
        expect(PROMPT_SISTEMA).toContain('quem é quem')
        expect(PROMPT_SISTEMA).toContain('Atribua cada fala a quem a escreveu')
        expect(PROMPT_SISTEMA).toContain('confirmou um pedido ou uma entrega')
        expect(PROMPT_SISTEMA).toContain('só podem aparecer na observacao quando o')
    })

    it('a observacao vem antes do resultado e o resultado se decide em ordem', () => {
        expect(PROMPT_SISTEMA.indexOf('{"observacao"')).toBeGreaterThan(-1)
        expect(PROMPT_SISTEMA).toContain('siga a ordem')
        expect(PROMPT_SISTEMA.indexOf('"aceitou"')).toBeLessThan(PROMPT_SISTEMA.indexOf('-> "adiou"'))
    })

    it('a conversa leva as datas de referência', () => {
        const s: Segmento = { ...conversaComRecusa, inicio: '2026-10-14T19:00:00Z', fim: '2026-10-14T19:10:00Z' }
        const p = montarPromptUsuario(s, 'Lena')
        expect(p).toContain('HOJE (dia da conversa): quarta-feira, 2026-10-14')
        expect(p).toContain('AMANHÃ: 2026-10-15')
        expect(p).toContain('PRÓXIMO SÁBADO: 2026-10-17')
        expect(p).toContain('PRÓXIMA SEGUNDA: 2026-10-19')
    })

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
