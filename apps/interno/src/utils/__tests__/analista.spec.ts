import { describe, it, expect } from 'vitest'
import {
    segmentar,
    validarVeredito,
    montarPromptUsuario,
    referenciaDatas,
    motivoDescarte,
    DIAS_ADIAMENTO_SEM_PRAZO,
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
        temTextoDoCliente: mensagens.some(([de, texto]) => de === 'cliente' && !/^\[[a-z_]+\]$/.test(texto)),
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
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'nenhum', observacao: 'Enviamos a oferta.', trecho_cliente: null }),
            seg([['nos', 'oferta']]),
        )
        expect(r).toEqual({ ok: true, veredito: { tipo: 'ponto_contato', resultado: null, observacao: 'Enviamos a oferta.', trechoCliente: null, retomarEm: null } })
    })

    it('recusa: aceita quando o trecho está numa mensagem do cliente (ignora caixa, espaços e aspas)', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Cliente recusou a oferta.', trecho_cliente: '"não tenho interesse, obrigada"' }),
            conversaComRecusa,
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: 'recusou', trechoCliente: 'não tenho interesse, obrigada' } })
    })

    it('recusa sem trecho é inválida (pede outra resposta)', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Recusou.', trecho_cliente: null }),
            conversaComRecusa,
        )
        expect(r.ok).toBe(false)
    })

    it('recusa com trecho inventado é inválida', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Recusou.', trecho_cliente: 'pode tirar meu número' }),
            conversaComRecusa,
        )
        expect(r).toMatchObject({ ok: false })
    })

    it.each(['Não obrigada', 'não, obrigado!', 'Nao obrigada.'])(
        'recusa cujo trecho é só um "não, obrigada" educado é inválida (%s)',
        (trecho) => {
            const andreia = seg([['nos', 'Essa é a semana do seu balde'], ['cliente', trecho], ['cliente', 'Estou viajando']])
            const r = validarVeredito(
                JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Recusou o balde.', trecho_cliente: trecho }),
                andreia,
            )
            expect(r).toMatchObject({ ok: false })
        },
    )

    it('recusa citando uma mensagem NOSSA é inválida', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'recusou', observacao: 'Recusou.', trecho_cliente: 'quer aproveitar a promoção' }),
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
            JSON.stringify({ tipo: 'feedback', resultado: 'aceitou', observacao: 'Elogiou e pediu mais 2 baldes.', trecho_cliente: 'manda mais 2 baldes' }),
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

    const zelia = seg([
        ['nos', 'Sua mãe decidiu pelo balde?'],
        ['cliente', 'estou no hospital com minha mãe'],
        ['cliente', 'nem tive tempo de responder'],
        ['nos', 'Cuida dela!'],
    ])

    it.each([
        'Cliente em hospital com mãe; pediu para chamar depois.',
        'Mãe internada, retomar depois.',
        'Está na clínica com o pai.',
        'Filho fez cirurgia, falar semana que vem.',
    ])('nota com detalhe de saúde pede outra resposta: %s', (observacao) => {
        const r = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao, trecho_cliente: 'nem tive tempo de responder' }), zelia)
        expect(r).toMatchObject({ ok: false })
    })

    it('frase do cliente com detalhe de saúde também pede outra resposta', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Acompanhando a mãe; pediu para retomar depois.', trecho_cliente: 'estou no hospital com minha mãe' }),
            zelia,
        )
        expect(r).toMatchObject({ ok: false })
    })

    it('nota de saúde no mínimo passa', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Acompanhando a mãe; sugerimos retomar depois.', trecho_cliente: 'nem tive tempo de responder' }),
            zelia,
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: 'adiou' } })
    })

    it('a palavra recusa só cabe na nota quando o resultado é recusou', () => {
        const andreia = seg([['nos', 'Essa é a semana do seu balde'], ['cliente', 'Não obrigada'], ['cliente', 'Estou viajando']])
        const errada = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Cliente recusou o pedido porque está viajando.', trecho_cliente: 'Estou viajando' }),
            andreia,
        )
        expect(errada).toMatchObject({ ok: false })
        const certa = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Está viajando; combinamos retomar na volta.', retomar_em: null, trecho_cliente: 'Estou viajando' }),
            andreia,
        )
        expect(certa).toMatchObject({ ok: true, veredito: { resultado: 'adiou', trechoCliente: 'Estou viajando' } })
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

