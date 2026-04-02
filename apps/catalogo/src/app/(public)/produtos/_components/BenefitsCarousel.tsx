'use client'

import { useRef } from 'react'
import Image from 'next/image'

export default function BenefitsCarousel() {
    const containerRef = useRef<HTMLDivElement>(null)

    // Unicode Strings
    const sectionTitle = "Por que a Mont é diferente?"

    const benefits = [
        {
            id: 1,
            imagePath: '/images/benefits/queijo-verdade.png',
            title: 'Queijo Canastra de verdade',
            description: 'Usamos o legítimo queijo da Serra da Canastra em abundância em todas as nossas receitas.',
            size: 160,
            offsetY: 0
        },
        {
            id: 2,
            imagePath: '/images/benefits/nao-oco.png',
            title: 'Não é oco, não murcha',
            description: 'Diferente dos industriais, nosso pão de queijo é densamente recheado e mantém a estrutura após assar.',
            size: 160,
            offsetY: 0
        },
        {
            id: 3,
            imagePath: '/images/benefits/sem-conservantes.png',
            title: 'Sem conservantes',
            description: 'Apenas ingredientes naturais e frescos, garantindo uma alimentação saudável para sua família.',
            size: 160,
            offsetY: 0
        },
        {
            id: 4,
            imagePath: '/images/benefits/pronto-20min.png',
            title: 'Pronto em 20 minutos',
            description: 'A praticidade que você precisa com o sabor da padaria artesanal, direto do seu congelador.',
            size: 240,
            offsetY: -40
        }
    ]

    return (
        <section className="bg-mont-cream py-12 md:py-14">
            <h2 className="font-display text-xl md:text-2xl text-mont-espresso px-6 mb-6">
                {sectionTitle}
            </h2>

            <div
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: '48px',
                    paddingLeft: '48px',
                    paddingRight: '24px',
                    paddingBottom: '16px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }}
            >
                {benefits.map((benefit) => (
                    <div
                        key={benefit.id}
                        style={{
                            minWidth: '280px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            border: '1px solid rgba(0,0,0,0.08)',
                            borderRadius: '16px',
                            backgroundColor: 'white',
                            padding: '20px 20px 20px 0px',
                            overflow: 'visible'
                        }}
                    >
                        <div style={{
                            flexShrink: 0,
                            marginLeft: '-60px',
                            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))',
                            zIndex: 10,
                            position: 'relative',
                            marginTop: benefit.offsetY + 'px'
                        }}>
                            <Image
                                src={benefit.imagePath}
                                width={benefit.size}
                                height={benefit.size}
                                alt={benefit.title}
                                style={{ height: 'auto', objectFit: 'contain' }}
                            />
                        </div>
                        <div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', marginBottom: '4px' }}>
                                {benefit.title}
                            </h3>
                            <p style={{ fontSize: '13px', opacity: 0.6, lineHeight: 1.5 }}>
                                {benefit.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
