import { describe, it, expect } from 'vitest'
import { montarAvisoEntrega, avisosDevidos, pagamentoIndefinido, alertaEquipe, type VendaAviso } from '@mont/shared'

// Camada pura: o texto do aviso no grupo #ENTREGAS e a regra de quando ele sai.

const valeria: VendaAviso = {
    id: '1b25d669-0450-498b-9c00-c1ece557b347',
    dataEntregaPrevista: '2026-10-16',
    criadoEm: '2026-10-15T16:51:59Z',
    avisoEnviadoEm: null,
    status: 'pendente',
    formaPagamento: 'cartao',
    pago: false,
    total: 135,
    valorPago: 0,
    taxaEntrega: 5,
    observacaoEntregador: 'RECEBER ANTES DAS 11H ⚠️ - Levar maquininha',
    cliente: {
        nome: 'Valéria',
        telefone: '11995890951',
        cep: '09051620',
        logradouro: 'Rua Primavera',
        numero: '99',
        complemento: 'Apto 4',
        bairro: 'Jardim Bom Pastor',
        cidade: 'Santo André',
        endereco: null,
    },
    itens: [
        { quantidade: 1, nome: 'Massa Pão de Queijo 1kg' },
        { quantidade: 1, nome: 'Palito de Queijo 1kg' },
        { quantidade: 1, nome: 'Pão de Queijo 2kg - 100gr' },
    ],
}

describe('montarAvisoEntrega — o formato do grupo #ENTREGAS', () => {
    it('Valéria: cartão na entrega, endereço completo, itens', () => {
        expect(montarAvisoEntrega(valeria)).toBe([
            '*🚗Entrega 16/10🚗*',
            '🧀 *Novo Pedido — Mont Distribuidora*',
            '',
            '*Cliente:* Valéria',
            '*Telefone:* (11) 99589-0951',
            '',
            '*Endereço:* 09051-620, Rua Primavera - Nº 99 - Apto 4 - Jardim Bom Pastor - Santo André',
            '*Observação:* RECEBER ANTES DAS 11H ⚠️ - Levar maquininha',
            '━━━━━━━━━━━━━━━━',
            '',
            '*Itens:*',
            '▸ 1 Massa Pão de Queijo 1kg',
            '▸ 1 Palito de Queijo 1kg',
            '▸ 1 Pão de Queijo 2kg - 100gr',
            '',
            '━━━━━━━━━━━━━━━━',
            '*Frete:* R$ 5,00',
            '*Pagamento:* Vai ser pago no cartão ⚠️',
            '*Valor a ser cobrado:* R$135 (frete já incluso ⚠️)',
        ].join('\n'))
    })

    it('Maria: Pix na entrega, sem complemento', () => {
        const maria: VendaAviso = {
            ...valeria,
            formaPagamento: 'pix',
            total: 35,
            observacaoEntregador: 'Tocar na portaria e chamar a Maria (zeladora) ⚠️',
            cliente: {
                nome: 'Maria Perdigão', telefone: '11987779185', cep: '09810580', logradouro: 'Rua Nilo Peçanha',
                numero: '227', complemento: null, bairro: 'Assunção', cidade: 'São Bernardo do Campo', endereco: null,
            },
            itens: [{ quantidade: 1, nome: 'Pão de Queijo 1kg - 50gr' }],
        }
        const texto = montarAvisoEntrega(maria)
        expect(texto).toContain('*Endereço:* 09810-580, Rua Nilo Peçanha - Nº 227 - Assunção - São Bernardo do Campo')
        expect(texto).toContain('*Pagamento:* Pix na entrega ⚠️')
        expect(texto).toContain('*Valor a ser cobrado:* R$35 (frete já incluso ⚠️)')
    })

    it('venda já paga: "Já foi pago !!!" e NÃO COBRAR', () => {
        const texto = montarAvisoEntrega({ ...valeria, pago: true, valorPago: 135 })
        expect(texto).toContain('*Pagamento:* Já foi pago !!!')
        expect(texto).toContain('*Valor a ser cobrado:* NÃO COBRAR — já foi pago ✅')
    })

    it('fiado: "Fiado ⚠️" e NÃO COBRAR, com o valor que vai para a conta do cliente', () => {
        const texto = montarAvisoEntrega({ ...valeria, formaPagamento: 'fiado', total: 35 })
        expect(texto).toContain('*Pagamento:* Fiado ⚠️')
        expect(texto).toContain('*Valor a ser cobrado:* NÃO COBRAR — fiado (R$35 na conta do cliente)')
    })

    it('forma de pagamento indefinida ("venda"): avisa NÃO DEFINIDO e pede alerta', () => {
        const v = { ...valeria, formaPagamento: 'venda' }
        expect(montarAvisoEntrega(v)).toContain('*Pagamento:* ⚠️ NÃO DEFINIDO — confirmar com a equipe')
        expect(pagamentoIndefinido(v)).toBe(true)
        expect(pagamentoIndefinido(valeria)).toBe(false)
        expect(pagamentoIndefinido({ ...v, pago: true })).toBe(false)
    })

    it('pagamento parcial: cobra só o que falta, com centavos quando houver', () => {
        const texto = montarAvisoEntrega({ ...valeria, total: 135.5, valorPago: 50 })
        expect(texto).toContain('*Valor a ser cobrado:* R$85,50 (frete já incluso ⚠️)')
    })

    it('sem observação para o entregador e sem endereço estruturado: usa o endereço livre e "—"', () => {
        const texto = montarAvisoEntrega({
            ...valeria,
            observacaoEntregador: null,
            cliente: { ...valeria.cliente, cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, endereco: 'UPA Demarchi, falar com a Andréa' },
        })
        expect(texto).toContain('*Endereço:* UPA Demarchi, falar com a Andréa')
        expect(texto).toContain('*Observação:* —')
    })

    it('quantidade fracionada sai com vírgula', () => {
        expect(montarAvisoEntrega({ ...valeria, itens: [{ quantidade: 1.5, nome: 'Palito de Queijo 1kg' }] }))
            .toContain('▸ 1,5 Palito de Queijo 1kg')
    })
})

