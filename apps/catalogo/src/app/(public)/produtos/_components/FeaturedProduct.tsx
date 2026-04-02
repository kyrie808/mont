'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Product } from '@/types/product';
import { useCartStore } from '@/lib/cart/store';

gsap.registerPlugin(ScrollTrigger);

interface FeaturedProductProps {
    product: Product;
}

export default function FeaturedProduct({ product }: FeaturedProductProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const addItem = useCartStore((state) => state.addItem);

    // Formatações
    const priceFormatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(product.price_cents / 100);

    const weightFormatted = product.subtitle || '';

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo(
                containerRef.current,
                { x: -30, opacity: 0 },
                {
                    x: 0,
                    opacity: 1,
                    duration: 0.8,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top 85%',
                        toggleActions: 'play none none none',
                    },
                }
            );
        }, containerRef);

        return () => ctx.revert();
    }, []);

    const badgeText = '\u2B50 Mais Vendido';
    const infoBlockLabel = 'BLOCO DE INFORMA\u00C7\u00D5ES';

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // GSAP Feedback
        gsap.to(buttonRef.current, {
            scale: 0.8,
            duration: 0.1,
            yoyo: true,
            repeat: 1,
            ease: 'back.out(1.7)',
            onComplete: () => {
                addItem({ ...product }, 1);
            },
        });
    };

    return (
        <Link href={`/produtos/${product.slug}`} className="block">
            <div
                ref={containerRef}
                className="w-full bg-mont-cream rounded-2xl overflow-hidden shadow-sm mb-8 relative cursor-pointer group"
            >
                <div className="flex flex-col md:flex-row">
                    {/* BLOCO DA IMAGEM */}
                    <div className="relative w-full md:w-1/2 aspect-[4/3] md:aspect-video overflow-hidden">
                        <Image
                            src={product.primary_image_url || product.image_url || '/placeholder-product.jpg'}
                            alt={product.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            quality={92}
                            priority
                        />

                        {/* BADGE */}
                        <div className="absolute top-3 left-3 bg-mont-gold text-white text-xs px-3 py-1 rounded-full font-semibold shadow-sm">
                            {badgeText}
                        </div>
                    </div>

                    {/* BLOCO DE INFORMACOES */}
                    <div className="p-6 md:p-8 flex flex-col justify-center flex-1">
                        <h2 className="font-display text-2xl md:text-3xl text-mont-espresso mb-1">
                            {product.name}
                        </h2>
                        <p className="text-sm text-mont-espresso/50 mb-6">
                            {weightFormatted}
                        </p>

                        <div className="flex justify-between items-center mt-auto">
                            <span className="font-bold text-2xl md:text-3xl text-mont-gold">
                                {priceFormatted}
                            </span>

                            <button
                                ref={buttonRef}
                                onClick={handleAddToCart}
                                className="bg-mont-espresso text-mont-cream px-6 py-3 rounded-full text-sm md:text-base font-semibold transition-colors hover:bg-mont-espresso/90 active:scale-95"
                            >
                                Adicionar ao carrinho
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
