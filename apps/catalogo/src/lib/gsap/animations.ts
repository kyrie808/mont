import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register GSAP plugins
if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger)
}

/**
 * Check if user prefers reduced motion
 */
const prefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 1. HERO — Reveal do texto palavra por palavra
 */
export const heroTextReveal = (element: HTMLElement) => {
    if (prefersReducedMotion()) return gsap.context(() => { })

    const words = element.querySelectorAll('.word')

    const ctx = gsap.context(() => {
        gsap.from(words, {
            y: 120,
            opacity: 0,
            rotateX: -80,
            stagger: 0.08,
            duration: 1.2,
            ease: 'power4.out',
        })
    })

    return ctx
}

/**
 * 2. PARALLAX — Imagem se move mais devagar que o conteúdo
 */
export const parallaxImage = (element: HTMLElement, options?: { speed?: number }) => {
    if (prefersReducedMotion()) return gsap.context(() => { })

    const speed = options?.speed || 0.5

    const ctx = gsap.context(() => {
        gsap.to(element, {
            yPercent: -20 * speed,
            ease: 'none',
            scrollTrigger: {
                trigger: element.parentElement,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
            },
        })
    })

    return ctx
}

/**
 * 3. SCROLL REVEAL — Elementos aparecem ao entrar no viewport
 */
export const scrollReveal = (elements: HTMLElement[], options?: { stagger?: number }) => {
    if (prefersReducedMotion() || elements.length === 0) return gsap.context(() => { })

    const stagger = options?.stagger || 0.1

    const ctx = gsap.context(() => {
        gsap.from(elements, {
            y: 60,
            opacity: 0,
            duration: 0.8,
            stagger,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: elements[0],
                start: 'top 85%',
                toggleActions: 'play none none none',
            },
        })
    })

    return ctx
}

/**
 * 4. PRODUCT CARD HOVER — Zoom sutil na imagem
 */
export const productCardHover = (card: HTMLElement) => {
    if (prefersReducedMotion()) return

    const img = card.querySelector('img')
    if (!img) return

    const tl = gsap.timeline({ paused: true })
    tl.to(img, { scale: 1.05, duration: 0.4, ease: 'power2.out' })

    card.addEventListener('mouseenter', () => tl.play())
    card.addEventListener('mouseleave', () => tl.reverse())
}

/**
 * 5. SECTION TRANSITION — Fundo muda de cor suavemente no scroll
 */
export const sectionColorTransition = (section: HTMLElement, toColor: string) => {
    if (prefersReducedMotion()) return

    gsap.to(section, {
        backgroundColor: toColor,
        scrollTrigger: {
            trigger: section,
            start: 'top 60%',
            end: 'top 20%',
            scrub: true,
        },
    })
}

/**
 * 6. COUNTER — Números de faturamento animam até o valor (admin)
 */
export const animateCounter = (element: HTMLElement, endValue: number, formatFn?: (val: number) => string) => {
    if (prefersReducedMotion()) {
        element.textContent = formatFn ? formatFn(endValue) : endValue.toString()
        return
    }

    gsap.from(element, {
        textContent: 0,
        duration: 1.5,
        ease: 'power2.out',
        snap: { textContent: 1 },
        onUpdate: function () {
            const currentValue = Number(element.textContent)
            element.textContent = formatFn ? formatFn(currentValue) : currentValue.toString()
        }
    })
}

/**
 * 7. CART ADD — Feedback visual ao adicionar produto
 */
export const cartAddFeedback = (button: HTMLElement, cartIcon: HTMLElement) => {
    if (prefersReducedMotion()) return

    const tl = gsap.timeline()
    tl.to(button, { scale: 0.95, duration: 0.1 })
        .to(button, { scale: 1, duration: 0.2, ease: 'back.out(1.7)' })
        .fromTo(
            cartIcon,
            { scale: 1 },
            { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1 },
            '-=0.1'
        )
}

/**
 * 8. PAGE TRANSITION — Smooth transition entre páginas (Framer Motion variants)
 */
export const pageTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
}

/**
 * Cleanup all ScrollTrigger instances
 */
export const cleanupScrollTriggers = () => {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill())
}