describe('validarVeredito — frase do cliente entre aspas (respondeu/aceitou/adiou)', () => {
    const conversa = seg([['nos', 'Essa é a semana do seu balde'], ['cliente', 'Não obrigada'], ['cliente', 'Estou viajando'], ['nos', 'Quando voltar, me chama']])

    it.each(['respondeu', 'aceitou', 'adiou'])('%s sem trecho_cliente pede outra resposta', (resultado) => {
        const r = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado, observacao: 'Nota.', trecho_cliente: null }), conversa)
        expect(r).toMatchObject({ ok: false })
    })

    it('trecho de uma mensagem NOSSA pede outra resposta', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Viajando.', trecho_cliente: 'Quando voltar, me chama' }),
            conversa,
        )
        expect(r).toMatchObject({ ok: false })
    })

    it('trecho do cliente passa, sem as aspas', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Viajando; combinamos retomar na volta.', trecho_cliente: '"estou   viajando"' }),
            conversa,
        )
        expect(r).toMatchObject({ ok: true, veredito: { trechoCliente: 'estou   viajando' } })
    })

    it('cliente que só mandou áudio: a frase é a marca da mídia, como no prompt', () => {
        const s = seg([['nos', 'Quer o balde?'], ['cliente', '[audio]']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'respondeu', observacao: 'Respondeu por áudio.', trecho_cliente: '[audio]' }),
            s,
        )
        expect(r).toMatchObject({ ok: true, veredito: { trechoCliente: '[audio]' } })
    })

    it('erro só na frase: a correção pede para manter o resultado', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Viajando.', trecho_cliente: 'Quando voltar, me chama' }),
            conversa,
        )
        expect(r).toMatchObject({ ok: false, manterResultado: 'adiou' })
    })

    it('na correção, mudar o resultado é rejeitado (Zélia: adiou virou respondeu para caber "Me desculpa")', () => {
        const zelia = seg([['nos', 'Sua mãe decidiu?'], ['cliente', 'estou no hospital com minha mãe nem tive tempo'], ['cliente', 'Me desculpa']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'respondeu', observacao: 'Acompanhando a mãe.', trecho_cliente: 'Me desculpa' }),
            zelia,
            { manterResultado: 'adiou' },
        )
        expect(r).toMatchObject({ ok: false })
        const certa = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Acompanhando a mãe.', trecho_cliente: 'nem tive tempo' }),
            zelia,
            { manterResultado: 'adiou' },
        )
        expect(certa).toMatchObject({ ok: true, veredito: { resultado: 'adiou' } })
    })

    it('frase com saúde: a correção mantém o resultado', () => {
        const zelia = seg([['nos', 'Sua mãe decidiu?'], ['cliente', 'estou no hospital com minha mãe nem tive tempo']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Acompanhando a mãe.', trecho_cliente: 'estou no hospital com minha mãe' }),
            zelia,
        )
        expect(r).toMatchObject({ ok: false, manterResultado: 'adiou' })
    })

    it('feedback e "nenhum" não levam frase', () => {
        const fb = validarVeredito(JSON.stringify({ tipo: 'feedback', resultado: 'nenhum', observacao: 'Elogiou.' }), seg([['cliente', 'ficou ótimo']]))
        expect(fb).toMatchObject({ ok: true, veredito: { trechoCliente: null } })
        const nada = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado: 'nenhum', observacao: 'Oferta.' }), seg([['nos', 'oferta']]))
        expect(nada).toMatchObject({ ok: true, veredito: { trechoCliente: null } })
    })
})

