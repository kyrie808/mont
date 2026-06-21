'use client'

import { useEffect, useRef } from 'react'
import { ProdutoCard } from '../produtos/_components/ProdutoCard'
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
            className="pt-8 pb-20 md:pt-12 md:pb-32 bg-background relative z-10"
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
                        <h2 className="font-display font-extrabold text-4xl md:text-5xl text-foreground mb-4">
                            {SECTION_TITLE}
                        </h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                            {SECTION_SUBTITLE}
                        </p>
                    </div>

                    <div className="max-w-[1400px] mx-auto">
                        <div
                            ref={gridRef}
                            /* Grade uniforme — mesma da /produtos (VitrineTabs) */
                            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
                        >
                            {products.map((product) => (
                                <div key={product.id} className="product-card">
                                    <ProdutoCard product={product} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

