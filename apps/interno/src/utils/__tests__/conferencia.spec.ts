import { describe, it, expect } from 'vitest'
import {
    validarPedidoExtraido,
    dentroDoHorario,
    mensagensDevidas,
    textoPedidoSemVenda,
    type Segmento,
    type AlertaPendente,
} from '@mont/shared'

/**
 * Conferência de hora em hora (bloco C, 31/10/2026). Camada pura: o critério de "pedido
 * fechado" (aprovado pelo Luccas), a janela 8h–21h de São Paulo com o resumo das 8h, e os
 * textos dos alertas.
 */

const SEG: Segmento = {
    contatoId: 'c-1',
    messageIds: ['m1', 'm2', 'm3', 'm4'],
    inicio: '2026-11-03T13:00:00Z',
    fim: '2026-11-03T13:20:00Z',
    sentido: 'saida',
    falhas: 0,
    temMensagemDoCliente: true,
    temTextoDoCliente: true,
    mensagens: [
        { de: 'cliente', texto: 'Oi, quanto tá o combo família?', em: '2026-11-03T13:00:00Z' },
        { de: 'nos', texto: 'R$ 199 no Pix, com 6 doces à escolha', em: '2026-11-03T13:02:00Z' },
        { de: 'cliente', texto: 'Fechado, quero 1 com 3 de doce de leite e 3 de coco, pode mandar', em: '2026-11-03T13:10:00Z' },
        { de: 'nos', texto: 'Perfeito! Chave pix: 11999999999. Total R$ 199', em: '2026-11-03T13:20:00Z' },
    ],
}

function resposta(extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
        fechado: true,
        itens: [{ produto: 'Combo Família', quantidade: 1, sabores: ['3 doce de leite', '3 coco'] }],
        forma_pagamento: 'pix',
        entrega: 'entrega',
        total_citado: 199,
        confirmacao: 'equipe',
        desistiu: false,
        faltam_sabores: false,
        trecho_aceite: 'Fechado, quero 1 com 3 de doce de leite e 3 de coco, pode mandar',
        ...extra,
    })
}

describe('validarPedidoExtraido — os 4 pontos do critério', () => {
    it('aceite + item com quantidade + confirmação da equipe + sem desistência = fechado', () => {
        const v = validarPedidoExtraido(resposta(), SEG)
        expect(v.ok).toBe(true)
        if (!v.ok) return
        expect(v.pedido.fechado).toBe(true)
        expect(v.pedido.totalCitado).toBe(199)
        // O momento do fechamento é a mensagem do aceite, não o fim da conversa.
        expect(v.pedido.fechadoEm).toBe('2026-11-03T13:10:00Z')
    })

    it('sem item com quantidade não é fechado', () => {
        const v = validarPedidoExtraido(resposta({ itens: [] }), SEG)
        expect(v.ok && v.pedido.fechado).toBe(false)
    })

    it('sem confirmação do outro lado (equipe ou comprovante) não é fechado', () => {
        const v = validarPedidoExtraido(resposta({ confirmacao: 'nenhuma' }), SEG)
        expect(v.ok && v.pedido.fechado).toBe(false)
    })

    it('comprovante do cliente vale como confirmação', () => {
        const v = validarPedidoExtraido(resposta({ confirmacao: 'comprovante' }), SEG)
        expect(v.ok && v.pedido.fechado).toBe(true)
    })

    it('desistência depois do aceite não é fechado', () => {
        const v = validarPedidoExtraido(resposta({ desistiu: true }), SEG)
        expect(v.ok && v.pedido.fechado).toBe(false)
    })

    it('o modelo dizendo fechado=false manda', () => {
        const v = validarPedidoExtraido(resposta({ fechado: false }), SEG)
        expect(v.ok && v.pedido.fechado).toBe(false)
    })

    it('trecho que não está numa mensagem do CLIENTE é descartado (nunca cita fala nossa)', () => {
        const v = validarPedidoExtraido(resposta({ trecho_aceite: 'Chave pix: 11999999999' }), SEG)
        expect(v.ok && v.pedido.trecho).toBeNull()
    })

    it('JSON quebrado ou campo fora do vocabulário é inválido', () => {
        expect(validarPedidoExtraido('não é json', SEG).ok).toBe(false)
        expect(validarPedidoExtraido(resposta({ forma_pagamento: 'boleto' }), SEG).ok).toBe(false)
        expect(validarPedidoExtraido(resposta({ itens: [{ produto: '', quantidade: 1, sabores: [] }] }), SEG).ok).toBe(false)
    })

    it('combo sem sabor fica marcado, mas continua fechado', () => {
        const v = validarPedidoExtraido(resposta({ faltam_sabores: true }), SEG)
        expect(v.ok && v.pedido.fechado).toBe(true)
        expect(v.ok && v.pedido.faltamSabores).toBe(true)
    })
})