describe('validarVeredito — auditoria das notas reais (15/10)', () => {
    it.each([
        'Cliente pediu 2 baldes, entrega no condomínio Tiradentes.',
        'Registrado endereço: Rua Nilo Peçanha 227, pedido de 1kg.',
        'Pediu para tocar na portaria e chamar a zeladora.',
        'Entrega no apartamento 44, bloco F.',
        'CEP 09810-580 confirmado.',
    ])('nota com endereço/logística volta para o modelo, mantendo o resultado: %s', (observacao) => {
        const s = seg([['nos', 'Qual o endereço?'], ['cliente', 'Pode ser amanhã']])
        const r = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao, trecho_cliente: 'Pode ser amanhã' }), s)
        expect(r).toMatchObject({ ok: false, manterResultado: 'aceitou' })
    })

    it.each([
        'Cliente pediu 2 baldes, dinheiro, entrega de manhã.',
        'Cliente informou o bairro para cálculo de frete.',
    ])('dia, horário e bairro da entrega passam (resíduo aceito em 15/10): %s', (observacao) => {
        const s = seg([['nos', 'Qual o endereço?'], ['cliente', 'Pode ser amanhã']])
        const r = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao, trecho_cliente: 'Pode ser amanhã' }), s)
        expect(r).toMatchObject({ ok: true })
    })

    it('número da casa conta como endereço', () => {
        const s = seg([['nos', 'Qual o endereço?'], ['cliente', 'Pode ser amanhã']])
        const r = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao: 'Entrega no nº 227.', trecho_cliente: 'Pode ser amanhã' }), s)
        expect(r).toMatchObject({ ok: false, manterResultado: 'aceitou' })
    })

    it('frase do cliente com endereço também volta', () => {
        const s = seg([['nos', 'Qual o endereço?'], ['cliente', 'Rua Nilo Peçanha 227'], ['cliente', 'Pode ser amanhã']])
        const r = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao: 'Fechou 1kg.', trecho_cliente: 'Rua Nilo Peçanha 227' }), s)
        expect(r).toMatchObject({ ok: false, manterResultado: 'aceitou' })
    })

    it('"cliente pediu para retomar" quando quem sugeriu fomos NÓS volta para o modelo', () => {
        const andreia = seg([['nos', 'Essa é a semana do seu balde'], ['cliente', 'Estou viajando'], ['nos', 'Quando voltar, é só me chamar']])
        const errada = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Está viajando e pediu para retomar quando voltar.', trecho_cliente: 'Estou viajando' }),
            andreia,
        )
        expect(errada).toMatchObject({ ok: false, manterResultado: 'adiou' })
        const certa = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Está viajando; sugerimos retomar na volta.', trecho_cliente: 'Estou viajando' }),
            andreia,
        )
        expect(certa).toMatchObject({ ok: true })
    })

    it('"cliente pediu para retomar" vale quando a frase DELE pede', () => {
        const s = seg([['nos', 'Quer o balde?'], ['cliente', 'Agora não, me chama semana que vem']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Pediu para retomar na semana que vem.', retomar_em: '2026-10-19', trecho_cliente: 'me chama semana que vem' }),
            s,
        )
        expect(r).toMatchObject({ ok: true })
    })

    it('Brasilio: compra condicionada a dinheiro não é "aceitou"', () => {
        const brasilio = seg([['nos', 'Quer que eu já separe o seu?'], ['cliente', 'Sim com certeza só aguardar entrar $'], ['nos', 'Combinado! Quando quiser, é só chamar']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao: 'Cliente confirmou pedido.', trecho_cliente: 'Sim com certeza só aguardar entrar $' }),
            brasilio,
        )
        expect(r).toMatchObject({ ok: false })
        expect(r.ok === false && r.manterResultado).toBeFalsy()
    })

    it('frase do cliente não pode ser a marca de mídia quando ele escreveu texto', () => {
        const s = seg([['nos', 'Quer o balde?'], ['cliente', '[audio]'], ['cliente', 'Isso, pode mandar']])
        const r = validarVeredito(JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao: 'Fechou o balde.', trecho_cliente: '[audio]' }), s)
        expect(r).toMatchObject({ ok: false, manterResultado: 'aceitou' })
    })
})

