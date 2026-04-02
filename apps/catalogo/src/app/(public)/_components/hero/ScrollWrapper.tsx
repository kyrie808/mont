'use client'

import React, { useLayoutEffect, useRef, useState, useMemo } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register plugin globally (safe in Next.js client components)
if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger)
    ScrollTrigger.config({ ignoreMobileResize: true })
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (!isIOS) {
        ScrollTrigger.normalizeScroll(true)
    }
}

interface ScrollWrapperProps {
    children: React.ReactNode
}

export const HeroContext = React.createContext<{
    timeline: gsap.core.Timeline | null
    scrollProgressRef: React.MutableRefObject<number> | null
}>({
    timeline: null,
    scrollProgressRef: null
})

export default function ScrollWrapper({ children }: ScrollWrapperProps) {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const scrollProgressRef = useRef<number>(0)
    const [timeline, setTimeline] = useState<gsap.core.Timeline | null>(null)
    // Removed state to avoid re-renders clashing with GSAP pin

    // Combine logic into a single effect to guarantee order:
    // Create Pin with ScrollTrigger
    useLayoutEffect(() => {
        if (!wrapperRef.current || !contentRef.current) return

        // GSAP Context & Pin Check
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: wrapperRef.current,
                    start: 'top top',
                    end: '+=250%',
                    pin: contentRef.current,
                    pinSpacing: true,
                    scrub: 0.5,
                    anticipatePin: 1,
                    onUpdate: (self) => {
                        scrollProgressRef.current = self.progress
                    },
                    // Add invalidateOnRefresh to handle dynamic height changes better
                    invalidateOnRefresh: true
                }
            })

            setTimeline(tl)

        }, wrapperRef)

        return () => {
            ctx.revert()
        }
    }, [])

    const contextValue = useMemo(() => ({
        timeline,
        scrollProgressRef
    }), [timeline])

    return (
        <HeroContext.Provider value={contextValue}>
            {/* 
                Removido 'h-[350dvh]' - GSAP controlará o espaçamento nativo agora via pinSpacing: true.
                O background foi movido para o contentRef que será fixado.
             */}
            <div
                ref={wrapperRef}
                data-hero-wrapper
                className="relative w-full"
                style={{
                    background: 'linear-gradient(to bottom, #0D0603 0%, #0D0603 80%, #FAF7F2 95%, #FAF7F2 100%)'
                }}
            >
                {/* Fallback height for SSR/Initial render before JS kicks in */}
                <div
                    ref={contentRef}
                    className="w-full h-[100dvh] overflow-hidden"
                    style={{
                        background: 'linear-gradient(to bottom, #0D0603 0%, #0D0603 80%, #FAF7F2 95%, #FAF7F2 100%)'
                    }}
                >
                    {children}
                </div>
            </div>
        </HeroContext.Provider>
    )
}
