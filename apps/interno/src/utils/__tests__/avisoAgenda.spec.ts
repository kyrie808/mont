import { describe, it, expect } from 'vitest'
import { montarAvisoAgenda, entraNosAtrasados, MAX_NOMES_VENCIMENTO, type ItemAvisoAgenda } from '@mont/shared'

// Camada pura: o texto do aviso diário da Agenda no grupo Equipe (W6, 8h).

function item(p: Partial<ItemAvisoAgenda> & Pick<ItemAvisoAgenda, 'origem' | 'data'>): ItemAvisoAgenda {
    return {
        hora: null,
        titulo: 'Cliente',
        situacao: 'pendente',
        contatoNome: null,
        valor: null,
        responsavel: null,
        ...p,
    }
}

const venc = (data: string, nome: string, valor: number) =>
    item({ origem: 'vencimento', data, titulo: nome, contatoNome: nome, valor })

describe('montarAvisoAgenda', () => {
    it('dia vazio → null (não envia)', () => {
        expect(montarAvisoAgenda({ dia: '2026-10-20', atrasados: [], doDia: [], amanha: [] })).toBeNull()
    })

    it('só item que não entra no aviso (conta a pagar, lembrete feito) → null', () => {
        expect(montarAvisoAgenda({
            dia: '2026-10-20',
            atrasados: [],
            doDia: [
                item({ origem: 'conta_pagar', data: '2026-10-20', valor: 100 }),
                item({ origem: 'lembrete', data: '2026-10-20', situacao: 'feito', titulo: 'Já foi' }),
            ],
            amanha: [],
        })).toBeNull()
    })

    it('texto completo: atrasados, hoje por responsável, amanhã', () => {
        const texto = montarAvisoAgenda({
            dia: '2026-10-20',
            atrasados: [
                item({ origem: 'lembrete', data: '2026-10-17', titulo: 'Ligar sobre o pedido', contatoNome: 'Ana Maria Oliveira' }),
                venc('2026-09-10', 'Carla', 35),
                venc('2026-10-01', 'Bruno', 1500),
            ],
            doDia: [
                item({ origem: 'lembrete', data: '2026-10-20', titulo: 'Gilmar: depósito de R$ 30 da Patrícia', contatoNome: 'Patricia Mara Botias (Copa)', responsavel: 'gilmar' }),
                item({ origem: 'lembrete', data: '2026-10-20', hora: '14:30:00', titulo: 'Retomar cobrança — Carol', contatoNome: 'Caroline Gomes (Carol)', responsavel: 'luccas' }),
                item({ origem: 'lembrete', data: '2026-10-20', titulo: 'Conferir estoque', responsavel: null }),
                venc('2026-10-20', 'Diana', 60),
                item({ origem: 'entrega', data: '2026-10-20', valor: 80 }),
                item({ origem: 'retomada', data: '2026-10-20' }),
                item({ origem: 'retomada', data: '2026-10-20' }),
            ],
            amanha: [
                venc('2026-10-21', 'Elisa', 40),
                venc('2026-10-21', 'Fábio', 45.5),
                item({ origem: 'lembrete', data: '2026-10-21', titulo: 'Retomar cobrança — Juciane' }),
            ],
        })

        expect(texto).toBe([
            '📅 *Agenda Mont — terça, 20/10*',
            '',
            '⚠️ *Atrasados*',
            '1 lembrete:',
            '• Ana Maria Oliveira — Ligar sobre o pedido (17/10)',
            '2 vencimentos · R$ 1.535,00',
            'Carla, Bruno',
            '',
            '📌 *Hoje*',
            'Gilmar:',
            '• depósito de R$ 30 da Patrícia',
            'Luccas:',
            '• 14h30 Retomar cobrança — Carol',
            'Sem responsável:',
            '• Conferir estoque',
            'Vencimentos: 1 · R$ 60,00',
            '1 entrega · 2 retomadas',
            '',
            '🔜 *Amanhã (21/10)*: 2 vencimentos (R$ 85,50) · 1 lembrete',
        ].join('\n'))
    })

    it('dinheiro com separador de milhar', () => {
        const texto = montarAvisoAgenda({
            dia: '2026-10-20',
            atrasados: [venc('2026-10-01', 'Grande', 1234567.8)],
            doDia: [],
            amanha: [],
        })
        expect(texto).toContain('1 vencimento · R$ 1.234.567,80')
    })

    it(`vencimentos atrasados: até ${MAX_NOMES_VENCIMENTO} nomes, mais antigos primeiro, sem repetir, depois "+N"`, () => {
        const atrasados = [
            venc('2026-10-07', 'G', 10), venc('2026-10-01', 'A', 10), venc('2026-10-02', 'B', 10),
            venc('2026-10-02', 'A', 10), venc('2026-10-03', 'C', 10), venc('2026-10-04', 'D', 10),
            venc('2026-10-05', 'E', 10), venc('2026-10-06', 'F', 10),
        ]
        const texto = montarAvisoAgenda({ dia: '2026-10-20', atrasados, doDia: [], amanha: [] })
        expect(texto).toContain('8 vencimentos · R$ 80,00\nA, B, C, D, E +2')
    })

    it('hoje vazio com atraso: diz "Nada marcado." e não mostra amanhã vazio', () => {
        const texto = montarAvisoAgenda({ dia: '2026-10-24', atrasados: [venc('2026-10-01', 'A', 10)], doDia: [], amanha: [] })
        expect(texto).toContain('📌 *Hoje*\nNada marcado.')
        expect(texto).not.toContain('Amanhã')
        expect(texto).toContain('sábado, 24/10')
    })

    it('título que já cita o cliente não repete o nome; sem cliente, só o título', () => {
        const texto = montarAvisoAgenda({
            dia: '2026-10-20',
            atrasados: [
                item({ origem: 'lembrete', data: '2026-10-18', titulo: 'Rosângela Maradona — retomar', contatoNome: 'Rosangela Maradona' }),
                item({ origem: 'lembrete', data: '2026-10-19', titulo: 'Conferir 16 vendas sem pagamento' }),
            ],
            doDia: [],
            amanha: [],
        })
        expect(texto).toContain('• Rosângela Maradona — retomar (18/10)')
        expect(texto).toContain('• Conferir 16 vendas sem pagamento (19/10)')
    })

    it('lembrete feito não entra em atrasados, hoje nem amanhã', () => {
        const feito = { situacao: 'feito', titulo: 'Já resolvido' }
        const texto = montarAvisoAgenda({
            dia: '2026-10-20',
            atrasados: [item({ origem: 'lembrete', data: '2026-10-18', ...feito }), venc('2026-10-01', 'A', 10)],
            doDia: [item({ origem: 'lembrete', data: '2026-10-20', ...feito })],
            amanha: [item({ origem: 'lembrete', data: '2026-10-21', ...feito })],
        })
        expect(texto).not.toContain('Já resolvido')
        expect(texto).not.toContain('lembrete')
    })
})

describe('entraNosAtrasados', () => {
    it('lembrete pendente e vencimento sim; feito, entrega, conta, retomada não', () => {
        expect(entraNosAtrasados({ origem: 'lembrete', situacao: 'pendente' })).toBe(true)
        expect(entraNosAtrasados({ origem: 'vencimento', situacao: 'pendente' })).toBe(true)
        expect(entraNosAtrasados({ origem: 'lembrete', situacao: 'feito' })).toBe(false)
        expect(entraNosAtrasados({ origem: 'entrega', situacao: 'pendente' })).toBe(false)
        expect(entraNosAtrasados({ origem: 'conta_pagar', situacao: 'pendente' })).toBe(false)
        expect(entraNosAtrasados({ origem: 'retomada', situacao: 'pendente' })).toBe(false)
    })
})
