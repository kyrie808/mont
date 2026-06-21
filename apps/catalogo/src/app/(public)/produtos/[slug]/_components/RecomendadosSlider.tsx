'use client'

import { useRef } from 'react'
import type { ProdutoCatalogo } from '@mont/shared'
import { ProdutoCard } from '../../_components/ProdutoCard'

export function RecomendadosSlider({ produtos }: { produtos: ProdutoCatalogo[] }) {
    const trackRef = useRef<HTMLDivElement>(null)

    if (produtos.length === 0) return null

    const scrollBy = (dir: number) => {
        const el = trackRef.current
        if (!el) return
        el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 600), behavior: 'smooth' })
    }

    return (
        <section className="mt-12">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[22px] font-extrabold text-foreground">Você também pode gostar</h2>
                <div className="hidden gap-2 md:flex">
                    <button
                        onClick={() => scrollBy(-1)}
                        aria-label="Anterior"
                        className="flex items-center justify-center rounded-full bg-card p-2 text-foreground shadow-md transition-transform hover:scale-105"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <button
                        onClick={() => scrollBy(1)}
                        aria-label="Próximo"
                        className="flex items-center justify-center rounded-full bg-card p-2 text-foreground shadow-md transition-transform hover:scale-105"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                </div>
            </div>

            <div
                ref={trackRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {produtos.map((p) => (
                    <div key={p.id} className="w-[200px] shrink-0 snap-start sm:w-[230px]">
                        <ProdutoCard product={p} />
                    </div>
                ))}
            </div>
        </section>
    )
}
