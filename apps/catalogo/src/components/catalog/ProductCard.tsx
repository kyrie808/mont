'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@mont/shared'
import type { ProdutoCatalogo } from '@mont/shared'
import { productCardHover } from '@/lib/gsap/animations'
import { useCartStore } from '@/lib/cart/store'
import { Badge } from '@/components/ui'
import gsap from 'gsap'

interface ProductCardProps {
    id: string
    name: string
    slug: string
    category: 'congelado' | 'refrigerado' | 'combo'
    subtitle?: string | null
    price: number
    anchor_price?: number | null
    image_url?: string | null
    is_featured?: boolean
    index?: number
    className?: string
}

export function ProductCard({
    id,
    name,
    slug,
    category,
    subtitle,
    price,
    anchor_price,
    image_url,
    is_featured,
    index,
    className
}: ProductCardProps) {
    const cardRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const addItem = useCartStore((state) => state.addItem)

    useEffect(() => {
        if (cardRef.current) {
            productCardHover(cardRef.current)
        }
    }, [])

    const formattedPrice = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(price)

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (buttonRef.current) {
            gsap.fromTo(buttonRef.current,
                { scale: 0.8 },
                { scale: 1, duration: 0.2, ease: 'back.out(1.7)' }
            )
        }

        const produto: ProdutoCatalogo = {
            id,
            nome: name,
            slug,
            categoria: category,
            subtitulo: subtitle ?? null,
            preco: price,
            preco_ancoragem: anchor_price ?? null,
            url_imagem_principal: image_url ?? null,
            destaque: is_featured ?? false,
            descricao: null,
            codigo: null,
            estoque_atual: null,
            estoque_minimo: null,
            imagens: null,
            instrucoes_preparo: null,
            preco_formatado: null,
            status_estoque: null,
            visivel_catalogo: true,
        }
        addItem(produto, 1)
    }

    const Wrapper: React.ElementType = slug ? Link : 'div'
    const wrapperProps = slug ? { href: `/produtos/${slug}`, className: 'block' } : { className: 'block' }

    return (
        <Wrapper {...wrapperProps}>
            <div
                ref={cardRef}
                className={cn(
                    'group relative bg-mont-cream rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-all duration-300',
                    className
                )}
            >
                {/* Image Block */}
                <div className="relative aspect-[3/4] w-full overflow-hidden">
                    {image_url ? (
                        <>
                            {(() => {
                                const imageSizes = is_featured
                                    ? "(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 50vw"
                                    : "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw";

                                return (
                                    <Image
                                        src={image_url}
                                        alt={name}
                                        fill
                                        className="object-cover"
                                        quality={is_featured ? 92 : 88}
                                        priority={typeof index !== 'undefined' && index < 4}
                                        sizes={imageSizes}
                                    />
                                );
                            })()}
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-mont-surface text-mont-warm-gray">
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
                        <Badge variant={category} className="text-[10px]" />
                    </div>

                    {/* Featured Badge */}
                    {is_featured && (
                        <div className="absolute top-2 right-2 bg-mont-gold text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Mais Vendido
                        </div>
                    )}
                </div>

                {/* Info Block */}
                <div className="p-3 bg-mont-cream min-h-[88px]">
                    <h3 className="font-display text-sm text-mont-espresso line-clamp-2 leading-snug">
                        {name}
                    </h3>
                    {subtitle && (
                        <p className="text-[10px] text-mont-espresso/50 mt-0.5">
                            {subtitle}
                        </p>
                    )}
                    {anchor_price && (
                        <span className="text-sm text-gray-400 line-through">
                            R$ {anchor_price.toFixed(2).replace('.', ',')}
                        </span>
                    )}
                    <p className="font-bold text-base text-mont-gold mt-1">
                        {formattedPrice}
                    </p>
                </div>

                {/* Add to Cart Button */}
                <button
                    ref={buttonRef}
                    onClick={handleAddToCart}
                    className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-mont-espresso text-mont-cream flex items-center justify-center text-lg font-bold transition-transform hover:scale-110 active:scale-95 z-10"
                    aria-label="Adicionar ao carrinho"
                >
                    +
                </button>
            </div>
        </Wrapper>
    )
}
