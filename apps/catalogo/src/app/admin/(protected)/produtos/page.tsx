
'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import ProductCard from '@/components/admin/ProductCard'
import ProductEditForm from '@/components/admin/ProductEditForm'
import type { AdminProduct } from '@/types/product'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ui/ToastContainer'

export default function AdminProductsPage() {
    const [products, setProducts] = useState<AdminProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null)
    const { toasts, showToast } = useToast()

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

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        // Optimistic update
        setProducts(products.map(p =>
            p.id === id ? { ...p, visivel_catalogo: !currentStatus } : p
        ))

        try {
            const res = await fetch(`/api/admin/produtos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visivel_catalogo: !currentStatus })
            })

            if (!res.ok) {
                // Revert on failure
                setProducts(products.map(p =>
                    p.id === id ? { ...p, visivel_catalogo: currentStatus } : p
                ))
                showToast('Erro ao atualizar status')
            }
        } catch (error) {
            console.error(error)
            // Revert on failure
            setProducts(products.map(p =>
                p.id === id ? { ...p, visivel_catalogo: currentStatus } : p
            ))
            showToast('Erro de conexão')
        }
    }

    const handleUpdateProduct = async (id: string, data: Partial<AdminProduct>) => {
        try {
            console.log('[PATCH] payload:', JSON.stringify(data))
            const res = await fetch(`/api/admin/produtos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (res.ok) {
                const updated = await res.json()
                setProducts(products.map(p => p.id === id ? updated : p))
                setEditingProduct(null)
            } else {
                const errBody = await res.json().catch(() => null)
                console.error('[PATCH] error response:', res.status, errBody)
                showToast('Erro ao salvar alterações')
            }
        } catch (error) {
            console.error(error)
            showToast('Erro ao salvar alterações')
        }
    }

    const filteredProducts = products.filter(p =>
        p.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 pb-20">
            <ToastContainer toasts={toasts} />
            <div className="flex flex-col gap-4 sticky top-0 bg-mont-cream z-10 pt-2 pb-4">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-mont-espresso">
                        Produtos
                    </h2>
                    <p className="text-mont-gray text-sm">
                        Gerencie visibilidade e detalhes do catálogo.
                    </p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-mont-gold"
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
                            onToggleActive={handleToggleActive}
                            onEdit={setEditingProduct}
                        />
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            Nenhum produto encontrado.
                        </div>
                    )}
                </div>
            )}

            {editingProduct && (
                <ProductEditForm
                    product={editingProduct}
                    onClose={() => setEditingProduct(null)}
                    onSave={handleUpdateProduct}
                    showToast={showToast}
                    onImageDeleted={(id) => {
                        setProducts(products.map(p =>
                            p.id === id ? { ...p, sis_imagens_produto: [] } : p
                        ))
                    }}
                />
            )}
        </div>
    )
}
