import { describe, it, expect } from 'vitest'
import { agruparItens, separarPorIdade, hojeSP, somarDias, quandoSP, diaMes, enderecoDiferente, type ItemPedidoLoja } from './pedidosLoja'

/**
 * Pedidos da loja (02/11/2026): a fila que o Gilmar confirma no celular. Estes testes travam a
 * parte da tela — o pedido virar venda é testado no banco (supabase/tests/loja_pedido.sql).
 */

const item = (p: Partial<ItemPedidoLoja> & Pick<ItemPedidoLoja, 'id' | 'nome'>): ItemPedidoLoja => ({
    produtoId: null, quantidade: 1, total: 0, comboId: null, comboInstancia: null, ...p,
})

describe('agruparItens', () => {
    it('junta as linhas do mesmo combo e soma o total; avulsos ficam como vieram', () => {
        const linhas = agruparItens([
            item({ id: '1', nome: 'Balde 4 kg', quantidade: 2, total: 130 }),
            item({ id: '2', nome: 'Balde 4 kg', total: 49.55, comboId: 'mesa', comboInstancia: 'i1' }),
            item({ id: '3', nome: 'Doce de leite', quantidade: 3, total: 66.1, comboId: 'mesa', comboInstancia: 'i1' }),
            item({ id: '4', nome: 'Cocada', quantidade: 3, total: 83.35, comboId: 'mesa', comboInstancia: 'i1' }),
        ])
        expect(linhas).toHaveLength(2)
        expect(linhas[0]).toMatchObject({ tipo: 'produto', nome: 'Balde 4 kg', quantidade: 2, total: 130 })
        expect(linhas[1]).toMatchObject({ tipo: 'combo', comboId: 'mesa', total: 199 })
        if (linhas[1].tipo === 'combo') expect(linhas[1].itens).toEqual([
            { nome: 'Balde 4 kg', quantidade: 1 }, { nome: 'Doce de leite', quantidade: 3 }, { nome: 'Cocada', quantidade: 3 },
        ])
    })

    it('dois combos iguais na sacola continuam separados (instâncias diferentes)', () => {
        const linhas = agruparItens([
            item({ id: '1', nome: 'Doce', total: 79, comboId: 'trio', comboInstancia: 'a' }),
            item({ id: '2', nome: 'Doce', total: 79, comboId: 'trio', comboInstancia: 'b' }),
        ])
        expect(linhas.map((l) => l.chave)).toEqual(['a', 'b'])
    })

    it('a mesma linha de sabor repetida (rateio em 2 preços) soma a quantidade', () => {
        const linhas = agruparItens([
            item({ id: '1', nome: 'Doce', quantidade: 1, total: 26.34, comboId: 'trio', comboInstancia: 'a' }),
            item({ id: '2', nome: 'Doce', quantidade: 2, total: 52.66, comboId: 'trio', comboInstancia: 'a' }),
        ])
        expect(linhas[0]).toMatchObject({ total: 79, itens: [{ nome: 'Doce', quantidade: 3 }] })
    })
})

describe('separarPorIdade', () => {
    it('mais de 3 dias sai da lista principal', () => {
        const agora = new Date('2026-11-10T12:00:00Z')
        const { recentes, antigos } = separarPorIdade([
            { id: 'novo', criadoEm: '2026-11-09T12:00:00Z' },
            { id: 'limite', criadoEm: '2026-11-07T12:00:00Z' },
            { id: 'velho', criadoEm: '2026-11-07T11:59:00Z' },
        ], agora)
        expect(recentes.map((p) => p.id)).toEqual(['novo', 'limite'])
        expect(antigos.map((p) => p.id)).toEqual(['velho'])
    })
})

describe('datas em São Paulo', () => {
    it('hoje vira o dia de SP, não o de UTC (23h de SP já é amanhã em UTC)', () => {
        expect(hojeSP(new Date('2026-11-03T02:30:00Z'))).toBe('2026-11-02')
        expect(hojeSP(new Date('2026-11-03T03:30:00Z'))).toBe('2026-11-03')
    })

    it('somarDias atravessa mês', () => {
        expect(somarDias('2026-11-30', 1)).toBe('2026-12-01')
    })

    it('quandoSP e diaMes no formato BR, 24 h', () => {
        expect(quandoSP('2026-11-03T01:41:00Z')).toBe('02/11, 22:41')
        expect(diaMes('2026-11-05')).toBe('05/11')
    })
})

describe('enderecoDiferente', () => {
    it('cadastro sem endereço: nada a perguntar (a confirmação preenche)', () => {
        expect(enderecoDiferente({ logradouro: 'Rua A', numero: '1' }, { logradouro: null, numero: null })).toBe(false)
        expect(enderecoDiferente({ logradouro: 'Rua A', numero: '1' }, null)).toBe(false)
    })

    it('mesmo endereço com acento/caixa diferente não conta', () => {
        expect(enderecoDiferente({ logradouro: 'Rua São João', numero: '10' }, { logradouro: 'rua sao joao', numero: '10' })).toBe(false)
    })

    it('outra rua ou outro número: pergunta', () => {
        expect(enderecoDiferente({ logradouro: 'Rua Nova', numero: '50' }, { logradouro: 'Rua Antiga', numero: '50' })).toBe(true)
        expect(enderecoDiferente({ logradouro: 'Rua A', numero: '50' }, { logradouro: 'Rua A', numero: '9' })).toBe(true)
    })
})
