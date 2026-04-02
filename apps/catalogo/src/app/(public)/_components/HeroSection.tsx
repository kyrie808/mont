'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Button } from '@/components/ui'
import Link from 'next/link'
import { FloatingCheeseBread } from '@/components/visual/FloatingCheeseBread'
import { MountainSilhouette } from '@/components/visual/MountainSilhouette'
import { GrainTexture } from '@/components/visual/GrainTexture'
import { ParticleField } from '@/components/visual/ParticleField'
import { heroTextReveal } from '@/lib/gsap/animations'

export default function HeroSection() {
    const containerRef = useRef<HTMLElement>(null)
    const titleRef = useRef<HTMLHeadingElement>(null)
    const breadRefs = useRef<(HTMLDivElement | null)[]>([])

    // Function to add refs to array
    const addToRefs = (el: HTMLDivElement | null) => {
        if (el && !breadRefs.current.includes(el)) {
            breadRefs.current.push(el)
        }
    }

    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger)

        const ctx = gsap.context(() => {
            // Text Reveal
            if (titleRef.current) {
                // Use the existing helper or custom logic if needed
                heroTextReveal(titleRef.current)
            }

            // Store float animations for cleanup
            const floatAnimations: gsap.core.Tween[] = []

            // Parallax + Idle for Breads
            breadRefs.current.forEach((bread, index) => {
                if (!bread) return

                // 1. Idle Floating Animation (Randomized)
                // Coexist with scroll parallax (GSAP composition)
                const floatTween = gsap.to(bread, {
                    y: `random(-12, 12)`,
                    x: `random(-4, 4)`,
                    rotation: `random(-3, 3)`,
                    duration: 3 + (index * 0.7),
                    ease: 'sine.inOut',
                    repeat: -1,
                    yoyo: true,
                    delay: index * 0.3
                })
                floatAnimations.push(floatTween)

                // 2. Scroll Parallax (Intensity adjustment)
                // Indexes: 0=XL, 1=SM, 2=LG, 3=LG, 4=XL, 5=SM
                // Large/Close (XL/LG) -> Slower (-30% to -50%)
                // Small/Far (SM) -> Faster (-100% to -120%)

                const isSmall = index === 1 || index === 5

                // Base movement
                const movement = isSmall
                    ? -100 - (index * 5)  // -100 to -125
                    : -30 - (index * 5)   // -30 to -50 approx

                gsap.to(bread, {
                    yPercent: movement,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top top',
                        end: 'bottom top',
                        scrub: true
                    }
                })
            })

            // Cleanup function will handle floatAnimations kill via context revert, 
            // but we can explicitly track if needed. GSAP context handles it mostly.
            // But user asked to kill explicitly in cleanup.
            // Actually ctx.revert() kills all tweens created in context.
            // But to follow instructions strictly, we can return a cleanup function to the useEffect.
            // However, ctx.revert() IS the cleanup.
            // I will leverage ctx for cleanup as it's the robust way.


            // Content fade in (after text reveal)
            gsap.fromTo('.hero-content-fade',
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 1, delay: 0.8, stagger: 0.2, ease: 'power2.out' }
            )

        }, containerRef)

        return () => {
            ctx.revert()
        }
    }, [])

    return (
        <section
            ref={containerRef}
            className="relative min-h-[100dvh] flex items-center justify-center bg-[#3D2B22] overflow-x-hidden isolate"
        >
            {/* Layer 1: Background + Grain */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-b from-[#3D2B22] to-[#2C1810]"></div>
                <GrainTexture><div className="w-full h-full" /></GrainTexture>
            </div>

            {/* Layer 2: Mountains */}
            <div className="absolute bottom-0 left-0 right-0 z-10 w-full opacity-30 select-none pointer-events-none">
                <MountainSilhouette />
            </div>

            {/* Layer 3: Particles */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <ParticleField />
            </div>

            {/* Layer 4: Floating Cheese Breads */}
            <div className="absolute inset-0 z-30 pointer-events-none">
                {/* Top Left - Large */}
                <FloatingCheeseBread
                    size="xl"
                    className="absolute top-[10%] -left-[10%] md:left-[5%] opacity-90 shadow-2xl"
                    ref={addToRefs}
                />
                {/* Mid Left - Small/Far */}
                <FloatingCheeseBread
                    size="sm"
                    className="absolute top-[40%] left-[5%] md:left-[15%] opacity-50 blur-[1px]"
                    ref={addToRefs}
                />
                {/* Bottom Left - Mid (Leak candidate) */}
                <FloatingCheeseBread
                    size="lg"
                    className="absolute top-[75%] -left-[5%] md:left-[10%] opacity-80 z-40"
                    ref={addToRefs}
                />

                {/* Top Right - Mid */}
                <FloatingCheeseBread
                    size="lg"
                    className="absolute top-[15%] -right-[5%] md:right-[5%] opacity-90 shadow-xl"
                    ref={addToRefs}
                />
                {/* Mid Right - Large */}
                <FloatingCheeseBread
                    size="xl"
                    className="absolute top-[55%] right-[2%] md:right-[15%] opacity-100 z-10"
                    ref={addToRefs}
                />
                {/* Bottom Right - Small (Leak candidate) */}
                <FloatingCheeseBread
                    size="sm"
                    className="absolute top-[85%] right-[20%] opacity-60 blur-[1px] z-40"
                    ref={addToRefs}
                />
            </div>

            {/* Layer 5: Content */}
            <div className="relative z-40 container mx-auto px-4 text-center">
                <h1
                    ref={titleRef}
                    className="font-display text-5xl md:text-7xl lg:text-8xl text-mont-cream mb-6 leading-tight drop-shadow-lg"
                >
                    <span className="block overflow-hidden"><span className="word inline-block">Massa</span> <span className="word inline-block">artesanal</span></span>
                    <span className="block overflow-hidden"><span className="word inline-block">de</span> <span className="word inline-block">pão</span> <span className="word inline-block">de</span> <span className="word inline-block">queijo</span></span>
                </h1>

                <p className="hero-content-fade text-mont-cream/90 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-body opacity-0">
                    Do forno da Mont para a sua mesa. Tradição e sabor incomparável.
                </p>

                <div className="hero-content-fade flex flex-col sm:flex-row gap-4 justify-center opacity-0">
                    <Link href="/produtos">
                        <Button
                            variant="primary"
                            size="lg"
                            className="bg-mont-orange hover:bg-mont-orange-dark text-white border-none shadow-lg shadow-mont-orange/20 transition-transform hover:-translate-y-1"
                        >
                            Ver Produtos
                        </Button>
                    </Link>

                    <Link href="#como-funciona">
                        <Button
                            variant="secondary"
                            size="lg"
                            className="bg-transparent border-2 border-mont-cream text-mont-cream hover:bg-mont-cream hover:text-mont-brown-deep transition-all"
                        >
                            Como Funciona
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50">
                <div className="w-6 h-10 border-2 border-mont-cream/30 rounded-full flex items-start justify-center p-2 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="w-1 h-3 bg-mont-cream rounded-full animate-bounce" />
                </div>
            </div>
        </section>
    )
}
