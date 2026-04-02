'use client'

import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { FloatingCheeseBread } from '@/components/visual/FloatingCheeseBread'
import { MountainSilhouette } from '@/components/visual/MountainSilhouette'
import { GrainTexture } from '@/components/visual/GrainTexture'
import { heroTextReveal } from '@/lib/gsap/animations'

export default function FinalCTA() {
    const containerRef = useRef<HTMLElement>(null)
    const titleRef = useRef<HTMLHeadingElement>(null)
    const breadRefs = useRef<(HTMLDivElement | null)[]>([])

    const TITLE = "Seu forno est\u00E1 esperando."
    const SUBTITLE = "Pe\u00E7a agora e em breve sua casa vai cheirar muito bem."
    const CTA_PRIMARY = "Pedir pelo WhatsApp"
    const CTA_SECONDARY = "Ver todos os produtos"

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
                heroTextReveal(titleRef.current)
            }

            // Store float animations
            const floatAnimations: gsap.core.Tween[] = []

            // Parallax + Idle for Breads
            breadRefs.current.forEach((bread, index) => {
                if (!bread) return

                // 1. Idle Floating Animation (Randomized)
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

                // 2. Scroll Parallax
                // Index 0 (LG), 1 (XL) -> Close -> Slower
                // Index 2 (SM) -> Far -> Faster

                const isSmall = index === 2

                const movement = isSmall
                    ? -120 // Far/Small
                    : -40 - (index * 10) // Close/Large (-40, -50)

                gsap.to(bread, {
                    yPercent: movement,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top bottom',
                        end: 'bottom bottom',
                        scrub: 0.8
                    }
                })
            })

        }, containerRef)

        return () => ctx.revert()
    }, [])

    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5511934417085'
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Ol\u00E1! Gostaria de saber mais sobre os produtos da Mont Distribuidora.`

    return (
        <section
            id="final-cta"
            ref={containerRef}
            className="relative py-32 bg-[#3D2B22]"
            style={{ overflowX: 'clip', overflowY: 'visible' }}
        >
            {/* Background + Grain */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810] to-[#3D2B22]"></div>
                <GrainTexture><div className="w-full h-full" /></GrainTexture>
            </div>

            {/* Inverted Mountain at Top */}
            <div className="absolute top-0 left-0 right-0 z-10 w-full opacity-20 pointer-events-none">
                <MountainSilhouette inverted />
            </div>

            {/* Floating Cheese Breads */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <FloatingCheeseBread
                    size="lg"
                    className="absolute top-[20%] -left-[5%] md:left-[10%] opacity-80"
                    ref={addToRefs}
                />
                <FloatingCheeseBread
                    size="xl"
                    className="absolute bottom-[10%] -right-[5%] md:right-[10%] opacity-90 shadow-2xl"
                    ref={addToRefs}
                />
                <FloatingCheeseBread
                    size="sm"
                    className="absolute top-[50%] right-[15%] opacity-50 blur-[1px]"
                    ref={addToRefs}
                />
            </div>

            {/* Content */}
            <div className="relative z-30 container mx-auto px-4 text-center">
                <h2
                    ref={titleRef}
                    className="font-display text-4xl md:text-6xl text-mont-cream mb-6 leading-tight"
                >
                    <span className="block overflow-hidden">
                        <span className="word inline-block">Seu</span>{' '}
                        <span className="word inline-block">forno</span>{' '}
                        <span className="word inline-block">está</span>{' '}
                        <span className="word inline-block">esperando.</span>
                    </span>
                </h2>

                <p className="text-mont-cream/90 text-lg md:text-xl max-w-2xl mx-auto mb-10 hero-content-fade">
                    {SUBTITLE}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-40">
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block' }}
                    >
                        <Button
                            variant="primary"
                            size="lg"
                            className="w-full bg-[#E8631A] hover:bg-[#C9551A] text-white border-none shadow-lg"
                        >
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            {CTA_PRIMARY}
                        </Button>
                    </a>

                    <Link href="/produtos">
                        <Button variant="secondary" size="lg" className="bg-transparent border-2 border-mont-cream text-mont-cream hover:bg-mont-cream hover:text-mont-brown-deep">
                            {CTA_SECONDARY}
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    )
}
