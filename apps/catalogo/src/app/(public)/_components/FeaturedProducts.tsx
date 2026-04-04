'use client'

import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useCartStore } from '@/lib/cart/store'
import { ProductCard } from '@/components/catalog'
import type { ProdutoCatalogo } from '@mont/shared'

interface FeaturedProductsProps {
    products: ProdutoCatalogo[]
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const isInView = useInView(containerRef, { once: true, amount: 0.1 })

    // Filter only featured products if possible, or just take first 4
    const featuredItems = products.filter(p => p.destaque).slice(0, 4)
    const displayProducts = featuredItems.length > 0 ? featuredItems : products.slice(0, 4)

    return (
        <section ref={containerRef} className="py-24 bg-mont-white overflow-hidden">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div className="max-w-2xl">
                        <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            className="text-mont-gold font-bold uppercase tracking-widest text-sm block mb-3"
                        >
                            Nossos Favoritos
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ delay: 0.1 }}
                            className="font-display text-4xl md:text-5xl text-mont-espresso leading-tight"
                        >
                            Assinaturas da <span className="italic">Casa</span>
                        </motion.h2>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.2 }}
                    >
                        <Link
                            href="/produtos"
                            className="group flex items-center gap-3 text-mont-espresso font-bold hover:text-mont-gold transition-colors text-lg"
                        >
                            Ver Cardápio Completo
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
                        </Link>
                    </motion.div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {displayProducts.map((product, index) => (
                        <ProductCard
                            key={product.id}
                            produto={product}
                            index={index}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}

// Add default export to avoid build errors
export default FeaturedProducts