describe('dentroDoHorario — 8h às 21h de São Paulo', () => {
    it('8h00 e 20h59 dentro; 7h59 e 21h00 fora', () => {
        expect(dentroDoHorario('2026-11-03T11:00:00Z')).toBe(true)   // 08:00 SP
        expect(dentroDoHorario('2026-11-03T23:59:00Z')).toBe(true)   // 20:59 SP
        expect(dentroDoHorario('2026-11-03T10:59:00Z')).toBe(false)  // 07:59 SP
        expect(dentroDoHorario('2026-11-04T00:00:00Z')).toBe(false)  // 21:00 SP
    })
})

const alerta = (id: string, destino: 'grupo' | 'luccas', venceEm: string): AlertaPendente =>
    ({ id, destino, venceEm, texto: `alerta ${id}` })

describe('mensagensDevidas', () => {
    it('fora do horário não sai nada', () => {
        expect(mensagensDevidas([alerta('a', 'grupo', '2026-11-03T22:00:00Z')], '2026-11-04T01:00:00Z')).toEqual([])
    })

    it('alerta que venceu de dia sai sozinho', () => {
        const m = mensagensDevidas([alerta('a', 'grupo', '2026-11-03T15:00:00Z')], '2026-11-03T16:00:00Z')
        expect(m).toEqual([{ destino: 'grupo', texto: 'alerta a', alertaIds: ['a'] }])
    })

    it('o que venceu depois das 21h vai num resumo único às 8h, por destino', () => {
        const noite = [
            alerta('a', 'grupo', '2026-11-04T00:30:00Z'), // 21:30 SP
            alerta('b', 'grupo', '2026-11-04T08:00:00Z'), // 05:00 SP
            alerta('c', 'luccas', '2026-11-04T03:00:00Z'), // 00:00 SP
        ]
        const m = mensagensDevidas(noite, '2026-11-04T11:00:00Z') // 08:00 SP
        expect(m).toHaveLength(2)
        const grupo = m.find((x) => x.destino === 'grupo')!
        expect(grupo.alertaIds).toEqual(['a', 'b'])
        expect(grupo.texto).toContain('Resumo da noite')
        expect(grupo.texto).toContain('alerta a')
        expect(grupo.texto).toContain('alerta b')
        expect(m.find((x) => x.destino === 'luccas')!.alertaIds).toEqual(['c'])
    })

    it('alerta que ainda não venceu espera', () => {
        expect(mensagensDevidas([alerta('a', 'grupo', '2026-11-03T18:00:00Z')], '2026-11-03T16:00:00Z')).toEqual([])
    })
})

describe('textoPedidoSemVenda', () => {
    it('mostra cliente, itens com sabores, pagamento, total e o trecho', () => {
        const v = validarPedidoExtraido(resposta(), SEG)
        if (!v.ok) throw new Error('fixture inválida')
        const t = textoPedidoSemVenda({ nome: 'Ana', telefone: '11988887777' }, v.pedido)
        expect(t).toContain('Pedido para conferir')
        expect(t).toContain('Ana')
        expect(t).toContain('1× Combo Família (3 doce de leite, 3 coco)')
        expect(t).toContain('Pix')
        expect(t).toContain('R$ 199')
        expect(t).toContain('Fechado, quero 1')
        expect(t).toContain('10:10') // horário de SP do aceite
    })
})
