'use client'

import { useCartStore } from '@/lib/cart/store'
import type { ProdutoCatalogo } from '@mont/shared'

interface AddButtonProps {
    product: ProdutoCatalogo
    variant?: 'outline' | 'full'
}

export function AddButton({ product, variant = 'outline' }: AddButtonProps) {
    const addItem = useCartStore((s) => s.addItem)

    const handle = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        addItem(product, 1)
    }

    if (variant === 'full') {
        return (
            <button
                onClick={handle}
                aria-label={`Adicionar ${product.nome ?? 'produto'} ao carrinho`}
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-accent-light to-accent py-4 text-[17px] font-extrabold text-white shadow-[0_8px_20px_-6px_rgba(230,138,28,0.6)] transition-transform active:scale-[0.98]"
            >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                Adicionar ao carrinho
            </button>
        )
    }

    return (
        <button
            onClick={handle}
            aria-label={`Adicionar ${product.nome ?? 'produto'} ao carrinho`}
            className="w-full rounded-full border-2 border-accent py-3.5 text-sm font-bold text-accent-strong transition-colors hover:bg-accent hover:text-white active:scale-[0.98]"
        >
            Adicionar
        </button>
    )
}