describe('motivoDescarte — o que não vira interação nem move card', () => {
    it('contato arquivado', () => {
        expect(motivoDescarte(seg([['cliente', 'oi']]), true)).toBe('contato_arquivado')
    })

    it('cliente só mandou marca de mídia ([outro], [sticker], [audio])', () => {
        const s = segmentar([
            { message_id: 'a', contato_id: A, direcao: 'saida', conteudo: 'Quer o balde?', tipo_midia: 'texto', enviada_em: '2026-10-14T10:00:00Z', analise_falhas: 0 },
            { message_id: 'b', contato_id: A, direcao: 'entrada', conteudo: null, tipo_midia: 'sticker', enviada_em: '2026-10-14T10:01:00Z', analise_falhas: 0 },
        ], { agoraMs: AGORA })[0]
        expect(s.temTextoDoCliente).toBe(false)
        expect(motivoDescarte(s, false)).toBe('so_marcador')
    })

    it('só mensagens nossas, ou cliente com texto: segue para o analista', () => {
        expect(motivoDescarte(seg([['nos', 'oferta']]), false)).toBeNull()
        expect(motivoDescarte(seg([['nos', 'oferta'], ['cliente', 'quero']]), false)).toBeNull()
    })

    it('mensagem automática de empresa nem entra no segmento', () => {
        const segs = segmentar([
            { message_id: 't', contato_id: A, direcao: 'entrada', conteudo: null, tipo_midia: 'template_empresa', enviada_em: '2026-10-14T10:00:00Z', analise_falhas: 0 },
        ], { agoraMs: AGORA })
        expect(segs).toHaveLength(0)
    })
})

describe('validarVeredito — adiou e retomar_em', () => {
    // fim do segmento: 14/10 19:10Z = 14/10 16:10 em Brasília (quarta-feira)
    const lena = seg([['nos', 'O balde de 4kg sai R$ 75'], ['cliente', 'Vou ver se consigo pegar amanhã viu'], ['cliente', 'Pra fim de semana']])
    lena.fim = '2026-10-14T19:10:00Z'

    it('adiou com prazo: guarda a data', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Vai ver se pega amanhã.', retomar_em: '2026-10-15', trecho_cliente: 'Vou ver se consigo pegar amanhã' }),
            lena,
        )
        expect(r).toEqual({ ok: true, veredito: { tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Vai ver se pega amanhã.', trechoCliente: 'Vou ver se consigo pegar amanhã', retomarEm: '2026-10-15' } })
    })

    it.each([
        ['formato errado', '15/10/2026'],
        ['data que não existe', '2026-02-30'],
        ['o próprio dia da conversa', '2026-10-14'],
        ['data no passado', '2026-10-01'],
        ['mais de 60 dias à frente', '2026-12-20'],
    ])('adiou com retomar_em inválido (%s) pede outra resposta', (_caso, data) => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Adiou.', retomar_em: data, trecho_cliente: 'Pra fim de semana' }),
            lena,
        )
        expect(r.ok).toBe(false)
    })

    it('adiou sem data quando o CLIENTE citou um prazo ("amanhã", "fim de semana") pede outra resposta', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Vai ver se pega no fim de semana.', retomar_em: null, trecho_cliente: 'Pra fim de semana' }),
            lena,
        )
        expect(r).toMatchObject({ ok: false })
    })

    it('adiou sem prazo claro: lembrete em 7 dias, contados do dia da conversa (Brasília)', () => {
        // fim padrão de seg(): 14/10 10:10Z = 14/10 em Brasília → 21/10
        const s = seg([['nos', 'Posso levar amanhã?'], ['cliente', 'Estou viajando, quando voltar te chamo']])
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'adiou', observacao: 'Viajando; retomar na volta.', retomar_em: null, trecho_cliente: 'quando voltar te chamo' }),
            s,
        )
        expect(r).toMatchObject({ ok: true, veredito: { resultado: 'adiou', retomarEm: '2026-10-21' } })
        expect(DIAS_ADIAMENTO_SEM_PRAZO).toBe(7)
    })

    it('retomar_em em outro resultado é descartado (só adiamento tem data de retomada)', () => {
        const r = validarVeredito(
            JSON.stringify({ tipo: 'ponto_contato', resultado: 'aceitou', observacao: 'Fechou 1kg para amanhã.', retomar_em: '2026-10-15', trecho_cliente: 'Vou ver se consigo pegar amanhã viu' }),
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
        expect(PROMPT_SISTEMA).toContain('CONCRETO e SEM CONDIÇÃO')
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
        expect(PROMPT_SISTEMA).toContain('trecho_cliente')
        expect(PROMPT_SISTEMA).toContain('Cliente: "')
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
