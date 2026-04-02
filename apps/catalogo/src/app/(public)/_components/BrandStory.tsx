'use client'

import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { FloatingCheeseBread } from '@/components/visual/FloatingCheeseBread'
import { useRef } from 'react'

export default function BrandStory() {
    const TITLE = "A Mont nasceu na cozinha de casa."

    const P1 = "Do amor pela comida de verdade veio a receita.\nE da receita veio uma escolha que n\u00E3o abrimos m\u00E3o:\nQueijo Canastra leg\u00EDtimo, em quantidade de verdade."

    const P2 = "Por isso nosso p\u00E3o de queijo n\u00E3o \u00E9 oco.\nN\u00E3o murcha. E o sabor voc\u00EA reconhece\nna primeira mordida."

    const P3 = "Hoje atendemos toda a regi\u00E3o do ABC \u2014\nsem conservantes, sem atalhos, sem substituir\no que faz a diferen\u00E7a."

    const p1Ref = useScrollAnimation<HTMLParagraphElement>({ delay: 0.1 })
    const p2Ref = useScrollAnimation<HTMLParagraphElement>({ delay: 0.2 })
    const p3Ref = useScrollAnimation<HTMLParagraphElement>({ delay: 0.3 })
    const breadRef = useRef(null)

    return (
        <section id="brand-story" className="py-20 md:py-32 bg-transparent relative overflow-hidden">
            {/* Decorative Bread */}
            <div ref={breadRef} className="absolute -left-10 top-10 opacity-10 hidden md:block">
                <FloatingCheeseBread size="xl" />
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="font-display text-4xl md:text-5xl text-mont-espresso mb-6">
                        {TITLE}
                    </h2>

                    <div className="prose prose-lg mx-auto text-mont-gray">
                        <p ref={p1Ref} className="mb-4 whitespace-pre-line">
                            {P1}
                        </p>

                        <p ref={p2Ref} className="mb-4 whitespace-pre-line">
                            {P2}
                        </p>

                        <p ref={p3Ref} className="whitespace-pre-line">
                            {P3}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
