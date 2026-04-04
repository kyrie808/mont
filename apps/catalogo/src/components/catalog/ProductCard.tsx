'use client'

import React, { useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@mont/shared'
import type { ProdutoCatalogo } from '@mont/shared'
import { productCardHover } from '@/lib/gsap/animations'
import { useCartStore } from '@/lib/cart/store'
import { Badge } from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import gsap from 'gsap'

interface ProductCardProps {
    produto: ProdutoCatalogo
    index?: number
    className?: string
}

export function ProductCard({
    produto,
    index,
    className
}: ProductCardProps) {
    const cardRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const { addItem } = useCartStore()

    const {
        nome,
        slug,
        categoria,
        subtitulo,
        preco,
        preco_ancoragem,
        url_imagem_principal,
        destaque
    } = produto

    useEffect(() => {
        if (cardRef.current) {
            productCardHover(cardRef.current)
        }
    }, [])

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (buttonRef.current) {
            gsap.fromTo(buttonRef.current,
                { scale: 0.8 },
                { scale: 1, duration: 0.2, ease: 'back.out(1.7)' }
            )
        }

        addItem(produto)
    }

    return (
        <Link href={`/produtos/${slug}`} className="block">
            <div
                ref={cardRef}
                className={cn(
                    'group relative bg-mont-cream rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-all duration-300 border border-mont-surface flex flex-col h-full',
                    className
                )}
            >
                {/* Image Block */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-mont-surface">
                    {url_imagem_principal ? (
                        <Image
                            src={url_imagem_principal}
                            alt={nome || ''}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                            priority={typeof index !== 'undefined' && index < 4}
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-mont-warm-gray">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                    )}

                    {/* Category Badge */}
                    <div className="absolute top-2 left-2 z-10">
                        {categoria && <Badge variant={categoria as any} className="text-[10px]" />}
                    </div>

                    {/* Featured Badge */}
                    {destaque && (
                        <div className="absolute top-2 right-2 bg-mont-gold text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
                            Mais Vendido
                        </div>
                    )}
                </div>

                {/* Info Block */}
                <div className="p-4 bg-mont-white flex-grow flex flex-col">
                    <h3 className="font-display text-base text-mont-espresso group-hover:text-mont-gold transition-colors line-clamp-2 leading-snug mb-1">
                        {nome}
                    </h3>
                    {subtitulo && (
                        <p className="text-xs text-mont-gray line-clamp-2 mb-3">
                            {subtitulo}
                        </p>
                    )}
                    
                    <div className="mt-auto pt-2 border-t border-mont-surface flex items-center justify-between">
                        <div className="flex flex-col">
                            {preco_ancoragem && (
                                <span className="text-xs text-gray-400 line-through">
                                    {formatCurrency(preco_ancoragem)}
                                </span>
                            )}
                            <p className="font-bold text-lg text-mont-espresso">
                                {formatCurrency(preco || 0)}
                            </p>
                        </div>

                        {/* Add to Cart Button */}
                        <button
                            ref={buttonRef}
                            onClick={handleAddToCart}
                            className="w-10 h-10 rounded-full bg-mont-gold text-white flex items-center justify-center shadow-md transform transition-all hover:scale-110 active:scale-95 group-hover:bg-mont-espresso"
                            aria-label="Adicionar ao carrinho"
                        >
                            <span className="text-2xl font-light leading-none">+</span>
                        </button>
                    </div>
                </div>
            </div>
        </Link>
    )
}
