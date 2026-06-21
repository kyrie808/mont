'use client'

import { useState, useEffect } from 'react'
import { Search, Info } from 'lucide-react'
import ProductCard from '@/components/admin/ProductCard'
import type { AdminProduct } from '@/types/product'

export default function AdminProductsPage() {
    const [products, setProducts] = useState<AdminProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchProducts()
    }, [])

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/admin/produtos')
            if (res.ok) {
                const data = await res.json()
                setProducts(data)
            }
        } catch (error) {
            console.error('Failed to fetch products', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = products.filter(p =>
        p.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col gap-4 sticky top-0 bg-background z-10 pt-2 pb-4">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-foreground">
                        Produtos
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Visão somente leitura do catálogo.
                    </p>
                </div>

                {/* Fronteira: o produto é editado no Sistema Interno Mont */}
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
                    <Info size={18} className="mt-0.5 flex-shrink-0 text-primary" />
                    <span>
                        A edição de produtos (preço, custo, apresentação, visibilidade e kits/combos)
                        agora é feita no <strong>Sistema Interno Mont</strong>. Esta tela é somente leitura.
                    </span>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-gray-500">Carregando produtos...</div>
            ) : (
                <div className="grid gap-3">
                    {filteredProducts.map(product => (
                        <ProductCard
                            key={product.id}
                            product={product}
                        />
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            Nenhum produto encontrado.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
