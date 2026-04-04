'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Filter, Package, RefreshCw, AlertCircle } from 'lucide-react'
import ProductCard from '@/components/admin/ProductCard'
import ProductEditForm from '@/components/admin/ProductEditForm'
import { cn } from '@mont/shared'
import type { Produto, ProdutoCatalogo } from '@mont/shared'

export default function AdminProductsPage() {
    const [products, setProducts] = useState<ProdutoCatalogo[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingProduct, setEditingProduct] = useState<ProdutoCatalogo | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState('Todos')
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    useEffect(() => {
        fetchProducts()
    }, [])

    const fetchProducts = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/admin/produtos')
            if (!response.ok) throw new Error('Falha ao carregar produtos')
            const data = await response.json()
            setProducts(data)
        } catch (err) {
            console.error(err)
            setError('Não foi possível carregar os produtos. Verifique sua conexão.')
        } finally {
            setIsLoading(false)
        }
    }

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const handleToggleActive = async (id: string, active: boolean) => {
        // Optimistic update
        const originalProducts = [...products]
        setProducts(products.map(p => p.id === id ? { ...p, visivel_catalogo: active } : p))

        try {
            const response = await fetch(`/api/admin/produtos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visivel_catalogo: active })
            })

            if (!response.ok) throw new Error('Falha ao atualizar status')
            showToast(`Produto ${active ? 'ativado' : 'desativado'} com sucesso!`, 'success')
        } catch (err) {
            console.error(err)
            setProducts(originalProducts)
            showToast('Erro ao atualizar status do produto.', 'error')
        }
    }

    const handleUpdateProduct = async (id: string, data: Partial<Produto>) => {
        const response = await fetch(`/api/admin/produtos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        if (!response.ok) throw new Error('Falha ao atualizar produto')
        
        // After update, we refresh the list to get fresh view data
        await fetchProducts()
        setEditingProduct(null)
    }

    const categories = ['Todos', ...Array.from(new Set(products.map(p => p.categoria).filter(Boolean)))] as string[]

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.nome?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.subtitulo?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = activeCategory === 'Todos' || p.categoria === activeCategory
        return matchesSearch && matchesCategory
    })

    return (
        <div className="p-6 md:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-display font-bold text-slate-800">
                        Gestão de <span className="text-mont-gold italic">Produtos</span>
                    </h1>
                    <p className="text-slate-500 font-medium">Controle seu catálogo e estoque em tempo real</p>
                </div>
                
                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-mont-espresso text-white rounded-xl font-bold shadow-lg shadow-mont-espresso/20 hover:bg-mont-gold hover:-translate-y-0.5 transition-all duration-300">
                    <Plus size={20} />
                    Novo Produto
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                    { label: 'Total', value: products.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Visíveis', value: products.filter(p => p.visivel_catalogo).length, icon: RefreshCw, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Estoque Baixo', value: products.filter(p => (p.estoque_atual || 0) < 10).length, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Destaques', value: products.filter(p => p.destaque).length, icon: RefreshCw, color: 'text-amber-500', bg: 'bg-amber-50' },
                ].map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label} 
                        className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4"
                    >
                        <div className={cn("p-3 rounded-xl", stat.bg, stat.color)}>
                            <stat.icon size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-xl font-bold text-slate-800">{stat.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-grow w-full group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-mont-gold transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou descrição..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-mont-gold focus:ring-4 focus:ring-mont-gold/5 transition-all text-sm outline-none"
                    />
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <Filter size={18} />
                    </div>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                                activeCategory === cat
                                    ? "bg-mont-gold text-white shadow-md shadow-mont-gold/20"
                                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="relative min-h-[400px]">
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400">
                        <RefreshCw className="animate-spin" size={32} />
                        <p className="font-medium animate-pulse">Carregando produtos...</p>
                    </div>
                ) : error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center max-w-sm mx-auto">
                        <div className="p-4 bg-red-50 text-red-500 rounded-full">
                            <AlertCircle size={40} />
                        </div>
                        <h3 className="font-bold text-slate-800">Ops, algo deu errado</h3>
                        <p className="text-slate-500 text-sm">{error}</p>
                        <button 
                            onClick={fetchProducts}
                            className="text-mont-gold font-bold text-sm hover:underline"
                        >
                            Tentar novamente
                        </button>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400">
                        <div className="p-4 bg-slate-50 rounded-full">
                            <Package size={40} />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-slate-700">Nenhum produto encontrado</p>
                            <p className="text-sm">Tente ajustar seus filtros de pesquisa</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        <AnimatePresence mode="popLayout">
                            {filteredProducts.map(product => (
                                <motion.div
                                    layout
                                    key={product.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    {/* Assuming Admin ProductCard is updated to handle id correctly */}
                                    <ProductCard
                                        product={product}
                                        onToggleActive={handleToggleActive}
                                        onEdit={setEditingProduct}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Modal de Edição */}
            <AnimatePresence>
                {editingProduct && (
                    <ProductEditForm
                        product={editingProduct}
                        onClose={() => setEditingProduct(null)}
                        onSave={handleUpdateProduct}
                        showToast={showToast}
                    />
                )}
            </AnimatePresence>

            {/* Toasts */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={cn(
                            "fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-xl z-50 flex items-center gap-3 font-bold text-sm",
                            toast.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
                        )}
                    >
                        {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function CheckCircle({ size, ...props }: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}
