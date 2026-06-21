'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { ProdutoCatalogo } from '@mont/shared'
import type { ComboItem } from '../_data'
import { brl, brlCompact } from './format'
import { seloLabel } from './selo'
import { AddButton } from './AddButton'

interface Props {
    destaques: ProdutoCatalogo[]
    componentesByProduto: Record<string, ComboItem[]>
}

export function FeaturedCarousel({ destaques, componentesByProduto }: Props) {
    const [index, setIndex] = useState(0)
    const trackRef = useRef<HTMLDivElement>(null)
    const count = destaques.length
    const indexRef = useRef(0)
    // Enquanto Date.now() < este valor, o autoplay fica pausado (usuário interagindo).
    const pauseUntilRef = useRef(0)

    const scrollToIndex = (i: number) => {
        const el = trackRef.current
        if (!el) return
        const child = el.children[i] as HTMLElement | undefined
        if (child) el.scrollTo({ left: child.offsetLeft, behavior: 'smooth' })
    }

    // O scroll do usuário é a fonte da verdade: deriva o índice do card mais centralizado.
    useEffect(() => {
        const el = trackRef.current
        if (!el) return
        let raf = 0
        const onScroll = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
                const children = Array.from(el.children) as HTMLElement[]
                const center = el.scrollLeft + el.clientWidth / 2
                let best = 0
                let bestDist = Infinity
                children.forEach((ch, i) => {
                    const c = ch.offsetLeft + ch.offsetWidth / 2
                    const d = Math.abs(c - center)
                    if (d < bestDist) {
                        bestDist = d
                        best = i
                    }
                })
                indexRef.current = best
                setIndex(best)
            })
        }
        el.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            el.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(raf)
        }
    }, [])

    // Pausa o autoplay assim que o usuário toca/arrasta/rola, dando tempo de navegar.
    useEffect(() => {
        const el = trackRef.current
        if (!el) return
        const pause = () => {
            pauseUntilRef.current = Date.now() + 8000
        }
        el.addEventListener('pointerdown', pause)
        el.addEventListener('touchstart', pause, { passive: true })
        el.addEventListener('wheel', pause, { passive: true })
        return () => {
            el.removeEventListener('pointerdown', pause)
            el.removeEventListener('touchstart', pause)
            el.removeEventListener('wheel', pause)
        }
    }, [])

    // Autoplay — avança rolando o track (não briga com o scroll manual; respeita a pausa).
    useEffect(() => {
        if (count <= 1) return
        const t = setInterval(() => {
            if (Date.now() < pauseUntilRef.current) return
            scrollToIndex((indexRef.current + 1) % count)
        }, 6000)
        return () => clearInterval(t)
    }, [count])

    if (count === 0) return null

    const go = (d: number) => {
        pauseUntilRef.current = Date.now() + 8000
        scrollToIndex((indexRef.current + d + count) % count)
    }

    return (
        <div className="relative mb-8">
            <div
                ref={trackRef}
                className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {destaques.map((p) => (
                    <FeaturedSlide
                        key={p.id}
                        product={p}
                        componentes={p.id ? componentesByProduto[p.id] ?? [] : []}
                    />
                ))}
            </div>

            {count > 1 && (
                <>
                    <button
                        onClick={() => go(-1)}
                        aria-label="Anterior"
                        className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-card/90 p-2 text-foreground shadow-md backdrop-blur-sm transition-transform hover:scale-105 md:flex"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <button
                        onClick={() => go(1)}
                        aria-label="Próximo"
                        className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-card/90 p-2 text-foreground shadow-md backdrop-blur-sm transition-transform hover:scale-105 md:flex"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>

                    <div className="mt-4 flex justify-center gap-2">
                        {destaques.map((p, i) => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    pauseUntilRef.current = Date.now() + 8000
                                    scrollToIndex(i)
                                }}
                                aria-label={`Ir para destaque ${i + 1}`}
                                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-accent' : 'w-2 bg-border-strong'}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

const MONT_SELOS = ['Artesanal', 'Sem conservante', 'Queijo Canastra de verdade']

function FeaturedSlide({ product, componentes }: { product: ProdutoCatalogo; componentes: ComboItem[] }) {
    const isCombo = componentes.length > 0
    const seloBadge = seloLabel(product.selo)
    // Checklist do produto (um por linha); vazio → selos padrão da Mont.
    const selosProduto = (product.beneficios ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    const selos = selosProduto.length > 0 ? selosProduto : MONT_SELOS
    const preco = product.preco ?? 0
    const ancora = product.preco_ancoragem ?? null
    const temAncora = ancora != null && ancora > preco
    const economia = temAncora ? ancora - preco : 0

    return (
        <Link
            href={`/produtos/${product.slug}`}
            className="group h-full w-full shrink-0 snap-start focus:outline-none"
        >
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-card shadow-[0_12px_34px_-16px_rgba(0,0,0,0.22)] md:flex-row">
                {/* Foto */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted md:aspect-auto md:w-1/2">
                    {product.url_imagem_principal ? (
                        <Image
                            src={product.url_imagem_principal}
                            alt={product.nome ?? ''}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority
                        />
                    ) : (
                        <div className="flex h-full min-h-[220px] w-full items-center justify-center text-border-strong">
                            <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                    )}
                    {seloBadge && (
                        <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-primary-foreground shadow-sm">
                            {seloBadge}
                            <span className="text-accent-light" aria-hidden="true">★</span>
                        </span>
                    )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-center p-6 md:p-8">
                    {isCombo && (
                        <span className="w-fit rounded-full bg-primary/12 px-3 py-1 text-[12px] font-extrabold uppercase tracking-wide text-primary">
                            Combo
                        </span>
                    )}
                    <h2 className="mt-2 text-[26px] font-extrabold leading-[1.1] text-foreground md:text-[32px]">
                        {product.nome}
                    </h2>

                    {isCombo ? (
                        <ul className="mt-4 space-y-2">
                            {componentes.slice(0, 4).map((c, i) => (
                                <li key={i} className="flex items-center gap-2.5 text-[15px] text-foreground">
                                    <svg className="h-4 w-4 flex-none text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
                                    <span>{c.quantidade > 1 ? `${c.quantidade}× ` : ''}{c.nome}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <ul className="mt-4 space-y-2">
                            {selos.slice(0, 4).map((s) => (
                                <li key={s} className="flex items-center gap-2.5 text-[15px] text-foreground">
                                    <svg className="h-4 w-4 flex-none text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
                                    <span>{s}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                        {temAncora && (
                            <span className="text-[15px] font-semibold text-muted-foreground line-through">{brl(ancora)}</span>
                        )}
                        <span className="text-[28px] font-extrabold leading-none text-primary md:text-[30px]">{brl(preco)}</span>
                        {temAncora && (
                            <span className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold leading-tight text-primary-foreground">
                                Economize {brlCompact(economia)}
                            </span>
                        )}
                    </div>

                    <div className="mt-5 max-w-sm">
                        <AddButton product={product} variant="full" />
                    </div>
                </div>
            </div>
        </Link>
    )
}
