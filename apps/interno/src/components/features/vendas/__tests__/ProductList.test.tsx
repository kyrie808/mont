import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { DomainProduto } from '../../../../types/domain'
import { ProductList } from '../NovaVenda/ProductList'

/**
 * Lista da Nova Venda no celular (03/11/2026): seções do Catálogo, mais vendidos no topo,
 * "− qtd +" na linha (≥ 44 px) e combo abrindo a escolha de sabores.
 */

const produto = (id: string, nome: string, extra: Partial<DomainProduto> = {}): DomainProduto => ({
    id, nome, codigo: '', preco: 30, ativo: true, custo: 0, estoqueAtual: 0, estoqueMinimo: 0,
    criadoEm: '', atualizadoEm: '', secaoId: null, ordemVitrine: 0, ...extra,
})

const secoes = [
    { id: 'combos', nome: 'Combos', ordem: 0 },
    { id: 'resfriados', nome: 'Resfriados', ordem: 1 },
    { id: 'congelados', nome: 'Congelados', ordem: 2 },
]

const baldinho = produto('baldinho', 'Massa Pão de Queijo 1kg', { secaoId: 'resfriados', apelido: 'baldinho' })
const palito = produto('palito', 'Palito de Queijo 1kg', { secaoId: 'congelados', preco: 40 })
const desativado = produto('off', 'Produto desativado', { secaoId: 'congelados', ativo: false })
const trio = produto('trio', 'Trio Mineiro (Black)', { secaoId: 'combos', ehCombo: true, preco: 79 })
const dupla = produto('dupla', 'Dupla Zero (Black)', { secaoId: 'combos', ehCombo: true, preco: 75 })
const semSecao = produto('solto', 'Produto sem seção')

function renderLista(over: Partial<Parameters<typeof ProductList>[0]> = {}) {
    const props = {
        produtos: [baldinho, palito, desativado, trio, dupla, semSecao],
        loading: false,
        secoes,
        maisVendidos: ['palito'],
        getQuantity: () => 0,
        onAdd: vi.fn(),
        onUpdateQuantity: vi.fn(),
        acaoCombo: (p: DomainProduto) => (p.id === 'trio' ? 'montar' as const : p.id === 'dupla' ? 'pendente' as const : null),
        ...over,
    }
    render(<ProductList {...props} />)
    return props
}

describe('ProductList (Nova Venda no celular)', () => {
    it('agrupa: Mais vendidos, seções na ordem do Catálogo e "Outros" no fim', () => {
        renderLista()
        const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
        expect(titulos).toEqual(['Mais vendidos', 'Combos', 'Resfriados', 'Congelados', 'Outros'])
        const chips = within(screen.getByRole('navigation', { name: 'Seções' })).getAllByRole('button').map((b) => b.textContent)
        expect(chips).toEqual(titulos)
    })

    it('produto inativo não aparece', () => {
        renderLista()
        expect(screen.queryByText('Produto desativado')).not.toBeInTheDocument()
    })

    it('"+" com zero adiciona (onAdd); com quantidade, "+" e "−" mudam a quantidade', () => {
        const zero = renderLista()
        fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar Massa Pão de Queijo 1kg' })[0])
        expect(zero.onAdd).toHaveBeenCalledWith(baldinho)
        expect(screen.queryByRole('button', { name: 'Diminuir Massa Pão de Queijo 1kg' })).not.toBeInTheDocument()
    })

    it('com o item no carrinho mostra "− qtd +" e os botões têm 44 px', () => {
        const props = renderLista({ getQuantity: (id) => (id === 'baldinho' ? 2 : 0) })
        const mais = screen.getByRole('button', { name: 'Adicionar Massa Pão de Queijo 1kg' })
        const menos = screen.getByRole('button', { name: 'Diminuir Massa Pão de Queijo 1kg' })
        expect(mais.parentElement).toHaveTextContent('2')
        fireEvent.click(mais)
        fireEvent.click(menos)
        expect(props.onUpdateQuantity).toHaveBeenNthCalledWith(1, 'baldinho', 1)
        expect(props.onUpdateQuantity).toHaveBeenNthCalledWith(2, 'baldinho', -1)
        expect(props.onAdd).not.toHaveBeenCalled()
        // size-11 = 2.75rem = 44 px (jsdom não calcula layout; a classe é o contrato)
        expect(mais.className).toContain('size-11')
        expect(menos.className).toContain('size-11')
    })

    it('combo com sabores abre a montagem; com sabores em definição, não tem botão', () => {
        const props = renderLista()
        fireEvent.click(screen.getByRole('button', { name: 'Montar Trio Mineiro (Black)' }))
        expect(props.onAdd).toHaveBeenCalledWith(trio)
        expect(screen.getByText('Sabores em definição')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Dupla Zero/ })).not.toBeInTheDocument()
    })

    it('busca pelo apelido vira uma lista só, sem seções nem chips', () => {
        renderLista({ maisVendidos: ['baldinho'] })
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'baldinho' } })
        expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
        expect(screen.queryByRole('navigation', { name: 'Seções' })).not.toBeInTheDocument()
        expect(screen.getAllByText('Massa Pão de Queijo 1kg')).toHaveLength(1)
    })

    it('busca sem resultado oferece limpar', () => {
        renderLista()
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyz' } })
        // o × do campo e o botão do estado vazio limpam igual; clica no do estado vazio
        const limpar = screen.getAllByRole('button', { name: 'Limpar busca' })
        expect(limpar).toHaveLength(2)
        fireEvent.click(limpar[1])
        expect(screen.getByRole('searchbox')).toHaveValue('')
    })
})
