'use client'

import React, { useContext, useLayoutEffect, useRef } from 'react'
import { HeroContext } from './ScrollWrapper'
import gsap from 'gsap'

export default function FloatingPaes() {
    const { timeline } = useContext(HeroContext)
    const containerRef = useRef<HTMLDivElement>(null)

    // Configuração dos 6 pães flutuantes
    const paes = [
        { id: 1, top: '15%', left: '10%', size: 60, delay: 0 },
        { id: 2, top: '25%', right: '12%', size: 50, delay: 0.2 },
        { id: 3, bottom: '20%', left: '15%', size: 70, delay: 0.4 },
        { id: 4, bottom: '25%', right: '10%', size: 55, delay: 0.1 },
        { id: 5, top: '40%', left: '5%', size: 40, delay: 0.3 },
        { id: 6, top: '35%', right: '5%', size: 45, delay: 0.5 },
    ]

    useLayoutEffect(() => {
        // Idle Animation (Flutuando) - Independente do Scroll
        const ctx = gsap.context(() => {
            gsap.utils.toArray<Element>('.floating-pao').forEach((pao, i) => {
                gsap.to(pao, {
                    y: `+=${15 + i * 5}`,
                    rotation: i % 2 === 0 ? 10 : -10,
                    duration: 2 + i * 0.5,
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 0.2
                })
            })
        }, containerRef)

        return () => ctx.revert()
    }, []) // Run once on mount

    useLayoutEffect(() => {
        if (!timeline || !containerRef.current) return

        // Scatter Animation (Explosão no Scroll)
        // Scroll 15% -> 25%

        // FIX BUG 3: Fade out container logo no início do scroll para não poluir o zoom
        timeline.to(containerRef.current, {
            opacity: 0,
            duration: 2, // Speed it up to fade out faster
            ease: 'power1.in'
        }, 0)

        const paesElements = containerRef.current.querySelectorAll('.floating-pao')

        // Direções de explosão (hardcoded para controle artístico)
        const directions = [
            { x: -300, y: -250 }, // 1 (Top Left)
            { x: 350, y: -200 },  // 2 (Top Right)
            { x: -400, y: 150 },  // 3 (Bottom Left)
            { x: 380, y: 200 },   // 4 (Bottom Right)
            { x: -200, y: -300 }, // 5 (Mid Left)
            { x: 250, y: -280 },  // 6 (Mid Right)
        ]

        paesElements.forEach((pao, i) => {
            timeline.to(pao, {
                x: directions[i].x,
                y: directions[i].y,
                opacity: 0,
                scale: 0,
                duration: 10, // 10% do scroll (15 -> 25)
                ease: 'power2.in'
            }, 15 + (i * 0.5)) // Start at 15 with slight stagger embedded in timeline pos
        })

    }, [timeline])

    return (
        <div ref={containerRef} className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
            {paes.map((pao, i) => (
                <div
                    key={pao.id}
                    className="floating-pao absolute rounded-full shadow-lg"
                    style={{
                        top: pao.top,
                        left: pao.left,
                        right: pao.right,
                        bottom: pao.bottom,
                        width: pao.size,
                        height: pao.size,
                        background: 'radial-gradient(ellipse at 35% 30%, #F5D78E 0%, #E8B84D 35%, #C4942E 70%, #A07020 100%)',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.15), inset 0 -5px 10px rgba(0,0,0,0.1)'
                    }}
                />
            ))}
        </div>
    )
}
