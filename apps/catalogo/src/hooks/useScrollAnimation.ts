import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

interface ScrollAnimationOptions {
    y?: number
    duration?: number
    delay?: number
    start?: string
    stagger?: number
}

export function useScrollAnimation<T extends HTMLElement = HTMLElement>({
    y = 50,
    duration = 0.8,
    delay = 0,
    start = 'top 85%',
}: ScrollAnimationOptions = {}) {
    const elementRef = useRef<T>(null)

    useLayoutEffect(() => {
        gsap.registerPlugin(ScrollTrigger)

        const element = elementRef.current
        if (!element) return

        const ctx = gsap.context(() => {
            gsap.fromTo(element,
                { y: y, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: duration,
                    delay: delay,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: element,
                        start: start,
                        toggleActions: 'play none none reverse' // Reverse on scroll up? Or 'play none none none'? Prompt didn't specify. 'play none none none' is usually safer for reading.
                        // But verifying: `toggleActions: 'play none none none'` means play continuously?
                        // Actually 'play none none none' is play once.
                    }
                }
            )
        })

        return () => ctx.revert()
    }, [y, duration, delay, start])

    return elementRef
}
