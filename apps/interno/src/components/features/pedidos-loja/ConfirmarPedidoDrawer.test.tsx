import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmarPedidoDrawer } from './ConfirmarPedidoDrawer'
import type { PedidoLoja } from '../../../services/pedidosLojaService'
import { hojeSP, somarDias } from '../../../utils/pedidosLoja'

/**
 * Confirmar pedido da loja no celular (02/11/2026): frete, entrega e pagamento em toques.
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
    cadastro: null,
    itens: [],
}

const tocar = (nome: RegExp) => fireEvent.click(screen.getAllByRole('button', { name: nome })[0])
const botaoConfirmar = () => screen.getAllByRole('button', { name: /confirmar/i }).at(-1) as HTMLButtonElement

describe('ConfirmarPedidoDrawer', () => {
    it('só libera com frete, entrega e pagamento escolhidos, e manda o que foi escolhido', () => {
        const onConfirmar = vi.fn()
        render(<ConfirmarPedidoDrawer pedido={pedido} confirmando={false} onClose={vi.fn()} onConfirmar={onConfirmar} />)

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
            frete: 10, dataEntrega: somarDias(hojeSP(), 1), forma: 'pix', atualizarEndereco: false,
        })
    })

    it('enquanto confirma, um segundo toque não manda de novo', () => {
        const onConfirmar = vi.fn()
        render(<ConfirmarPedidoDrawer pedido={pedido} confirmando onClose={vi.fn()} onConfirmar={onConfirmar} />)
        tocar(/grátis/i)
        tocar(/hoje/i)
        tocar(/dinheiro/i)
        fireEvent.click(botaoConfirmar())
        expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('cadastro com outro endereço: pergunta, e só troca se marcar', () => {
        const onConfirmar = vi.fn()
        render(
            <ConfirmarPedidoDrawer
                pedido={{ ...pedido, cadastro: { id: 'c1', nome: 'Maria', logradouro: 'Rua Antiga', numero: '9', endereco: 'Rua Antiga, 9' } }}
                confirmando={false}
                onClose={vi.fn()}
                onConfirmar={onConfirmar}
            />,
        )
        tocar(/grátis/i)
        tocar(/hoje/i)
        tocar(/cartão/i)
        fireEvent.click(screen.getAllByRole('checkbox', { name: /trocar o endereço/i })[0])
        fireEvent.click(botaoConfirmar())
        expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ forma: 'cartao', frete: 0, atualizarEndereco: true }))
    })
})
