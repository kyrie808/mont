'use client'

import React, { useContext, useLayoutEffect, useRef } from 'react'
import { HeroContext } from './ScrollWrapper'
import { ArrowDown } from 'lucide-react'
import gsap from 'gsap'

import Link from 'next/link'

export default function HeroCopy() {
    const { timeline } = useContext(HeroContext)
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollHintRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        if (!timeline || !containerRef.current || !scrollHintRef.current) return

        // Fade Out Sequence
        // Scroll 8% -> 12%: Scroll Hint fade out
        timeline.to(scrollHintRef.current, {
            opacity: 0,
            y: -20,
            duration: 4, // 4% do scroll duration (assuming 100 total)
            ease: 'power2.in'
        }, 8) // Start at 8

        // Scroll 10% -> 16%: Container fade out
        timeline.to(containerRef.current, {
            opacity: 0,
            y: -50,
            duration: 6,
            ease: 'power2.in'
        }, 10)

    }, [timeline])

    return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none">
            <div ref={containerRef} className="text-center px-4 max-w-4xl mt-[-5vh]">
                {/* NÍVEL 1 — Eyebrow */}
                <span
                    className="block text-xs uppercase tracking-[0.25em] text-[#E8601C] font-bold mb-4"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                >
                    100% Queijo Canastra legítimo
                </span>

                {/* NÍVEL 2 — Headline H1 */}
                <h1
                    className="text-white font-bold leading-[1.1] mb-8 tracking-tight hero-title"
                >
                    <span style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.8)' }}>
                        Pão de queijo
                    </span>
                    <br />
                    <span style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.8)' }}>
                        de
                    </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#E8601C] to-[#C43E1A]">
                        verdade.
                    </span>
                </h1>

                {/* NÍVEL 3 — Subtítulo rítmico */}
                <div
                    className="text-white text-base md:text-lg max-w-2xl mx-auto mb-12 font-sans space-y-1 font-medium"
                    style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)' }}
                >
                    <p className="m-0">Não é oco. Não murcha.</p>
                    <p className="m-0">O cheiro já avisa que é diferente.</p>
                </div>

                {/* NÍVEL 4 — CTA */}
                <Link
                    href="/produtos"
                    className="bg-[#E8601C] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#D45010] transition-all shadow-lg hover:shadow-xl pointer-events-auto transform hover:scale-105 duration-300 no-underline inline-block"
                >
                    Descobrir os produtos
                </Link>
            </div>

            <div
                ref={scrollHintRef}
                className="absolute bottom-12 left-0 right-0 flex justify-center animate-bounce"
            >
                <div className="flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-full backdrop-blur-md bg-black/30 border border-white/10">
                    <span className="text-[#FAF7F2]/80 text-xs uppercase tracking-[0.2em] font-light">
                        Role para descobrir
                    </span>
                    <ArrowDown size={16} className="text-[#FAF7F2]/60" />
                </div>
            </div>

            <style jsx global>{`
                .hero-title {
                    font-size: clamp(3rem, 10vw, 6rem);
                }
            `}</style>
        </div>
    )
}
