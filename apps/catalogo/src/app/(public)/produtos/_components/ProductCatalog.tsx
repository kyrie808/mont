'use client'

import { useState, useEffect, useRef } from 'react'
import { ProductCard } from '@/components/catalog'
import { scrollReveal } from '@/lib/gsap/animations'
import type { Product } from '@/types/product'

interface ProductCatalogProps {
    products: Product[]
}

type Category = 'todos' | 'congelado' | 'refrigerado' | 'combo'

export default function ProductCatalog({ products }: ProductCatalogProps) {
    const [selectedCategory, setSelectedCategory] = useState<Category>('todos')
    const gridRef = useRef<HTMLDivElement>(null)

    const filteredProducts = selectedCategory === 'todos'
        ? products
        : products.filter(p => p.category === selectedCategory)

    useEffect(() => {
        if (!gridRef.current) return

        const cards = Array.from(gridRef.current.querySelectorAll('.product-card')) as HTMLElement[]
        const ctx = scrollReveal(cards, { stagger: 0.1 })

        return () => ctx.revert()
    }, [filteredProducts])

    return (
        <div>
            {/* Filtros (Pills Scrolláveis) */}
            <section className="mb-8 md:mb-10">
                <div
                    className="flex flex-nowrap overflow-x-auto gap-2 px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory justify-start md:justify-center"
                >
                    <button
                        onClick={() => setSelectedCategory('todos')}
                        className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-colors duration-200 cursor-pointer snap-start ${selectedCategory === 'todos'
                            ? 'bg-mont-espresso text-mont-cream font-semibold border-none'
                            : 'bg-transparent border-[1.5px] border-mont-espresso/30 text-mont-espresso/60'
                            }`}
                    >
                        Todos
                    </button>

                    <button
                        onClick={() => setSelectedCategory('congelado')}
                        className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-colors duration-200 cursor-pointer snap-start ${selectedCategory === 'congelado'
                            ? 'bg-mont-espresso text-mont-cream font-semibold border-none'
                            : 'bg-transparent border-[1.5px] border-mont-espresso/30 text-mont-espresso/60'
                            }`}
                    >
                        ❄️ Congelados
                    </button>

                    <button
                        onClick={() => setSelectedCategory('refrigerado')}
                        className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-colors duration-200 cursor-pointer snap-start ${selectedCategory === 'refrigerado'
                            ? 'bg-mont-espresso text-mont-cream font-semibold border-none'
                            : 'bg-transparent border-[1.5px] border-mont-espresso/30 text-mont-espresso/60'
                            }`}
                    >
                        🧊 Resfriados
                    </button>

                    <button
                        onClick={() => setSelectedCategory('combo')}
                        className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-colors duration-200 cursor-pointer snap-start ${selectedCategory === 'combo'
                            ? 'bg-mont-espresso text-mont-cream font-semibold border-none'
                            : 'bg-transparent border-[1.5px] border-mont-espresso/30 text-mont-espresso/60'
                            }`}
                    >
                        📦 Combos
                    </button>
                </div>
            </section>

            {/* Grid de Produtos */}
            <div
                ref={gridRef}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
            >
                {filteredProducts.map((product, index) => (
                    <div key={product.id} className="product-card">
                        <ProductCard
                            id={product.id}
                            name={product.name}
                            slug={product.slug}
                            category={product.category}
                            subtitle={product.subtitle}
                            price_cents={product.price_cents}
                            anchor_price_cents={product.anchor_price_cents}
                            is_featured={product.is_featured}
                            image_url={product.primary_image_url || product.image_url}
                            index={index}
                        />
                    </div>
                ))}
            </div>

            {/* Estado vazio */}
            {filteredProducts.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-mont-gray text-lg">
                        Nenhum produto encontrado nesta categoria
                    </p>
                </div>
            )}
        </div>
    )
}
