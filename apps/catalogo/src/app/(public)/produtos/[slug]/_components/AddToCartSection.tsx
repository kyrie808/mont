'use client'

import React, { useState } from 'react'
import { Plus, Minus, ShoppingCart, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@mont/shared'
import { useCartStore } from '@/lib/cart/store'
import type { ProdutoCatalogo } from '@mont/shared'

interface AddToCartSectionProps {
    product: ProdutoCatalogo
    compact?: boolean
}

export default function AddToCartSection({ product, compact = false }: AddToCartSectionProps) {
    const [quantity, setQuantity] = useState(1)
    const [isAdded, setIsAdded] = useState(false)
    const { addItem } = useCartStore()

    const handleIncrement = () => setQuantity(prev => Math.min(prev + 1, 99))
    const handleDecrement = () => setQuantity(prev => Math.max(prev - 1, 1))

    const handleAddToCart = () => {
        addItem(product, quantity)
        setIsAdded(true)
        setTimeout(() => setIsAdded(false), 2000)
    }

    if (compact) {
        return (
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center bg-mont-surface rounded-lg p-1">
                    <button
                        onClick={handleDecrement}
                        className="p-2 hover:text-mont-gold transition-colors"
                        aria-label="Diminuir quantidade"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                    <span className="w-10 text-center font-bold text-mont-espresso">
                        {quantity}
                    </span>
                    <button
                        onClick={handleIncrement}
                        className="p-2 hover:text-mont-gold transition-colors"
                        aria-label="Aumentar quantidade"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <button
                    onClick={handleAddToCart}
                    disabled={isAdded}
                    className={cn(
                        "flex-grow py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300",
                        isAdded ? "bg-green-500 text-white" : "bg-mont-gold text-white hover:bg-mont-espresso shadow-md"
                    )}
                >
                    <AnimatePresence mode="wait">
                        {isAdded ? (
                            <motion.span
                                key="added"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-center gap-2"
                            >
                                <Check className="w-5 h-5" />
                                Adicionado!
                            </motion.span>
                        ) : (
                            <motion.span
                                key="add"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-center gap-2"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                Comprar Agora
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Quantidade Selector */}
                <div className="flex items-center bg-mont-surface rounded-xl p-1.5 border border-mont-cream self-stretch sm:self-auto">
                    <button
                        onClick={handleDecrement}
                        className="p-3 text-mont-espresso hover:text-mont-gold transition-colors"
                        aria-label="Diminuir quantidade"
                    >
                        <Minus className="w-6 h-6" />
                    </button>
                    <span className="w-14 text-center font-display text-xl text-mont-espresso">
                        {quantity}
                    </span>
                    <button
                        onClick={handleIncrement}
                        className="p-3 text-mont-espresso hover:text-mont-gold transition-colors"
                        aria-label="Aumentar quantidade"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </div>

                {/* Add to Cart Button */}
                <button
                    onClick={handleAddToCart}
                    disabled={isAdded}
                    className={cn(
                        "flex-grow py-4 px-8 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-500 relative overflow-hidden self-stretch sm:self-auto min-w-[200px]",
                        isAdded ? "bg-green-500 text-white" : "bg-mont-gold text-white hover:bg-mont-espresso shadow-lg hover:shadow-xl group"
                    )}
                >
                    <AnimatePresence mode="wait">
                        {isAdded ? (
                            <motion.span
                                key="added"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex items-center gap-2"
                            >
                                <Check className="w-6 h-6" />
                                Adicionado ao Carrinho!
                            </motion.span>
                        ) : (
                            <motion.span
                                key="add"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex items-center gap-3"
                            >
                                <ShoppingCart className="w-6 h-6 transition-transform group-hover:-rotate-12" />
                                Adicionar ao Carrinho
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>

            {/* Badges/Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-sm text-mont-gray">
                    <div className="w-8 h-8 rounded-full bg-mont-surface flex items-center justify-center text-mont-gold">
                        🚚
                    </div>
                    <span>Entrega rápida em SP</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-mont-gray">
                    <div className="w-8 h-8 rounded-full bg-mont-surface flex items-center justify-center text-mont-gold">
                        🛡️
                    </div>
                    <span>Pagamento Seguro</span>
                </div>
            </div>
        </div>
    )
}
