import { describe, it, expect } from 'vitest'
import { textoFechamento, type FechamentoDia } from '@mont/shared'

/**
 * Fechamento do dia (21h de Brasília, grupo da Equipe). Camada pura: o texto a partir dos
 * dados do dia (função fechamento_do_dia no banco).
 */

const placar = { vendas: 4, faturamento: 170, de_anuncio: 1 }
const vazio: FechamentoDia = {
    dia: '2026-10-29', aceitos_sem_venda: [], vendas_com_falta: [], duplicadas: [],
    entregas_amanha: [], separar: [], falta_doces: [], placar,
}

describe('textoFechamento', () => {
    it('sem pendência: só "✅ Dia fechado" e o placar', () => {
        const t = textoFechamento(vazio)
        expect(t.startsWith('✅ *Dia fechado')).toBe(true)
        expect(t).toContain('qui 29/10')
        expect(t).toContain('4 vendas')
        expect(t).toContain('R$ 170,00')
        expect(t).toContain('ticket médio R$ 42,50')
        expect(t).toContain('1 de anúncio')
        expect(t).not.toContain('Entregas de amanhã')
    })

    it('com pendência: as seções que têm item, e o placar no fim', () => {
        const t = textoFechamento({
            ...vazio,
            vendas_com_falta: [{ nome: 'Almerindo', total: 35, faltas: ['sem forma de pagamento'], em: '2026-10-29T19:24:00Z' }],
            duplicadas: [{ nome: 'Almerindo', a_total: 30, b_total: 35, a_em: '2026-10-29T16:33:00Z', b_em: '2026-10-29T19:24:00Z' }],
        })
        expect(t.startsWith('📋 *Fechamento do dia')).toBe(true)
        expect(t).toContain('Vendas de hoje para conferir')
        expect(t).toContain('Almerindo · R$ 35,00 (16:24) — sem forma de pagamento')
        expect(t).toContain('Possíveis duplicadas')
        expect(t).toContain('R$ 30,00 (13:33) e R$ 35,00 (16:24)')
        expect(t).not.toContain('Aceitaram')
        expect(t.indexOf('Placar')).toBeGreaterThan(t.indexOf('duplicadas'))
    })

    it('aceitou sem venda mostra o trecho do cliente da nota do analista', () => {
        const t = textoFechamento({
            ...vazio,
            aceitos_sem_venda: [{ nome: 'Karen', em: '2026-10-24T21:13:51Z', observacao: 'Cliente pediu 2 baldes pequenos. Cliente: "Sim Maria. 02 baldes pequenos."' }],
        })
        expect(t).toContain('Aceitaram e estão sem venda')
        expect(t).toContain('Karen (18:13)')
        expect(t).toContain('"Sim Maria. 02 baldes pequenos."')
    })

    it('entregas de amanhã por bairro, o que separar e falta de doces', () => {
        const t = textoFechamento({
            ...vazio,
            aceitos_sem_venda: [{ nome: 'Ana', em: '2026-10-29T15:00:00Z', observacao: 'Pediu 1 balde.' }],
            entregas_amanha: [{ bairro: 'Rudge Ramos', clientes: ['Ana', 'Thais'] }, { bairro: 'sem bairro', clientes: ['Zé'] }],
            separar: [{ produto: 'Massa Pão de Queijo 4kg', qtd: 3 }, { produto: 'Doce de Milho 680g', qtd: 2 }],
            falta_doces: [{ nome: 'Doce de Milho 680g', estoque: 1, reservado: 3, falta: 2 }],
        })
        expect(t).toContain('*Entregas de amanhã* (3)')
        expect(t).toContain('Rudge Ramos: Ana, Thais')
        expect(t).toContain('3× Massa Pão de Queijo 4kg')
        expect(t).toContain('Doce de Milho 680g: estoque 1, reservado 3 → faltam 2')
    })

    it('nada de cobrança: o texto não fala de fiado a receber nem de dívida', () => {
        const t = textoFechamento(vazio)
        expect(t).not.toMatch(/cobran|dívida|a receber/i)
    })
})
