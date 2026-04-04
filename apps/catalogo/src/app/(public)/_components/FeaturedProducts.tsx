'use client'

import { useEffect, useRef } from 'react'
import { ProductCard } from '@/components/catalog'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { ProdutoCatalogo } from '@mont/shared'

interface FeaturedProductsProps {
    products: ProdutoCatalogo[]
}

const SECTION_TITLE = "Os favoritos da casa"
const SECTION_SUBTITLE = "Quem abre o forno e v\u00EA que n\u00E3o murchou, entende por qu\u00EA."

export default function FeaturedProducts({ products }: FeaturedProductsProps) {
    const sectionRef = useRef<HTMLElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!sectionRef.current || !contentRef.current) return
        gsap.registerPlugin(ScrollTrigger)

        const ctx = gsap.context(() => {
            // --- EFEITO 3D: Arco de trás pra frente ---
            // PRESERVADO: Toda a lógica de animação abaixo
            gsap.fromTo(contentRef.current,
                {
                    rotateX: -65,
                    y: 350,
                    scale: 0.45,
                    opacity: 0,
                    z: -200,
                },
                {
                    rotateX: 0,
                    y: 0,
                    scale: 1,
                    opacity: 1,
                    z: 0,
                    ease: 'power4.out',
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        start: 'top 100%',
                        end: 'top 30%',
                        scrub: 1.2,
                    }
                }
            )
        }, sectionRef)

        return () => ctx.revert()
    }, [products])

    if (products.length === 0) return null

    return (
        <section
            ref={sectionRef}
            className="pt-8 pb-20 md:pt-12 md:pb-32 bg-mont-cream relative z-10"
            id="destaques"
            style={{
                // PRESERVADO: Posicionamento e perspectiva
                marginTop: '-80vh',
                perspective: '600px',
                perspectiveOrigin: '50% 10%',
            }}
        >
            <div
                ref={contentRef}
                style={{
                    transformOrigin: 'center bottom',
                    willChange: 'transform, opacity',
                    transformStyle: 'preserve-3d',
                }}
            >
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        {/* ALTERAÇÃO: Novos textos com Unicode encoding */}
                        <h2 className="font-display text-4xl md:text-5xl text-mont-espresso mb-4">
                            {SECTION_TITLE}
                        </h2>
                        <p className="text-mont-gray text-lg max-w-2xl mx-auto">
                            {SECTION_SUBTITLE}
                        </p>
                    </div>

                    <div className="max-w-[1400px] mx-auto">
                        <div
                            ref={gridRef}
                            /* ALTERAÇÃO: grid-cols-2 no mobile, 4 colunas em lg+ para bento grid 50/50 */
                            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
                        >
                            {products.map((product, index) => (
                                <div
                                    key={product.id}
                                    /* PRESERVADO: Lógica de destaque do primeiro card (md:col-span-2) */
                                    className={`product-card ${index === 0 ? 'md:col-span-2 md:row-span-2' : ''
                                        }`}
                                >
                                    <ProductCard
                                        id={product.id!}
                                        name={product.nome!}
                                        slug={product.slug!}
                                        category={product.categoria as 'congelado' | 'refrigerado' | 'combo'}
                                        subtitle={product.subtitulo}
                                        price={product.preco ?? 0}
                                        anchor_price={product.preco_ancoragem}
                                        image_url={product.url_imagem_principal}
                                        is_featured={index === 0}
                                        index={index}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

