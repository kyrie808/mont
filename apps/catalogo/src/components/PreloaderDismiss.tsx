'use client'

import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

declare global {
    interface Window {
        __dismissPreloader?: () => void
    }
}

gsap.registerPlugin(ScrollTrigger)

export default function PreloaderDismiss() {
    useEffect(() => {
        if (typeof window === 'undefined') return

        if (window.__dismissPreloader) {
            window.__dismissPreloader()
        }

        setTimeout(() => {
            ScrollTrigger.refresh()
        }, 500)
    }, [])

    return null
}
