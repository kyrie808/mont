'use client'

import { useRef } from 'react'

export default function HomeWrapper({ children }: { children: React.ReactNode }) {
    const mainRef = useRef<HTMLElement>(null)

    return (
        <main ref={mainRef} className="min-h-screen bg-mont-cream">
            {children}
        </main>
    )
}
