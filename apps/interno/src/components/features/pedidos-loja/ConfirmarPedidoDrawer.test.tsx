import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmarPedidoDrawer } from './ConfirmarPedidoDrawer'
import type { ConfirmarPedidoLoja, PedidoLoja } from '../../../services/pedidosLojaService'
import type { DomainContato } from '../../../types/domain'
import { hojeSP, somarDias } from '../../../utils/pedidosLoja'

/**
 * Confirmar pedido da loja no celular (02/11/2026): frete, entrega e pagamento em toques.
 * Parte F (04/11/2026): retirada, frete estimado já marcado ("a combinar" obriga escolher),
 * forma preferida marcada e "quem indicou" para o Ranking.
 * O Drawer desenha o conteúdo duas vezes (painel do celular e lateral do desktop), por isso
 * os testes pegam o primeiro de cada.
 */

const pedido: PedidoLoja = {
    id: 'ped-1',
    numero: 78,
    nome: 'Maria',
    telefone: '11900001701',
    endereco: 'Rua Nova, 50 - Rudge Ramos, São Bernardo do Campo/SP - CEP 09750-000',
    logradouro: 'Rua Nova',
    numeroEndereco: '50',
    total: 329,
    criadoEm: '2026-11-03T01:41:00Z',
    ofertasWhatsapp: false,
    entrega: 'entrega',
    freteEstimado: null,
    pagamentoPreferido: null,
    indicadoPor: null,
    cadastro: null,
    itens: [],
}

const semBusca = () => Promise.resolve([] as DomainContato[])
const tocar = (nome: RegExp) => fireEvent.click(screen.getAllByRole('button', { name: nome })[0])
const botaoConfirmar = () => screen.getAllByRole('button', { name: /confirmar/i }).at(-1) as HTMLButtonElement
const ativo = (nome: RegExp) => screen.getAllByRole('button', { name: nome })[0].getAttribute('aria-pressed')

type AoConfirmar = (dados: ConfirmarPedidoLoja) => void

function abrir(p: PedidoLoja, extra: { onConfirmar?: ReturnType<typeof vi.fn<AoConfirmar>>; buscar?: (t: string) => Promise<DomainContato[]>; confirmando?: boolean } = {}) {
    const onConfirmar = extra.onConfirmar ?? vi.fn<AoConfirmar>()
    render(
        <ConfirmarPedidoDrawer
            pedido={p}
            confirmando={extra.confirmando ?? false}
            onClose={vi.fn()}
            onConfirmar={onConfirmar}
            buscarContatos={extra.buscar ?? semBusca}
        />,
    )
    return onConfirmar
}

describe('ConfirmarPedidoDrawer', () => {
    it('só libera com frete, entrega e pagamento escolhidos, e manda o que foi escolhido', () => {
        const onConfirmar = abrir(pedido)

        expect(botaoConfirmar().disabled).toBe(true)
        tocar(/R\$\s*10,00/)
        tocar(/amanhã/i)
        expect(botaoConfirmar().disabled).toBe(true)
        tocar(/^pix$/i)
        expect(botaoConfirmar().disabled).toBe(false)
        expect(botaoConfirmar().textContent).toMatch(/339,00/)

        fireEvent.click(botaoConfirmar())
        expect(onConfirmar).toHaveBeenCalledTimes(1)
        expect(onConfirmar).toHaveBeenCalledWith({
            frete: 10, dataEntrega: somarDias(hojeSP(), 1), forma: 'pix', atualizarEndereco: false, indicadoPorId: null,
        })
    })

    it('enquanto confirma, um segundo toque não manda de novo', () => {
        const onConfirmar = abrir(pedido, { confirmando: true })
        tocar(/grátis/i)
        tocar(/hoje/i)
        tocar(/dinheiro/i)
        fireEvent.click(botaoConfirmar())
        expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('cadastro com outro endereço: pergunta, e só troca se marcar', () => {
        const onConfirmar = abrir({
            ...pedido,
            cadastro: { id: 'c1', nome: 'Maria', logradouro: 'Rua Antiga', numero: '9', endereco: 'Rua Antiga, 9', indicador: null },
        })
        tocar(/grátis/i)
        tocar(/hoje/i)
        tocar(/cartão/i)
        fireEvent.click(screen.getAllByRole('checkbox', { name: /trocar o endereço/i })[0])
        fireEvent.click(botaoConfirmar())
        expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ forma: 'cartao', frete: 0, atualizarEndereco: true }))
    })

    it('frete estimado pelo CEP e forma preferida já vêm marcados', () => {
        const onConfirmar = abrir({ ...pedido, freteEstimado: 5, pagamentoPreferido: 'dinheiro' })
        expect(ativo(/R\$\s*5,00/)).toBe('true')
        expect(ativo(/^dinheiro$/i)).toBe('true')
        tocar(/hoje/i)
        expect(botaoConfirmar().disabled).toBe(false)
        fireEvent.click(botaoConfirmar())
        expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ frete: 5, forma: 'dinheiro' }))
    })

    it('frete "a combinar" não aceita zero por padrão: obriga escolher (Grátis de propósito)', () => {
        abrir({ ...pedido, freteEstimado: null, pagamentoPreferido: 'pix' })
        tocar(/hoje/i)
        expect(ativo(/grátis/i)).toBe('false')
        expect(botaoConfirmar().disabled).toBe(true)
        expect(screen.getAllByText(/frete a combinar/i).length).toBeGreaterThan(0)
        tocar(/grátis/i)
        expect(botaoConfirmar().disabled).toBe(false)
    })

    it('retirada: sem frete, pede o dia de retirada e confirma com frete 0', () => {
        const onConfirmar = abrir({ ...pedido, entrega: 'retirada', endereco: '', pagamentoPreferido: 'pix' })
        expect(screen.queryAllByRole('button', { name: /grátis/i })).toHaveLength(0)
        expect(screen.getAllByText('Dia de retirada').length).toBeGreaterThan(0)
        tocar(/amanhã/i)
        fireEvent.click(botaoConfirmar())
        expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ frete: 0, dataEntrega: somarDias(hojeSP(), 1), forma: 'pix' }))
    })

    it('"quem indicou": busca pelo que o cliente escreveu e manda o cliente escolhido', async () => {
        const ana = { id: 'c-ana', nome: 'Ana Indicadora', telefone: '11999990000' } as DomainContato
        const buscar = vi.fn(() => Promise.resolve([ana]))
        const onConfirmar = abrir({ ...pedido, indicadoPor: 'Ana', freteEstimado: 5, pagamentoPreferido: 'pix' }, { buscar })

        fireEvent.click((await screen.findAllByRole('button', { name: /Ana Indicadora/ }))[0])
        expect(buscar).toHaveBeenCalledWith('Ana')
        tocar(/hoje/i)
        fireEvent.click(botaoConfirmar())
        expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ indicadoPorId: 'c-ana' }))
    })

    it('cliente que já tem indicador no cadastro: só mostra, não pergunta', () => {
        abrir({
            ...pedido,
            indicadoPor: 'Ana',
            cadastro: { id: 'c1', nome: 'Maria', logradouro: 'Rua Nova', numero: '50', endereco: null, indicador: { id: 'c-ze', nome: 'Zé' } },
        })
        expect(screen.getAllByText(/Já indicado por Zé/).length).toBeGreaterThan(0)
    })
})
