'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function StoreBanner() {
    const containerRef = useRef<HTMLDivElement>(null)
    const headlineRef = useRef<HTMLHeadingElement>(null)
    const separatorRef = useRef<HTMLDivElement>(null)
    const subtitleRef = useRef<HTMLParagraphElement>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return

        // Register ScrollTrigger if not already registered (usually handled in lib/gsap/animations.ts)
        gsap.registerPlugin(ScrollTrigger)

        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                }
            })

            tl.fromTo(headlineRef.current,
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
            )
                .fromTo(separatorRef.current,
                    { opacity: 0 },
                    { opacity: 1, duration: 0.6, ease: 'power2.out' },
                    '-=0.4'
                )
                .fromTo(subtitleRef.current,
                    { y: 20, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
                    '-=0.4'
                )
        }, containerRef)

        return () => ctx.revert()
    }, [])

    return (
        <section
            ref={containerRef}
            className="w-auto -mx-4 sm:-mx-6 lg:-mx-8 bg-mont-espresso py-14 px-6 md:py-16 md:px-8 flex flex-col items-center text-center overflow-hidden relative"
        >
            <h2
                ref={headlineRef}
                className="font-display text-2xl md:text-3xl text-mont-cream font-normal mb-3"
            >
                Feito com Queijo Canastra de verdade.
            </h2>

            {/* Separador Decorativo */}
            <div
                ref={separatorRef}
                className="w-12 h-px bg-mont-gold mx-auto mb-3"
            />

            <p
                ref={subtitleRef}
                className="text-sm md:text-base text-mont-cream/70 max-w-xs md:max-w-sm leading-relaxed"
            >
                Não é sabor. Não é pigmento. É queijo — e você sente a diferença.
            </p>
        </section>
    )
}