describe('avisosDevidos — quando o aviso sai', () => {
    // 15/10 em Brasília. ISO em UTC: 19:00 BRT = 22:00Z.
    const base = { ...valeria, dataEntregaPrevista: '2026-10-16', criadoEm: '2026-10-15T13:00:00Z', avisoEnviadoEm: null }

    it('antes das 19h, venda de amanhã espera', () => {
        expect(avisosDevidos([base], Date.parse('2026-10-15T21:59:00Z'))).toEqual([])
    })

    it('a partir das 19h, venda de amanhã sai (sem alerta)', () => {
        expect(avisosDevidos([base], Date.parse('2026-10-15T22:00:00Z'))).toEqual([{ vendaId: base.id, alertar: false }])
    })

    it('venda criada depois das 19h para amanhã sai na hora seguinte do relógio', () => {
        const nova = { ...base, criadoEm: '2026-10-15T23:40:00Z' }
        expect(avisosDevidos([nova], Date.parse('2026-10-15T23:45:00Z'))).toEqual([{ vendaId: base.id, alertar: false }])
    })

    it('venda para HOJE criada de madrugada (depois das 19h de ontem) sai na hora, sem alerta', () => {
        const madrugada = { ...base, dataEntregaPrevista: '2026-10-16', criadoEm: '2026-10-16T04:00:00Z' }
        expect(avisosDevidos([madrugada], Date.parse('2026-10-16T04:05:00Z'))).toEqual([{ vendaId: base.id, alertar: false }])
    })

    it('rede de segurança: venda de hoje que devia ter saído ontem às 19h sai às 7h30 e alerta', () => {
        const esquecida = { ...base, dataEntregaPrevista: '2026-10-16', criadoEm: '2026-10-15T13:00:00Z' }
        expect(avisosDevidos([esquecida], Date.parse('2026-10-16T10:29:00Z'))).toEqual([])
        expect(avisosDevidos([esquecida], Date.parse('2026-10-16T10:30:00Z'))).toEqual([{ vendaId: base.id, alertar: true }])
    })

    it('venda de hoje lançada durante o dia sai na hora, sem alerta', () => {
        const doDia = { ...base, dataEntregaPrevista: '2026-10-16', criadoEm: '2026-10-16T14:00:00Z' }
        expect(avisosDevidos([doDia], Date.parse('2026-10-16T14:05:00Z'))).toEqual([{ vendaId: base.id, alertar: false }])
    })

    it('já avisada, sem data prevista, não pendente ou com data passada: nunca sai', () => {
        const agora = Date.parse('2026-10-16T12:00:00Z')
        expect(avisosDevidos([
            { ...base, avisoEnviadoEm: '2026-10-15T22:00:00Z' },
            { ...base, dataEntregaPrevista: null },
            { ...base, status: 'entregue' },
            { ...base, dataEntregaPrevista: '2026-10-15' },
            { ...base, dataEntregaPrevista: '2026-10-18' },
        ], agora)).toEqual([])
    })
})

/*
 * Ajuste do Luccas (16/10/2026): o alerta de ATRASO (7h30) para a Equipe fica desligado por
 * flag — o aviso atrasado continua saindo no #ENTREGAS. O de pagamento indefinido segue.
 */
describe('alertaEquipe — o que vai para o grupo Equipe junto com um aviso', () => {
    const comAtraso = { alertaAtraso: true }
    const semAtraso = { alertaAtraso: false }

    it('atrasado com a flag LIGADA: alerta de atraso', () => {
        expect(alertaEquipe(valeria, true, comAtraso)).toContain('não tinha sido avisada no #ENTREGAS ontem às 19h')
    })

    it('atrasado com a flag DESLIGADA: nada vai para a Equipe', () => {
        expect(alertaEquipe(valeria, true, semAtraso)).toBeNull()
    })

    it('pagamento indefinido alerta mesmo com a flag de atraso desligada', () => {
        const texto = alertaEquipe({ ...valeria, formaPagamento: 'venda' }, true, semAtraso)
        expect(texto).toContain('SEM forma de pagamento definida')
        expect(texto).not.toContain('ontem às 19h')
    })

    it('em dia e com forma definida: nada', () => {
        expect(alertaEquipe(valeria, false, comAtraso)).toBeNull()
    })

    it('os dois motivos juntos num alerta só', () => {
        const texto = alertaEquipe({ ...valeria, formaPagamento: 'venda' }, true, comAtraso)!
        expect(texto.startsWith('⚠️ AVISO DE ENTREGA — ATENÇÃO')).toBe(true)
        expect(texto).toContain('ontem às 19h')
        expect(texto).toContain('SEM forma de pagamento definida')
    })
})
