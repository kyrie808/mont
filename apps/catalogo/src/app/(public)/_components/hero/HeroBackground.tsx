'use client'

import React, { useContext, useLayoutEffect, useRef } from 'react'
import { HeroContext } from './ScrollWrapper'
import gsap from 'gsap'

export default function HeroBackground() {
    const { timeline } = useContext(HeroContext)
    const bgRef = useRef<HTMLImageElement>(null)

    useLayoutEffect(() => {
        if (!timeline || !bgRef.current) return

        const ctx = gsap.context(() => {
            // 1. Zoom Paralaxe: O fundo cresce levemente durante todo o dive
            timeline.fromTo(bgRef.current,
                { scale: 1 },
                {
                    scale: 1.2, // Equilíbrio entre sutil e visível
                    duration: 44,
                    ease: 'none',
                    force3D: true
                },
                0
            )

            // 2. Depth of Field + Darkening: O fundo desfoca e escurece na saída
            timeline.fromTo(bgRef.current,
                { filter: 'blur(0px) brightness(1)' },
                {
                    filter: 'blur(20px) brightness(0.5)',
                    duration: 16,
                    ease: 'power1.inOut'
                },
                28 // Começa a transição de foco antes do pão abrir totalmente
            )
        }, bgRef)

        return () => ctx.revert()
    }, [timeline])

    return (
        <div className="absolute inset-0 overflow-hidden">
            <picture>
                <source
                    media="(max-width: 768px)"
                    srcSet="/hero/hero-bg-mobile.png"
                />
                <img
                    ref={bgRef}
                    src="/hero/hero-bg-desktop.png"
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    style={{ willChange: 'transform, filter' }}
                    fetchPriority="high"
                    decoding="async"
                />
            </picture>
        </div>
    )
}
