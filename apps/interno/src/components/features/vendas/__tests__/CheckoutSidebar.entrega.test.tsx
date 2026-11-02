import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CheckoutSidebar } from '../NovaVenda/CheckoutSidebar'

vi.mock('../../../../hooks/useEntregadores', () => ({
    useEntregadores: () => ({ entregadores: [] }),
}))
vi.mock('../../../../hooks/useContas', () => ({
    useContas: () => ({ contas: [{ id: 'conta-pix', nome: 'Pix Gilmar', ativo: true }] }),
}))

const defaultProps = {
    onBack: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    total: 95,
    contatoId: '0223a3d9-e59c-4498-a47f-fded3f3fb700',
    contatoNome: 'Vilma Margarete',
    // Black (30/10/2026): tabela de preço. Fora de campanha o seletor não aparece.
    tabelaEscolhida: 'pix' as const,
    campanha: null,
    onTabelaEscolhida: vi.fn(),
    onTabelaEfetiva: vi.fn(),
    items: [
        {
            produto_id: '487fef98-5d10-42e4-a628-2f7d176ce87e',
            quantidade: 1,
            preco_unitario: 95,
            subtotal: 95,
        },
    ],
}

/** Dispara o submit e devolve o 3º argumento (`OpcoesEntrega`) de `onConfirm`. */
async function confirmarEPegarOpcoes(onConfirm: ReturnType<typeof vi.fn>) {
    fireEvent.click(screen.getByRole('button', { name: /confirmar venda/i }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    return onConfirm.mock.calls[0][2]
}

/*
 * Regressão do pedido do Gilmar (08/08/2026): "quando a gente registra a venda já
 * aparece direto como o produto já foi entregue... antes eu tinha que colocar manual".
 *
 * O commit 9e5cd03 fez Retirada nascer entregue, o que é certo no balcão mas errado
 * na rota da UPA — ele vende para vários e só depois separa no carro. O tipo
 * "Entrego depois" devolve o controle sem desfazer o balcão.
 *
 * `entregaImediata` é o bit que `NovaVenda.tsx` traduz em status: true → 'entregue',
 * false → 'pendente'. É por isso que o teste olha para ele.
 */
describe('CheckoutSidebar — tipo de entrega define o status inicial', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('Retirada (padrão) nasce ENTREGUE — o cliente levou na hora', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)

        expect(await confirmarEPegarOpcoes(onConfirm)).toEqual({ entregaImediata: true, tabela: 'pix' })
    })

    it('REGRESSÃO: "Entrego depois" nasce PENDENTE — produto ainda está no carro', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)

        fireEvent.click(screen.getByRole('button', { name: /entrego depois/i }))

        expect(await confirmarEPegarOpcoes(onConfirm)).toEqual({ entregaImediata: false, tabela: 'pix' })
    })

    it('"Entrego depois" não abre frete nem entregador — é ele mesmo quem leva', () => {
        render(<CheckoutSidebar {...defaultProps} />)

        fireEvent.click(screen.getByRole('button', { name: /entrego depois/i }))

        expect(screen.queryByText(/frete/i)).not.toBeInTheDocument()
    })

    it('Entrega nasce PENDENTE e abre os campos de frete', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)

        fireEvent.click(screen.getByRole('button', { name: /^entrega$/i }))
        expect(screen.getByText(/frete/i)).toBeInTheDocument()

        expect(await confirmarEPegarOpcoes(onConfirm)).toEqual({ entregaImediata: false, tabela: 'pix' })
    })
})

/*
 * Aviso automático no #ENTREGAS (Luccas, 16/10/2026): com data prevista, a venda comum
 * precisa dizer como o cliente paga — senão o aviso sai "NÃO DEFINIDO".
 */
