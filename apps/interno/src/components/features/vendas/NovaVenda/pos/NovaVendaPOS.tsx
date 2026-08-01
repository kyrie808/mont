import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, ShoppingBag } from 'lucide-react'
import { cn } from '@mont/shared'
import { PosProductGrid } from './PosProductGrid'
import { PosCart } from './PosCart'
import { FinalizarVendaDrawer, type PagamentoImediato } from './FinalizarVendaDrawer'
import type { DomainProduto, DomainContato } from '../../../../../types/domain'
import type { CartItem } from '../../../../../stores/useCartStore'
import type { VendaFormData } from '../../../../../schemas/venda'

// Ordem preferida (mesma do ProductList mobile) — os carros-chefe primeiro.
const PRODUCT_ORDER = [
    'Massa Pão de Queijo 4kg', 'Massa Pão de Queijo 1kg', 'Chipa Congelada 2kg', 'Chipa Congelada 1kg',
    'Palito de Queijo Congelado 2kg', 'Palito de Queijo Congelado 1kg', 'Pão de Queijo Congelado 2kg', 'Pão de Queijo Congelado 1kg',
]

// Rótulos amigáveis por categoria (mesmo vocabulário do cadastro de produto).
const CATEGORIA_LABEL: Record<string, string> = {
    congelado: 'Congelados', refrigerado: 'Refrigerados', cervejas: 'Cervejas', refrigerantes: 'Refrigerantes', combo: 'Combos',
}

function ordenar(a: DomainProduto, b: DomainProduto): number {
    const ia = PRODUCT_ORDER.findIndex((n) => a.nome.toLowerCase() === n.toLowerCase())
    const ib = PRODUCT_ORDER.findIndex((n) => b.nome.toLowerCase() === n.toLowerCase())
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.nome.localeCompare(b.nome)
}

interface NovaVendaPOSProps {
    produtos: DomainProduto[]
    loading: boolean
    cart: CartItem[]
    cartTotal: number
    selectedContato: DomainContato | null
    onSelectContato: (c: DomainContato | null) => void
    getQuantity: (produtoId: string) => number
    onAdd: (produto: DomainProduto) => void
    onUpdateQuantity: (produtoId: string, delta: number) => void
    onClear: () => void
    onConfirm: (data: VendaFormData, pagamento?: PagamentoImediato) => Promise<void>
    isEditing: boolean
}

// PDV de tela única (só desktop, ≥lg). `fixed inset-0 lg:left-64` = ocupa a viewport à direita
// da SidebarNav (w-64) → a página NÃO rola (sai do fluxo de scroll-de-documento do AppLayout).
export function NovaVendaPOS(props: NovaVendaPOSProps) {
    const { produtos, loading, cart, cartTotal, selectedContato, onSelectContato, getQuantity, onAdd, onUpdateQuantity, onClear, onConfirm, isEditing } = props
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [categoria, setCategoria] = useState('todos')
    const [pagamentoOpen, setPagamentoOpen] = useState(false)

    const totalItens = cart.reduce((acc, i) => acc + i.quantidade, 0)

    // Abas = categorias presentes (na ordem do vocabulário) + "Todos".
    const abas = useMemo(() => {
        const presentes = new Set(produtos.map((p) => p.categoria).filter(Boolean) as string[])
        const ordenadas = Object.keys(CATEGORIA_LABEL).filter((c) => presentes.has(c))
        const extras = [...presentes].filter((c) => !CATEGORIA_LABEL[c])
        return [{ id: 'todos', label: 'Todos' }, ...ordenadas.map((c) => ({ id: c, label: CATEGORIA_LABEL[c] })), ...extras.map((c) => ({ id: c, label: c }))]
    }, [produtos])

    const filtrados = useMemo(() => {
        const termo = search.trim().toLowerCase()
        return produtos
            .filter((p) => categoria === 'todos' || p.categoria === categoria)
            .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.codigo?.toLowerCase().includes(termo))
            .sort(ordenar)
    }, [produtos, search, categoria])

    return (
        <div className="fixed inset-0 z-40 hidden flex-col overflow-hidden bg-background lg:left-64 lg:flex">
            {/* Top bar */}
            <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
                <button
                    onClick={() => navigate(-1)}
                    className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Voltar"
                >
                    <ChevronLeft className="size-5" />
                </button>
                <div className="flex items-center gap-2 shrink-0">
                    <ShoppingBag className="size-5 text-primary" />
                    <h1 className="text-base font-bold text-foreground">{isEditing ? 'Editar Venda' : 'Nova Venda'}</h1>
                </div>
                <div className="relative mx-auto w-full max-w-xl">
                    <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar produto por nome ou código…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-2 focus:ring-ring"
                    />
                </div>
                <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">
                    {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                </span>
            </header>

            {/* Main: grade + carrinho */}
            <div className="grid min-h-0 flex-1 grid-cols-[1fr_400px] gap-4 p-4">
                {/* Esquerda: abas + grade */}
                <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 no-scrollbar">
                        {abas.map((aba) => (
                            <button
                                key={aba.id}
                                onClick={() => setCategoria(aba.id)}
                                className={cn(
                                    'shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                                    categoria === aba.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                {aba.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Carregando produtos…</div>
                    ) : (
                        <PosProductGrid produtos={filtrados} getQuantity={getQuantity} onAdd={onAdd} onUpdateQuantity={onUpdateQuantity} />
                    )}
                </div>

                {/* Direita: carrinho persistente */}
                <PosCart
                    items={cart}
                    total={cartTotal}
                    selectedContato={selectedContato}
                    onSelectContato={onSelectContato}
                    onUpdateQuantity={onUpdateQuantity}
                    onClear={onClear}
                    onCheckout={() => setPagamentoOpen(true)}
                />
            </div>

            {/* Finalizar Venda — side sheet 2 colunas (layout Adega, tema Mont) */}
            <FinalizarVendaDrawer
                isOpen={pagamentoOpen}
                onClose={() => setPagamentoOpen(false)}
                onConfirm={onConfirm}
                cart={cart}
                total={cartTotal}
                contatoId={selectedContato?.id || ''}
                contatoNome={selectedContato?.nome || ''}
                contatoTelefone={selectedContato?.telefone}
            />
        </div>
    )
}
