'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react'
import { ProductCard } from '@/components/catalog'
import { cn } from '@mont/shared'
import type { ProdutoCatalogo } from '@mont/shared'

interface ProductCatalogProps {
    products: ProdutoCatalogo[]
}

export default function ProductCatalog({ products }: ProductCatalogProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState('Todos')
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    // Get unique categories from products
    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.categoria).filter(Boolean))
        return ['Todos', ...Array.from(cats)] as string[]
    }, [products])

    // Filter products based on category and search
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesCategory = activeCategory === 'Todos' || product.categoria === activeCategory
            const matchesSearch = product.nome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                product.subtitulo?.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCategory && matchesSearch
        })
    }, [products, activeCategory, searchQuery])

    return (
        <section className="py-12">
            {/* Filters Bar */}
            <div className="sticky top-20 md:top-28 z-30 bg-mont-cream/80 backdrop-blur-md border-b border-mont-surface mb-12 py-6 px-4 rounded-b-2xl shadow-sm">
                <div className="container mx-auto">
                    <div className="flex flex-col lg:flex-row items-center gap-6 justify-between">
                        {/* Search */}
                        <div className="relative w-full lg:max-w-md group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-mont-gray/50 group-focus-within:text-mont-gold transition-colors" />
                            <input
                                type="text"
                                placeholder="O que você deseja provar hoje?"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-mont-white border border-mont-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-mont-gold/20 focus:border-mont-gold transition-all shadow-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-mont-surface rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4 text-mont-gray" />
                                </button>
                            )}
                        </div>

                        {/* Category Filter (Desktop) */}
                        <div className="hidden lg:flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={cn(
                                        "px-6 py-3 rounded-full font-medium whitespace-nowrap transition-all duration-300 border",
                                        activeCategory === cat
                                            ? "bg-mont-espresso text-white border-mont-espresso shadow-md scale-105"
                                            : "bg-mont-white text-mont-espresso border-mont-surface hover:border-mont-gold hover:text-mont-gold"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Mobile Filter Toggle */}
                        <div className="lg:hidden flex items-center gap-3 w-full">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className="flex-grow flex items-center justify-center gap-2 py-4 bg-mont-white border border-mont-surface rounded-xl font-bold text-mont-espresso"
                            >
                                <SlidersHorizontal className="w-5 h-5" />
                                {activeCategory === 'Todos' ? 'Filtrar Categorias' : activeCategory}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Category Drawer (Simple for now) */}
                    <AnimatePresence>
                        {isFilterOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="lg:hidden overflow-hidden mt-4"
                            >
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => {
                                                setActiveCategory(cat)
                                                setIsFilterOpen(false)
                                            }}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                                activeCategory === cat
                                                    ? "bg-mont-gold text-white"
                                                    : "bg-mont-white text-mont-espresso border border-mont-surface"
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Results Grid */}
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <p className="text-mont-gray">
                        Mostrando <span className="font-bold text-mont-espresso">{filteredProducts.length}</span> produtos
                        {activeCategory !== 'Todos' && (
                            <> em <span className="font-bold text-mont-gold">{activeCategory}</span></>
                        )}
                    </p>
                </div>

                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        <AnimatePresence mode="popLayout">
                            {filteredProducts.map((product, index) => (
                                <motion.div
                                    key={product.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <ProductCard produto={product} index={index} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-20 text-center"
                    >
                        <div className="w-20 h-20 bg-mont-surface rounded-full flex items-center justify-center mx-auto mb-6 text-mont-gold/30">
                            <Search className="w-10 h-10" />
                        </div>
                        <h3 className="font-display text-2xl text-mont-espresso mb-2">Nenhum produto encontrado</h3>
                        <p className="text-mont-gray mb-8">Tente ajustar sua busca ou mudar de categoria.</p>
                        <button
                            onClick={() => {
                                setSearchQuery('')
                                setActiveCategory('Todos')
                            }}
                            className="text-mont-gold font-bold hover:underline"
                        >
                            Limpar todos os filtros
                        </button>
                    </motion.div>
                )}
            </div>
        </section>
    )
}
