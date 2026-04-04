'use client'

import Image from 'next/image'
import type { ItemCarrinho } from '@/types/cart'

interface CartItemListProps {
    items: ItemCarrinho[]
    onIncrease: (id: string) => void
    onDecrease: (id: string) => void
    onRemove: (id: string) => void
    formatCurrency: (value: number) => string
}

export default function CartItemList({ items, onIncrease, onDecrease, onRemove, formatCurrency }: CartItemListProps) {
    return (
        <div className="lg:col-span-2 space-y-4">
            <h2 className="font-display text-2xl text-mont-espresso mb-4">
                Seus Itens
            </h2>

            {items.map((item) => (
                <div
                    key={item.produto.id}
                    className="bg-mont-white p-4 rounded-lg shadow-sm flex gap-4"
                >
                    <div className="relative w-20 h-20 bg-mont-surface rounded flex-shrink-0 overflow-hidden">
                        {item.produto.url_imagem_principal ? (
                            <Image
                                src={item.produto.url_imagem_principal!}
                                alt={item.produto.nome!}
                                fill
                                className="object-cover"
                                sizes="80px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-mont-gray/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <h3 className="font-medium text-mont-espresso mb-1">
                            {item.produto.nome!}
                        </h3>
                        <p className="text-mont-gray text-sm mb-2">
                            {formatCurrency(item.produto.preco!)} cada
                        </p>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onDecrease(item.produto.id!)}
                                className="w-8 h-8 bg-mont-surface rounded flex items-center justify-center text-mont-espresso hover:bg-mont-gray/10"
                            >
                                −
                            </button>

                            <span className="w-16 text-center bg-mont-surface rounded py-1 text-mont-espresso">
                                {item.quantidade}
                            </span>

                            <button
                                onClick={() => onIncrease(item.produto.id!)}
                                className="w-8 h-8 bg-mont-surface rounded flex items-center justify-center text-mont-espresso hover:bg-mont-gray/10"
                            >
                                +
                            </button>

                            <button
                                onClick={() => onRemove(item.produto.id!)}
                                className="ml-auto text-mont-gray hover:text-red-600 transition-colors"
                            >
                                Remover
                            </button>
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="font-medium text-mont-espresso">
                            {formatCurrency(item.produto.preco! * item.quantidade)}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    )
}
