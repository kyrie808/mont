'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils/format'
import { Badge } from '@/components/ui'
import type { Product } from '@/types/product'

interface RelatedProductsProps {
    products: Product[]
}

export default function RelatedProducts({ products }: RelatedProductsProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    if (products.length === 0) return null

    return (
        <section className="mt-16 mb-8 overflow-hidden">
            <h2 className="font-display text-2xl text-mont-espresso mb-6">
                Você também pode gostar
            </h2>

            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory touch-pan-x"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {products.map(product => (
                    <Link
                        key={product.id}
                        href={`/produtos/${product.slug}`}
                        className="flex-none w-48 snap-start bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="aspect-square bg-mont-surface overflow-hidden">
                            {product.primary_image_url ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={product.primary_image_url}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 50vw, 192px"
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-mont-gray/30">
                                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="p-3">
                            <Badge variant={product.category} />
                            <p className="text-sm font-medium text-mont-espresso mt-2 leading-tight line-clamp-2">
                                {product.name}
                            </p>
                            {product.anchor_price_cents && (
                                <p className="text-xs text-mont-gray line-through mt-1">
                                    {formatCurrency(product.anchor_price_cents)}
                                </p>
                            )}
                            <p className="text-mont-gold font-bold mt-1">
                                {formatCurrency(product.price_cents)}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
