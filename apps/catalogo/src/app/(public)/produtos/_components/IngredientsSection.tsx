'use client'

import { useRef, useEffect } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function IngredientsSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const footerRef = useRef<HTMLDivElement>(null)
    const cardsRef = useRef<HTMLDivElement[]>([])

    // Unicode Strings
    const headline = "5 ingredientes. Zero atalhos."
    const subtitle = "\u00C9 por isso que n\u00E3o murcha, n\u00E3o \u00E9 oco e o sabor n\u00E3o some no forno."

    const ingredients = [
        {
            id: 1,
            imagePath: '/images/ingredients/queijo-canastra.png',
            title: 'Queijo Canastra',
            description: 'Autêntico queijo da Serra da Canastra, garantindo o sabor tradicional e cura perfeita.'
        },
        {
            id: 2,
            imagePath: '/images/ingredients/fecula-mandioca.png',
            title: 'Fécula de mandioca',
            description: 'Selecionada para garantir a elasticidade e leveza ideais da nossa massa artesanal.'
        },
        {
            id: 3,
            imagePath: '/images/ingredients/ovos.png',
            title: 'Ovos',
            description: 'Ovos frescos de produtores locais, conferindo cor e nutrição natural aos produtos.'
        },
        {
            id: 4,
            imagePath: '/images/ingredients/oleo-soja.png',
            title: 'Óleo de soja',
            description: 'Óleo vegetal purificado para uma textura macia e cozimento uniforme.'
        },
        {
            id: 5,
            imagePath: '/images/ingredients/sal.png',
            title: 'Sal',
            description: 'Na medida exata para realçar todos os sabores sem sobrepor o paladar do queijo.'
        }
    ]

    const footerText = "Ingrediente certo, resultado certo."

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Header animation
            gsap.from(headerRef.current?.children || [], {
                y: 20,
                opacity: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: headerRef.current,
                    start: 'top 85%',
                }
            })

            // Grid items animation
            gsap.from(cardsRef.current, {
                y: 20,
                opacity: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: gridRef.current,
                    start: 'top 85%',
                }
            })

            // Footer phrase animation
            gsap.from(footerRef.current, {
                y: 20,
                opacity: 0,
                duration: 0.8,
                delay: 0.4,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: footerRef.current,
                    start: 'top 90%',
                }
            })
        }, containerRef)

        return () => ctx.revert()
    }, [])

    return (
        <section
            ref={containerRef}
            className="w-full bg-[#1C1008] py-14 px-6 md:py-16 md:px-10 relative overflow-hidden"
        >
            {/* Header Content */}
            <div ref={headerRef} className="flex flex-col items-center mb-10">
                <h2 className="font-display text-2xl md:text-3xl text-mont-cream text-center mb-2">
                    {headline}
                </h2>

                {/* Gold Separator */}
                <div className="w-12 h-px bg-mont-gold mb-10" />

                <p className="text-sm md:text-base text-mont-cream/60 text-center max-w-sm mx-auto leading-relaxed">
                    {subtitle}
                </p>
            </div>

            {/* Ingredients Grid */}
            <div
                ref={gridRef}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto pl-14 pr-4 md:px-12"
            >
                {ingredients.map((ingredient, index) => {
                    // Custom offset for narrower images (Queijo/Ovos) to tighten the gap to text
                    const isNarrow = ingredient.id === 1 || ingredient.id === 3
                    const imageOffset = isNarrow ? '-left-6' : '-left-12'

                    return (
                        <div
                            key={ingredient.id}
                            ref={el => { cardsRef.current[index] = el as HTMLDivElement }}
                            className="relative overflow-visible border border-white/10 rounded-2xl bg-white/5 flex items-center min-h-[110px] pl-32 pr-5 py-5"
                        >
                            {/* Image positioned absolute escaping the card */}
                            <div className={`absolute ${imageOffset} top-1/2 -translate-y-1/2 drop-shadow-2xl`}>
                                <Image
                                    src={ingredient.imagePath}
                                    width={160}
                                    height={160}
                                    alt={ingredient.title}
                                    className="object-contain"
                                    style={{ height: 'auto' }}
                                />
                            </div>

                            <div className="flex flex-col">
                                <h3 className="font-display text-base text-mont-cream">
                                    {ingredient.title}
                                </h3>
                                <p className="text-xs text-mont-cream/60 mt-1 leading-relaxed">
                                    {ingredient.description}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Footer Phrase */}
            <div
                ref={footerRef}
                className="max-w-md mx-auto mt-10"
            >
                <div className="border-t border-mont-cream/10 mb-8" />
                <p className="font-display text-base md:text-lg text-mont-cream/80 text-center leading-relaxed">
                    {footerText}
                </p>
            </div>
        </section>
    )
}
