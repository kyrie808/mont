'use client'

import React, { useContext, useLayoutEffect, useRef } from 'react'
import { HeroContext } from './ScrollWrapper'
import gsap from 'gsap'

export default function DiveOverlay() {
    const { timeline } = useContext(HeroContext)
    const containerRef = useRef<HTMLDivElement>(null)
    const bgFadeRef = useRef<HTMLDivElement>(null)
    const flashRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        if (!timeline || !bgFadeRef.current) return

        const ctx = gsap.context(() => {
            if (!flashRef.current || !bgFadeRef.current) return

            // Flash de portal — luz explode brevemente
            // Começa mais cedo (40) e atinge o pico em 44 (antes do fim total do dive)
            timeline.fromTo(flashRef.current,
                { opacity: 0 },
                { opacity: 1, duration: 4, ease: 'power2.in' },
                40 // Pico em 44
            )
            timeline.to(flashRef.current,
                { opacity: 0, duration: 8, ease: 'power1.out' },
                44 // Começa a sumir no pico
            )

            // Fix "Amadorismo": Garante que o fundo troque instantaneamente no pico do flash
            timeline.set(containerRef.current, {
                backgroundColor: '#FAF7F2'
            }, 44)

            // Glow do Portal (Substituindo o clippath duro por um gradiente suave)
            // Começa exatamente no pico do flash
            timeline.fromTo(bgFadeRef.current,
                {
                    scale: 0,
                    opacity: 0
                },
                {
                    scale: 1,
                    opacity: 1,
                    duration: 16,
                    ease: 'power2.out'
                },
                44
            )
        }, bgFadeRef)

        return () => ctx.revert()
    }, [timeline])

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 z-[15] pointer-events-none overflow-hidden"
        >
            {/* Flash Branco no topo */}
            <div
                ref={flashRef}
                className="absolute inset-0 z-[16] pointer-events-none"
                style={{ backgroundColor: '#FFFFFF', opacity: 0 }}
            />

            {/* Glow Creme Expansível (Substitui o div anterior) */}
            <div
                ref={bgFadeRef}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0"
                style={{
                    width: '300vmax', // Garante cobertura total em qualquer tela
                    height: '300vmax',
                    background: 'radial-gradient(circle, #FAF7F2 0%, #FAF7F2 40%, rgba(250, 247, 242, 0) 70%)',
                    borderRadius: '50%',
                    willChange: 'transform, opacity'
                }}
            />
        </div>
    )
}