describe('CheckoutSidebar — entrega com data prevista exige a forma de pagamento', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function abrirEntregaComData() {
        fireEvent.click(screen.getByRole('button', { name: /^entrega$/i }))
        fireEvent.change(screen.getByLabelText(/data prevista de entrega/i), { target: { value: '2026-10-20' } })
    }

    it('rótulo da instrução para o entregador', () => {
        render(<CheckoutSidebar {...defaultProps} />)
        fireEvent.click(screen.getByRole('button', { name: /^entrega$/i }))
        expect(screen.getByText('Instrução para o entregador (horário, portaria, maquininha)')).toBeInTheDocument()
    })

    it('sem forma escolhida, CONFIRMAR fica bloqueado', async () => {
        render(<CheckoutSidebar {...defaultProps} />)
        abrirEntregaComData()
        await waitFor(() => expect(screen.getByRole('button', { name: /confirmar venda/i })).toBeDisabled())
    })

    it('Pix na entrega: a forma vai junto com a venda, sem pagamento agora', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)
        abrirEntregaComData()
        fireEvent.click(screen.getByRole('button', { name: /^pix$/i }))

        fireEvent.click(screen.getByRole('button', { name: /confirmar venda/i }))
        await waitFor(() => expect(onConfirm).toHaveBeenCalled())
        const [dados, pagamento] = onConfirm.mock.calls[0]
        expect(dados.pagamento_na_entrega).toBe('pix')
        expect(dados.data_entrega_prevista).toBe('2026-10-20')
        expect(pagamento).toBeUndefined()
    })

    it('Já pago: exige a conta e registra o pagamento junto', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)
        abrirEntregaComData()
        fireEvent.click(screen.getByRole('button', { name: /já pago/i }))
        expect(screen.getByRole('button', { name: /confirmar venda/i })).toBeDisabled()

        fireEvent.change(screen.getByLabelText(/conta que recebeu/i), { target: { value: 'conta-pix' } })
        fireEvent.click(screen.getByRole('button', { name: /confirmar venda/i }))
        await waitFor(() => expect(onConfirm).toHaveBeenCalled())
        const [dados, pagamento] = onConfirm.mock.calls[0]
        expect(dados.pagamento_na_entrega).toBeNull()
        expect(pagamento).toEqual({ metodo: 'pix', contaId: 'conta-pix' })
    })

    it('Fiado com data não pede forma (o aviso já diz "Fiado")', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)
        fireEvent.click(screen.getByRole('button', { name: /fiado/i }))
        abrirEntregaComData()
        expect(screen.queryByText(/como o cliente vai pagar/i)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /confirmar venda/i }))
        await waitFor(() => expect(onConfirm).toHaveBeenCalled())
        expect(onConfirm.mock.calls[0][0].pagamento_na_entrega).toBeNull()
    })
})

/*
 * Black (30/10/2026): o preço depende de como o cliente paga. Pix/dinheiro → preço Black,
 * cartão → tabela de cartão, fiado → normal. A tabela vai junto com a venda (opcoes.tabela)
 * e a `criar_venda` recusa combinação incoerente (fiado no preço do Pix).
 */
describe('CheckoutSidebar — tabela de preço da venda', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function abrirEntregaComData() {
        fireEvent.click(screen.getByRole('button', { name: /^entrega$/i }))
        fireEvent.change(screen.getByLabelText(/data prevista de entrega/i), { target: { value: '2026-11-04' } })
    }

    it('fiado vai sempre no preço normal, mesmo com Pix escolhido no carrinho', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)
        fireEvent.click(screen.getByRole('button', { name: /fiado/i }))
        expect((await confirmarEPegarOpcoes(onConfirm)).tabela).toBe('normal')
    })

    it('cartão na entrega leva a tabela de cartão', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} onConfirm={onConfirm} />)
        abrirEntregaComData()
        fireEvent.click(screen.getByRole('button', { name: /^cartão$/i }))
        expect((await confirmarEPegarOpcoes(onConfirm)).tabela).toBe('cartao')
    })

    it('sem forma definida, vale a tabela escolhida no carrinho', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined)
        render(<CheckoutSidebar {...defaultProps} tabelaEscolhida="cartao" onConfirm={onConfirm} />)
        expect((await confirmarEPegarOpcoes(onConfirm)).tabela).toBe('cartao')
    })

    it('avisa a NovaVenda a tabela que vale agora (para o total mostrar o preço certo)', async () => {
        const onTabelaEfetiva = vi.fn()
        render(<CheckoutSidebar {...defaultProps} onTabelaEfetiva={onTabelaEfetiva} />)
        fireEvent.click(screen.getByRole('button', { name: /fiado/i }))
        await waitFor(() => expect(onTabelaEfetiva).toHaveBeenLastCalledWith('normal'))
    })
})
