'use client'

import { useState } from 'react'
import type { ProdutoCatalogo } from '@mont/shared'
import type { ComboItem } from '../../_data'
import { useCartStore } from '@/lib/cart/store'
import { brl, brlCompact } from '../../_components/format'

export function PdpInfo({ product, componentes }: { product: ProdutoCatalogo; componentes: ComboItem[] }) {
    const [qty, setQty] = useState(1)
    const addItem = useCartStore((s) => s.addItem)

    const preco = product.preco ?? 0
    const ancora = product.preco_ancoragem ?? null
    const temAncora = ancora != null && ancora > preco
    const economia = temAncora ? ancora - preco : 0
    const isCombo = componentes.length > 0

    return (
        <div className="flex flex-col rounded-[28px] bg-card p-6 shadow-[0_12px_34px_-16px_rgba(0,0,0,0.18)] md:p-8">
            <h1 className="text-[28px] font-extrabold leading-[1.1] text-foreground md:text-[34px]">
                {product.nome}
            </h1>

            {product.descricao?.trim() && (
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                    {product.descricao}
                </p>
            )}

            {/* Âncora de preço */}
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-[30px] font-extrabold leading-none text-foreground">{brl(preco)}</span>
                {temAncora && (
                    <>
                        <span className="text-[15px] font-semibold text-muted-foreground line-through">{brl(ancora)}</span>
                        <span className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold leading-tight text-primary-foreground">
                            Economize {brlCompact(economia)}
                        </span>
                    </>
                )}
            </div>

            {/* Conteúdo do combo */}
            {isCombo && (
                <div className="mt-5 rounded-2xl bg-muted p-4">
                    <p className="mb-2 text-sm font-bold text-foreground">O que vem no combo</p>
                    <ul className="space-y-1.5">
                        {componentes.map((c, i) => (
                            <li key={i} className="flex items-center gap-2.5 text-[14px] text-foreground">
                                <svg className="h-4 w-4 flex-none text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
                                <span>{c.quantidade > 1 ? `${c.quantidade}× ` : ''}{c.nome}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Stepper + CTA */}
            <div className="mt-6 flex items-stretch gap-3">
                <div className="flex h-14 items-center rounded-full border-2 border-border bg-card">
                    <button
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="px-4 text-xl font-bold text-foreground disabled:opacity-40"
                        aria-label="Diminuir quantidade"
                        disabled={qty <= 1}
                    >
                        −
                    </button>
                    <span className="w-8 text-center text-[16px] font-bold text-foreground tabular-nums">{qty}</span>
                    <button
                        onClick={() => setQty((q) => Math.min(99, q + 1))}
                        className="px-4 text-xl font-bold text-foreground"
                        aria-label="Aumentar quantidade"
                    >
                        +
                    </button>
                </div>

                <button
                    onClick={() => addItem(product, qty)}
                    aria-label={`Adicionar ${product.nome ?? 'produto'} ao carrinho`}
                    className="flex flex-1 items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-accent-light to-accent px-6 text-[16px] font-extrabold text-white shadow-[0_8px_20px_-6px_rgba(230,138,28,0.6)] transition-transform active:scale-[0.98]"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    Adicionar ao carrinho
                </button>
            </div>
        </div>
    )
}
