'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ProductCard } from '@/components/catalog'
import type { ProdutoCatalogo } from '@mont/shared'

interface RelatedProductsProps {
    products: ProdutoCatalogo[]
}

export default function RelatedProducts({ products }: RelatedProductsProps) {
    if (products.length === 0) return null

    return (
        <section className="mt-24 pt-16 border-t border-mont-surface">
            <div className="flex items-center justify-between mb-8">
                <h2 className="font-display text-3xl text-mont-espresso">
                    Você também pode <span className="italic">gostar</span>
                </h2>
                <div className="hidden md:flex gap-2">
                    {/* Navigation buttons could go here if slider */}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {products.map((product, index) => (
                    <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <ProductCard produto={product} />
                    </motion.div>
                ))}
            </div>
        </section>
    )
}
