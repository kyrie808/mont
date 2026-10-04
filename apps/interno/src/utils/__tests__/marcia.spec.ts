import { describe, it, expect } from 'vitest'
import {
    formatarAgora,
    renderizarHistorico,
    montarRetomada,
    renderizarPedidoCliente,
    type HistoricoCompra,
    type ItemPedido,
} from '@mont/shared'

describe('formatarAgora', () => {
    // 04/10/2026 às 12:12 UTC = 09:12 em São Paulo (UTC-3), e é DOMINGO.
    it('formata no fuso de São Paulo, não em UTC', () => {
        expect(formatarAgora(new Date('2026-10-04T12:12:00Z'))).toBe('domingo, 04/10, 09:12')
    })

    // Sem fuso explícito, 02:30 UTC viraria "domingo" quando em São Paulo ainda é sábado
    // 23:30 — e a Márcia daria bom dia de domingo no sábado à noite.
    it('vira o dia pelo fuso de São Paulo, não pelo do servidor', () => {
        expect(formatarAgora(new Date('2026-10-05T02:30:00Z'))).toBe('domingo, 04/10, 23:30')
    })

    it('usa relógio de 24 horas', () => {
        expect(formatarAgora(new Date('2026-10-04T20:05:00Z'))).toBe('domingo, 04/10, 17:05')
    })

    // Byte-a-byte: `Intl.format()` insere caracteres invisíveis (NBSP) que já morderam
    // este projeto em formatCurrency. A montagem é à mão, via formatToParts.
    //
    // Os três invisíveis vão escapados e não literais: um teste sobre caractere
    // invisível que os carrega no próprio fonte é ilegível em review, e literal ali
    // dispara `no-irregular-whitespace` no lint. São os três que `Intl` usa como
    // separador: NBSP, narrow NBSP e thin space.
    it('não contém caractere invisível', () => {
        expect(formatarAgora(new Date('2026-10-04T12:12:00Z'))).not.toMatch(/[\u00A0\u202F\u2009]/)
    })
})

describe('renderizarHistorico', () => {
    const agora = new Date('2026-10-04T12:00:00Z')

    it('não diz nada para quem nunca comprou', () => {
        expect(renderizarHistorico(null, agora)).toBeNull()
    })

    // Uma compra só não é padrão de consumo — citar "costuma levar" com N=1 soa invasivo
    // e não ajuda a sugerir.
    it('não diz nada para quem comprou uma vez', () => {
        const h: HistoricoCompra = {
            compras: 1,
            produtosFrequentes: ['Chipa 1kg'],
            ultimaCompraEm: '2026-09-22',
        }
        expect(renderizarHistorico(h, agora)).toBeNull()
    })

    it('a partir da segunda compra, diz quantas e o que costuma levar', () => {
        const h: HistoricoCompra = {
            compras: 7,
            produtosFrequentes: ['Pão de Queijo 1kg - 100gr', 'Palito de Queijo 1kg'],
            ultimaCompraEm: '2026-09-22',
        }
        expect(renderizarHistorico(h, agora)).toBe(
            'Já comprou 7 vezes. Costuma levar: Pão de Queijo 1kg - 100gr, Palito de Queijo 1kg.\n' +
            'Última compra: 12 dias atrás.',
        )
    })

    it('diz "hoje" e "ontem" em vez de contar dias', () => {
        const base: HistoricoCompra = {
            compras: 3, produtosFrequentes: ['Chipa 1kg'], ultimaCompraEm: '2026-10-04',
        }
        expect(renderizarHistorico(base, agora)).toContain('Última compra: hoje.')
        expect(renderizarHistorico({ ...base, ultimaCompraEm: '2026-10-03' }, agora))
            .toContain('Última compra: ontem.')
    })

    it('omite a linha de data quando não há data', () => {
        const h: HistoricoCompra = { compras: 2, produtosFrequentes: ['Chipa 1kg'], ultimaCompraEm: null }
        expect(renderizarHistorico(h, agora)).toBe('Já comprou 2 vezes. Costuma levar: Chipa 1kg.')
    })

    it('omite "costuma levar" quando não há produto frequente', () => {
        const h: HistoricoCompra = { compras: 2, produtosFrequentes: [], ultimaCompraEm: '2026-10-03' }
        expect(renderizarHistorico(h, agora)).toBe('Já comprou 2 vezes.\nÚltima compra: ontem.')
    })
})

describe('renderizarPedidoCliente', () => {
    // `ItemPedido` exige `produtoId` (catalogo.ts:147) — objeto sem ele nao compila.
    const itens: ItemPedido[] = [
        { produtoId: 'chipa-1k', nome: 'Chipa 1kg', quantidade: 1, precoUnitario: 40, semEstoque: false },
        { produtoId: 'palito-1k', nome: 'Palito de Queijo 1kg', quantidade: 2, precoUnitario: 40, semEstoque: true },
    ]

    // O ⚠️ de `renderizarPedido` é recado para a EQUIPE. Mandar para o cliente seria
    // falar de estoque — justamente o que a Márcia é proibida de fazer.
    it('nunca vaza o alerta interno de estoque', () => {
        const texto = renderizarPedidoCliente(itens)
        expect(texto).not.toContain('⚠️')
        expect(texto).not.toContain('sem estoque')
    })

    // Uma linha: o texto entra no meio de uma frase de WhatsApp, e multilinha ali
    // quebraria a frase da retomada no meio.
    it('fica numa linha só, separado por vírgula', () => {
        expect(renderizarPedidoCliente(itens)).toBe(
            '1× Chipa 1kg — R$ 40,00, 2× Palito de Queijo 1kg — R$ 80,00',
        )
    })

    it('não quebra com pedido vazio', () => {
        expect(renderizarPedidoCliente([])).toBe('(nenhum item)')
    })
})

describe('montarRetomada', () => {
    it('cita o pedido vindo do banco', () => {
        expect(montarRetomada('1× Chipa 1kg — R$ 40,00')).toBe(
            'Oi! Ficou aqui o seu pedido: 1× Chipa 1kg — R$ 40,00. Quer que eu feche? 😊',
        )
    })
})
