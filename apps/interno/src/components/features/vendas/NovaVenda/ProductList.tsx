import { useState, useMemo } from 'react'
import { Search, Plus, Minus, Package } from 'lucide-react'
import { formatCurrency } from '@mont/shared'
import type { DomainProduto } from '../../../../types/domain'

interface ProductListProps {
    produtos: DomainProduto[]
    loading: boolean
    getQuantity: (produtoId: string) => number
    onAdd: (produto: DomainProduto) => void
    onUpdateQuantity: (produtoId: string, delta: number) => void
}

const PRODUCT_ORDER = [
    'Massa Pão de Queijo 4kg',
    'Massa Pão de Queijo 1kg',
    'Chipa Congelada 2kg',
    'Chipa Congelada 1kg',
    'Palito de Queijo Congelado 2kg',
    'Palito de Queijo Congelado 1kg',
    'Pão de Queijo Congelado 2kg',
    'Pão de Queijo Congelado 1kg'
]

export function ProductList({ produtos, loading, getQuantity, onAdd, onUpdateQuantity }: ProductListProps) {
    const [search, setSearch] = useState('')

    const filteredProdutos = useMemo(() => {
        let result = [...produtos]

        if (search) {
            const lower = search.toLowerCase()
            result = result.filter(p =>
                p.nome.toLowerCase().includes(lower) ||
                p.codigo?.toLowerCase().includes(lower)
            )
        }

        return result.sort((a, b) => {
            const indexA = PRODUCT_ORDER.findIndex(name =>
                a.nome.toLowerCase() === name.toLowerCase()
            )
            const indexB = PRODUCT_ORDER.findIndex(name =>
                b.nome.toLowerCase() === name.toLowerCase()
            )

            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB
            }
            if (indexA !== -1) return -1
            if (indexB !== -1) return 1
            return 0
        })
    }, [produtos, search])

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Carregando produtos...</div>
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Buscar produtos…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/60 shadow-card"
                />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto">
                {filteredProdutos.map((produto) => {
                    const qty = getQuantity(produto.id)
                    return (
                        <div
                            key={produto.id}
                            className={`bg-card p-4 rounded-xl border-2 transition-all shadow-card flex flex-col justify-between h-full ${qty > 0
                                ? 'border-primary ring-1 ring-primary'
                                : 'border-border hover:border-primary/50'
                                }`}
                        >
                            <div>
                                {/* Product Image */}
                                <div className="aspect-square w-full relative mb-3 rounded-lg overflow-hidden bg-muted border border-border">
                                    {produto.imagemUrl ? (
                                        <img
                                            src={produto.imagemUrl}
                                            alt={produto.nome}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                            <Package className="h-10 w-10 opacity-50" />
                                        </div>
                                    )}
                                </div>

                                <p className="font-medium text-foreground mb-1 line-clamp-2 text-sm h-10">
                                    {produto.nome}
                                </p>
                                <p className="text-lg font-bold text-primary mb-3 tabular-nums">
                                    {formatCurrency(Number(produto.preco))}
                                </p>
                            </div>

                            {qty > 0 ? (
                                <div className="flex items-center justify-between bg-muted rounded-xl p-1 gap-1">
                                    <button
                                        aria-label="Diminuir quantidade"
                                        onClick={() => onUpdateQuantity(produto.id, -1)}
                                        className="w-11 h-11 bg-background rounded-lg shadow-card flex items-center justify-center active:scale-95 transition-transform border border-border"
                                    >
                                        <Minus className="h-5 w-5 text-foreground" />
                                    </button>
                                    <span className="font-bold text-foreground text-base min-w-[2rem] text-center">
                                        {qty}
                                    </span>
                                    <button
                                        aria-label="Aumentar quantidade"
                                        onClick={() => onUpdateQuantity(produto.id, 1)}
                                        className="w-11 h-11 bg-primary rounded-lg shadow-card flex items-center justify-center active:scale-95 transition-transform"
                                    >
                                        <Plus className="h-5 w-5 text-primary-foreground" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => onAdd(produto)}
                                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 active:scale-95 transition-all text-sm"
                                >
                                    Adicionar
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
