import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { useProdutos } from '../hooks/useProdutos'
import { useCartStore } from '../stores/useCartStore'
import { useToast } from '../components/ui/Toast'
import { useVendas } from '../hooks/useVendas'
import { useContatos } from '../hooks/useContatos'
import type { DomainProduto } from '../types/domain'
import { formatCurrency } from '@mont/shared'

import { ClientSelector } from '../components/features/vendas/NovaVenda/ClientSelector'
import { ProductList } from '../components/features/vendas/NovaVenda/ProductList'
import { CartSidebar } from '../components/features/vendas/NovaVenda/CartSidebar'
import { CheckoutSidebar } from '../components/features/vendas/NovaVenda/CheckoutSidebar'
import { WizardProgress } from '../components/features/vendas/NovaVenda/WizardProgress'
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

    const { produtos, loading: loadingProdutos } = useProdutos()
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
        clearCart
    } = useCartStore()

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
        () => cart.reduce((acc, item) => acc + item.subtotal, 0),
        [cart]
    )


    // Handlers
    const getCartQuantity = (produtoId: string) => {
        const item = cart.find((i) => i.produto_id === produtoId)
        return item?.quantidade || 0
    }

    const handleAddToCart = (produto: DomainProduto) => {
        addItem({
            produto_id: produto.id,
            produto,
            quantidade: 1,
            preco_unitario: Number(produto.preco),
            subtotal: Number(produto.preco),
        })
        toast.success('Adicionado ao carrinho')
    }

    const handleUpdateQuantity = (produtoId: string, delta: number) => {
        const item = cart.find((i) => i.produto_id === produtoId)
        if (!item) return

        const newQty = item.quantidade + delta
        if (newQty <= 0) {
            removeItem(produtoId)
            toast.success('Item removido')
        } else {
            updateQuantity(produtoId, newQty)
        }
    }


    const handleConfirmSale = useCallback(async (data: VendaFormData) => {
        try {
            const vendaData = {
                contatoId: data.contato_id || selectedContato?.id || '',
                data: data.data,
                formaPagamento: data.forma_pagamento,
                taxaEntrega: data.taxa_entrega,
                itens: data.itens.map(it => ({
                    produtoId: it.produto_id,
                    quantidade: it.quantidade,
                    precoUnitario: it.preco_unitario,
                    subtotal: it.subtotal
                })),
                dataPrevistaPagamento: data.data_prevista_pagamento,
            }
            const venda = await createVenda(vendaData)
            if (venda) {
                toast.success('Venda realizada com sucesso!')
                clearCart()
                setCurrentStep(0)
                navigate(`/vendas/${venda.id}`)
            } else {
                toast.error('Erro ao realizar venda. Tente novamente.')
            }
        } catch (_error) {
            toast.error('Ocorreu um erro ao processar a venda')
        }
    }, [selectedContato, createVenda, toast, clearCart, navigate])

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

    return (
        <>
            <Header
                    title={isEditing ? `Editar Venda #${id?.slice(0, 8)}` : 'Nova Venda'}
                    showBack
                    className="flex-shrink-0"
                    centerTitle
                />

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
                                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-card flex items-center justify-between">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <ShoppingBag className="h-5 w-5 text-primary" />
                                        Adicionar Produtos
                                    </h2>
                                    <div className="text-sm font-medium text-primary">
                                        Total: {formatCurrency(cartTotal)}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4">
                                    <ProductList
                                        produtos={produtos}
                                        loading={loadingProdutos}
                                        getQuantity={getCartQuantity}
                                        onAdd={handleAddToCart}
                                        onUpdateQuantity={handleUpdateQuantity}
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
                                    <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                        <CheckoutSidebar
                                            onBack={prevStep}
                                            onConfirm={handleConfirmSale}
                                            total={cartTotal}
                                            contatoId={selectedContato?.id || ''}
                                            contatoNome={selectedContato?.nome || ''}
                                            items={cart.map(item => ({
                                                produto_id: item.produto_id,
                                                quantidade: item.quantidade,
                                                preco_unitario: item.preco_unitario,
                                                subtotal: item.subtotal
                                            }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bottom Navigation Bar — fixed height, outside scroll, hidden on checkout */}
                        {currentStep > 0 && currentStep < 2 && (
                            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-card p-4 md:hidden">
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
                                        className="flex-[2] h-12 rounded-2xl font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
                                    >
                                        Próximo
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </main>

                    {/* Desktop Sidebar (Optional, maybe just a summary in steps 0/1) */}
                    <aside className="hidden lg:flex w-96 flex-col border-l border-gray-200 dark:border-gray-700 bg-card h-full overflow-y-auto">
                        <CartSidebar
                            items={cart}
                            total={cartTotal}
                            onUpdateQuantity={handleUpdateQuantity}
                            onCheckout={nextStep}
                            onClear={clearCart}
                            hideCheckoutButton={currentStep === 2}
                        />
                    </aside>
                </div>

        </>
    )
}
