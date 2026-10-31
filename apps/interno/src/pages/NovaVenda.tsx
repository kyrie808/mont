import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { useCombosMontagem, usePrecosVigentes, useProdutos } from '../hooks/useProdutos'
import { useCartStore, precificar, type CartItem } from '../stores/useCartStore'
import { useToast } from '../components/ui/Toast'
import { useVendas } from '../hooks/useVendas'
import { useContatos } from '../hooks/useContatos'
import type { DomainProduto, CreateVenda } from '../types/domain'
import { formatCurrency } from '@mont/shared'

import { ClientSelector } from '../components/features/vendas/NovaVenda/ClientSelector'
import { ProductList } from '../components/features/vendas/NovaVenda/ProductList'
import { CartSidebar } from '../components/features/vendas/NovaVenda/CartSidebar'
import { CheckoutSidebar } from '../components/features/vendas/NovaVenda/CheckoutSidebar'
import { WizardProgress } from '../components/features/vendas/NovaVenda/WizardProgress'
import { NovaVendaPOS } from '../components/features/vendas/NovaVenda/pos/NovaVendaPOS'
import { SeletorTabelaPreco } from '../components/features/vendas/NovaVenda/SeletorTabelaPreco'
import { MontarComboDialog } from '../components/features/vendas/NovaVenda/MontarComboDialog'
import { precoNaTabela, resumoEscolhas, type EscolhaCombo, type TabelaPreco } from '../utils/tabelaPreco'
import { agoraSimulado } from '../lib/agoraSimulado'
import type { PagamentoImediato, OpcoesEntrega } from '../components/features/vendas/NovaVenda/pos/FinalizarVendaDrawer'
import { vendaService } from '../services/vendaService'
import { User, ShoppingBag, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '../components/ui'
import type { VendaFormData } from '../schemas/venda'

const WIZARD_STEPS = [
    { id: 'cliente', label: 'Cliente', icon: User },
    { id: 'produtos', label: 'Produtos', icon: ShoppingBag },
    { id: 'checkout', label: 'Checkout', icon: CheckCircle },
]

export function NovaVenda() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const location = useLocation()
    const stateContatoId = location.state?.contatoId
    const isEditing = Boolean(id)
    const toast = useToast()

    const { produtos: todosProdutos, loading: loadingTodosProdutos } = useProdutos()
    // Black: combos com escolha de sabor + preço por tabela (Pix/dinheiro, cartão, normal).
    const { combos, loading: loadingCombos } = useCombosMontagem()
    const { precos, campanha } = usePrecosVigentes()
    const loadingProdutos = loadingTodosProdutos || loadingCombos

    const produtosPorId = useMemo(() => new Map(todosProdutos.map((p) => [p.id, p])), [todosProdutos])
    const nomes = useMemo(() => new Map(todosProdutos.map((p) => [p.id, p.nome])), [todosProdutos])
    const montagemPorCombo = useMemo(() => new Map(combos.map((c) => [c.comboId, c])), [combos])
    const { getVendaById, createVenda } = useVendas()
    const { getContatoById } = useContatos()

    // Store
    const {
        items: cart,
        cliente: selectedContato,
        addItem,
        removeItem,
        updateQuantity,
        setCliente: setSelectedContato,
        setItems,
        clearCart,
        ensureIdempotencyKey,
        tabela,
        setTabela,
        trocarEscolhas,
    } = useCartStore()

    // A tabela que vale AGORA: no checkout, a forma de pagamento manda (fiado → normal,
    // cartão → cartão); fora dele, a escolhida no carrinho. Os preços saem dela, na hora.
    const [tabelaCheckout, setTabelaCheckout] = useState<TabelaPreco | null>(null)
    const tabelaAtiva = tabelaCheckout ?? tabela
    const precoNaAtiva = useCallback(
        (p: DomainProduto) => precoNaTabela(precos, p.id, Number(p.preco), tabelaAtiva),
        [precos, tabelaAtiva]
    )
    // A vitrine mostra o preço da tabela ativa (as listas exibem `produto.preco`).
    const produtos = useMemo(
        () => todosProdutos.map((p) => ({ ...p, preco: precoNaAtiva(p) })),
        [todosProdutos, precoNaAtiva]
    )
    const carrinho = useMemo(() => precificar(cart, precoNaAtiva), [cart, precoNaAtiva])
    const itensCheckout = useMemo(() => carrinho.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.subtotal,
    })), [carrinho])

    // Combo com grupo de sabor: 'montar' abre o seletor; grupo sem opção = sabores em definição.
    const acaoCombo = useCallback((p: DomainProduto): 'montar' | 'pendente' | null => {
        if (!p.ehCombo) return null
        const m = montagemPorCombo.get(p.id)
        if (!m || m.grupos.length === 0) return null
        return m.grupos.some((g) => g.opcoes.length === 0) ? 'pendente' : 'montar'
    }, [montagemPorCombo])

    const resumoCombo = useCallback((item: CartItem): string | null => {
        if (item.escolhas && item.escolhas.length > 0) return resumoEscolhas(item.escolhas, nomes)
        if (!item.produto.ehCombo) return null
        const fixos = montagemPorCombo.get(item.produto_id)?.fixos ?? []
        return fixos.map((f) => `${f.quantidade > 1 ? `${f.quantidade}× ` : ''}${nomes.get(f.produtoId) ?? 'Item'}`).join(', ') || null
    }, [nomes, montagemPorCombo])

    // Seletor de sabores: combo novo (sem chave) ou troca de sabores de uma linha do carrinho.
    const [montando, setMontando] = useState<{ comboId: string; chave?: string } | null>(null)

    // Local UI State
    const [currentStep, setCurrentStep] = useState(0)

    // Load existing sale data
    useEffect(() => {
        if (id) {
            const loadVenda = async () => {
                const venda = await getVendaById(id)
                if (venda) {
                    if (venda.contato) setSelectedContato(venda.contato)

                    const items = venda.itens.map(item => ({
                        // Linha de combo vem em itens próprios (às vezes 2 do mesmo sabor): a chave
                        // é a da linha gravada, não o produto.
                        chave: item.id,
                        produto_id: item.produtoId,
                        quantidade: item.quantidade,
                        preco_unitario: item.precoUnitario,
                        subtotal: item.subtotal,
                        produto: item.produto || {
                            id: item.produtoId,
                            nome: 'Produto Desconhecido',
                            codigo: 'N/A',
                            preco: item.precoUnitario,
                            ativo: true,
                            custo: 0,
                            estoqueAtual: 0,
                            estoqueMinimo: 0,
                            criadoEm: new Date().toISOString(),
                            atualizadoEm: new Date().toISOString(),
                            unidade: 'un'
                        } as DomainProduto
                    }))
                    setItems(items)
                }
            }
            loadVenda()
        }
    }, [id, getVendaById, setSelectedContato, setItems])

    // Load pre-selected client from navigation state
    useEffect(() => {
        if (stateContatoId && !id) {
            const loadContato = async () => {
                // If already selected, skip
                if (selectedContato?.id === stateContatoId) return

                const contato = await getContatoById(stateContatoId)
                if (contato) {
                    setSelectedContato(contato)
                }
            }
            loadContato()
        }
    }, [stateContatoId, id, getContatoById, selectedContato, setSelectedContato])

    // Calculations
    const cartTotal = useMemo(
        () => Math.round(carrinho.reduce((acc, item) => acc + item.subtotal * 100, 0)) / 100,
        [carrinho]
    )


    // Handlers
    // Quantidade do produto no carrinho, somando as linhas (dois Combo Família montados = 2).
    const getCartQuantity = (produtoId: string) =>
        cart.filter((i) => i.produto_id === produtoId).reduce((acc, i) => acc + i.quantidade, 0)

    const handleAddToCart = (exibido: DomainProduto) => {
        // Guarda o produto do cadastro (a vitrine mostra uma cópia com o preço da tabela).
        const produto = produtosPorId.get(exibido.id) ?? exibido
        const acao = acaoCombo(produto)
        if (acao === 'pendente') return
        if (acao === 'montar') {
            setMontando({ comboId: produto.id })
            return
        }
        const preco = precoNaAtiva(produto)
        addItem({
            chave: produto.id,
            produto_id: produto.id,
            produto,
            quantidade: 1,
            preco_unitario: preco,
            subtotal: preco,
            // Combo fixo (Dupla Zero): vai como combo, sem sabores a escolher.
            escolhas: produto.ehCombo ? [] : undefined,
        })
        toast.success('Adicionado ao carrinho')
    }

    const confirmarMontagem = (escolhas: EscolhaCombo[]) => {
        if (!montando) return
        if (montando.chave) {
            trocarEscolhas(montando.chave, escolhas)
            toast.success('Sabores trocados')
        } else {
            const produto = produtosPorId.get(montando.comboId)
            if (!produto) return
            const preco = precoNaAtiva(produto)
            addItem({
                chave: crypto.randomUUID(),
                produto_id: produto.id,
                produto,
                quantidade: 1,
                preco_unitario: preco,
                subtotal: preco,
                escolhas,
            })
            toast.success('Combo adicionado')
        }
        setMontando(null)
    }

    const handleUpdateQuantity = (chave: string, delta: number) => {
        const item = cart.find((i) => i.chave === chave)
        if (!item) return

        const newQty = item.quantidade + delta
        if (newQty <= 0) {
            removeItem(chave)
            toast.success('Item removido')
        } else {
            updateQuantity(chave, newQty)
        }
    }


    const handleConfirmSale = useCallback(async (data: VendaFormData, pagamento?: PagamentoImediato, opcoes?: OpcoesEntrega) => {
        // Data simulada (preview/dev): só para VER a campanha. O preview grava no banco de
        // produção e o servidor precifica pela hora real — gravar aqui criaria venda de verdade
        // com outro preço. Nunca acontece em produção (ver lib/agoraSimulado).
        if (agoraSimulado) {
            toast.error('Data simulada: esta tela é só para visualização. A venda não foi gravada.')
            return
        }

        // Pré-check de conexão: sem isto, um submit offline ficava travado/perdido
        // em silêncio. Avisa claramente e nem tenta gravar (carrinho preservado).
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            toast.error('Sem conexão. A venda NÃO foi salva — conecte-se e tente de novo.')
            return
        }

        // Chave de idempotência do checkout atual: persistida no carrinho, faz o
        // backend deduplicar reenvios (sinal fraco) e cliques duplos no mesmo id.
        const idempotencyKey = ensureIdempotencyKey()

        // Retirada/Balcão: o produto já saiu com o cliente, então a venda não é
        // uma entrega pendente. Nasce entregue e o cliente deixa de ser Lead no
        // ato. Entrega de verdade continua 'pendente' até ser marcada.
        const status: CreateVenda['status'] = opcoes?.entregaImediata ? 'entregue' : 'pendente'

        const vendaData = {
            contatoId: data.contato_id || selectedContato?.id || '',
            data: data.data,
            // Com data prevista, o formulário exige como o cliente paga na entrega; essa é a
            // forma real da venda (a intenção 'venda' sozinha não diz ao entregador o que cobrar).
            formaPagamento: data.pagamento_na_entrega ?? data.forma_pagamento,
            taxaEntrega: data.taxa_entrega,
            // Do carrinho, não do formulário: o combo vai com os sabores e o servidor rateia.
            itens: carrinho.map(it => it.produto.ehCombo
                ? { comboId: it.produto_id, quantidade: it.quantidade, escolhas: it.escolhas ?? [] }
                : { produtoId: it.produto_id, quantidade: it.quantidade, precoUnitario: it.preco_unitario, subtotal: it.subtotal }),
            // Com a tabela, quem decide o preço é o servidor (mesma regra que a tela mostrou).
            tabela: opcoes?.tabela ?? tabelaAtiva,
            dataPrevistaPagamento: data.data_prevista_pagamento,
            entregadorId: data.entregador_id ?? null,
            observacaoEntregador: data.observacao_entregador ?? null,
            dataEntregaPrevista: data.data_entrega_prevista || null,
            dinheiroNaEntrega: data.pagamento_na_entrega ? data.pagamento_na_entrega === 'dinheiro' : (data.dinheiro_na_entrega ?? false),
            desconto: data.desconto ?? 0,
            status,
        }

        try {
            const venda = await createVenda(vendaData, idempotencyKey)
            // Quita na hora (opcional): paga o saldo total com o método + conta escolhidos no checkout.
            // Se falhar, a venda já existe (recuperável pelo Quitar no perfil) — não perde a venda.
            if (pagamento) {
                try {
                    await vendaService.quitarVenda(venda.id, pagamento.metodo, pagamento.contaId)
                    toast.success('Venda registrada e quitada!')
                } catch (payErr) {
                    console.error('[NovaVenda] venda criada mas o pagamento falhou:', payErr)
                    toast.error('Venda criada, mas o pagamento não foi registrado — quite pelo perfil da venda.')
                }
            } else {
                toast.success('Venda realizada com sucesso!')
            }
            clearCart()
            setCurrentStep(0)
            navigate(`/vendas/${venda.id}`)
        } catch (error) {
            // Falha real (rede instável/timeout/servidor). NÃO limpamos o carrinho
            // nem a chave: um novo envio reusa a mesma chave e o backend deduplica,
            // então refazer é seguro (não gera duplicata).
            console.error('[NovaVenda] falha ao confirmar venda:', error)
            toast.error('Não foi possível salvar a venda (conexão instável?). O carrinho foi mantido — confira em Vendas antes de refazer; refazer não gera duplicata.')
        }
    }, [selectedContato, createVenda, toast, clearCart, navigate, ensureIdempotencyKey, carrinho, tabelaAtiva])

    const nextStep = (contatoOverride?: typeof selectedContato) => {
        const contato = contatoOverride ?? selectedContato
        if (currentStep === 0 && !contato) {
            toast.error('Selecione um cliente primeiro')
            return
        }
        if (currentStep === 1 && cart.length === 0) {
            toast.error('O carrinho está vazio')
            return
        }
        if (currentStep < 2) setCurrentStep(currentStep + 1)
    }

    const prevStep = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1)
    }

    const avisoSimulado = agoraSimulado && (
        <div role="status" className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs font-semibold text-warning-strong">
            Data simulada: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(agoraSimulado))}. Só visualização — a venda não é gravada.
        </div>
    )

    return (
        <>
            {/* Mobile: wizard de 3 passos (intocado). `contents` = wrapper transparente no fluxo mobile; some no desktop. */}
            <div className="contents lg:hidden">
            <Header
                    title={isEditing ? `Editar Venda #${id?.slice(0, 8)}` : 'Nova Venda'}
                    showBack
                    className="shrink-0"
                    centerTitle
                />

                {avisoSimulado}
                <WizardProgress currentStep={currentStep} steps={WIZARD_STEPS} />

                <div className="flex-1 flex min-w-0 relative">
                    {/* Main Content Area */}
                    <main className="flex-1 flex flex-col min-w-0 bg-muted">
                        {/* Step 0: Cliente */}
                        {currentStep === 0 && (
                            <div className="p-4 flex-1 min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    Selecionar Cliente
                                </h2>
                                <ClientSelector
                                    selectedContato={selectedContato}
                                    onSelect={(c) => {
                                        setSelectedContato(c)
                                        if (c) setTimeout(() => nextStep(c), 300) // Auto-advance after small delay
                                    }}
                                />

                                {selectedContato && (
                                    <Button
                                        variant="primary"
                                        onClick={() => nextStep()}
                                        className="mt-4 w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                    >
                                        Próximo
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Step 1: Produtos */}
                        {currentStep === 1 && (
                            <div className="flex-1 flex flex-col min-w-0 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="p-4 border-b border-border bg-card flex items-center justify-between">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <ShoppingBag className="h-5 w-5 text-primary" />
                                        Adicionar Produtos
                                    </h2>
                                    <div className="text-sm font-medium text-primary">
                                        Total: {formatCurrency(cartTotal)}
                                    </div>
                                </div>
                                {campanha && (
                                    <div className="border-b border-border bg-card px-4 py-3">
                                        <SeletorTabelaPreco tabela={tabela} onChange={setTabela} campanha={campanha} />
                                    </div>
                                )}
                                <div className="flex-1 overflow-y-auto px-4 pb-28 md:pb-4">
                                    <ProductList
                                        produtos={produtos}
                                        loading={loadingProdutos}
                                        getQuantity={getCartQuantity}
                                        onAdd={handleAddToCart}
                                        onUpdateQuantity={handleUpdateQuantity}
                                        acaoCombo={acaoCombo}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Checkout (Full screen mobile, part of main on desktop) */}
                        {currentStep === 2 && (
                            <div className="flex-1 overflow-y-auto p-4 animate-in fade-in scale-in-95 duration-500">
                                <div className="max-w-2xl mx-auto">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5 text-primary" />
                                        Finalizar Venda
                                    </h2>
                                    <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
                                        <CheckoutSidebar
                                            onBack={prevStep}
                                            onConfirm={handleConfirmSale}
                                            total={cartTotal}
                                            contatoId={selectedContato?.id || ''}
                                            contatoNome={selectedContato?.nome || ''}
                                            tabelaEscolhida={tabela}
                                            campanha={campanha}
                                            onTabelaEscolhida={setTabela}
                                            onTabelaEfetiva={setTabelaCheckout}
                                            items={itensCheckout}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Barra de navegação fixa (mobile) — fina + translúcida, acima da BottomNav.
                            `fixed` (não sticky) por causa do overflow-x-hidden do AppLayout. */}
                        {currentStep > 0 && currentStep < 2 && (
                            <div className="fixed inset-x-0 bottom-20 z-30 border-t border-border bg-card/80 backdrop-blur-md px-4 py-2 md:hidden">
                                <div className="flex gap-3 max-w-sm mx-auto">
                                    {currentStep > 0 && (
                                        <Button
                                            variant="outline"
                                            onClick={prevStep}
                                            className="h-12 rounded-2xl flex-1 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                            Voltar
                                        </Button>
                                    )}
                                    <Button
                                        variant="primary"
                                        onClick={() => nextStep()}
                                        disabled={(currentStep === 0 && !selectedContato) || (currentStep === 1 && cart.length === 0)}
                                        className="flex-2 h-12 rounded-2xl font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
                                    >
                                        Próximo
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </main>

                    {/* Desktop Sidebar (Optional, maybe just a summary in steps 0/1) */}
                    <aside className="hidden lg:flex w-96 flex-col border-l border-border bg-card h-full overflow-y-auto">
                        <CartSidebar
                            items={carrinho}
                            total={cartTotal}
                            onUpdateQuantity={handleUpdateQuantity}
                            onCheckout={nextStep}
                            onClear={clearCart}
                            hideCheckoutButton={currentStep === 2}
                        />
                    </aside>
                </div>
            </div>

            {/* Desktop: PDV de tela única (layout Adega, tema Mont). O componente é `hidden lg:flex` + `fixed inset-0 lg:left-64`. */}
            <NovaVendaPOS
                produtos={produtos}
                loading={loadingProdutos}
                cart={carrinho}
                cartTotal={cartTotal}
                selectedContato={selectedContato}
                onSelectContato={setSelectedContato}
                getQuantity={getCartQuantity}
                onAdd={handleAddToCart}
                onUpdateQuantity={handleUpdateQuantity}
                onClear={clearCart}
                onConfirm={handleConfirmSale}
                isEditing={isEditing}
                avisoTopo={avisoSimulado || null}
                seletorTabela={<SeletorTabelaPreco tabela={tabela} onChange={setTabela} campanha={campanha} />}
                tabelaEscolhida={tabela}
                campanha={campanha}
                onTabelaEscolhida={setTabela}
                onTabelaEfetiva={setTabelaCheckout}
                acaoCombo={acaoCombo}
                resumoCombo={resumoCombo}
                onEditarCombo={(chave) => {
                    const item = cart.find((i) => i.chave === chave)
                    if (item) setMontando({ comboId: item.produto_id, chave })
                }}
            />

            {montando && (() => {
                const combo = produtosPorId.get(montando.comboId)
                const montagem = montagemPorCombo.get(montando.comboId)
                if (!combo || !montagem) return null
                const escolhasIniciais = montando.chave ? cart.find((i) => i.chave === montando.chave)?.escolhas : undefined
                return (
                    <MontarComboDialog
                        key={montando.chave ?? montando.comboId}
                        isOpen
                        onClose={() => setMontando(null)}
                        combo={combo}
                        montagem={montagem}
                        produtosPorId={produtosPorId}
                        preco={precoNaAtiva(combo)}
                        escolhasIniciais={escolhasIniciais}
                        onConfirmar={confirmarMontagem}
                    />
                )
            })()}
        </>
    )
}
