import { ShoppingCart, CreditCard, X } from 'lucide-react'
import { Button } from '../../../ui'
import { formatCurrency } from '@mont/shared'
import type { CartItem } from '../../../../stores/useCartStore'

interface CartSidebarProps {
    items: CartItem[]
    total: number
    onUpdateQuantity: (id: string, delta: number) => void
    onCheckout: () => void
    onClear: () => void
    onClose?: () => void
    hideCheckoutButton?: boolean
}

export function CartSidebar({ items, total, onUpdateQuantity, onCheckout, onClear, onClose, hideCheckoutButton }: CartSidebarProps) {
    if (items.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 relative">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                    >
                        <X className="h-6 w-6 text-gray-500" />
                    </button>
                )}
                <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-center">Carrinho vazio</p>
                <p className="text-sm text-center mt-1">Adicione produtos para começar a venda</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary-600" />
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Carrinho</h2>
                    <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {items.reduce((acc, i) => acc + i.quantidade, 0)}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClear}
                        className="text-xs text-red-500 hover:text-red-600 font-medium hover:underline"
                    >
                        Limpar
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {items.map((item) => (
                    <div key={item.produto_id} className="flex gap-3 bg-white dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm line-clamp-1">{item.produto.nome}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {formatCurrency(item.preco_unitario)} un.
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                {formatCurrency(item.subtotal)}
                            </span>

                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-md p-1">
                                <button
                                    onClick={() => onUpdateQuantity(item.produto_id, -1)}
                                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 transition"
                                >
                                    -
                                </button>
                                <span className="text-xs font-medium w-4 text-center">{item.quantidade}</span>
                                <button
                                    onClick={() => onUpdateQuantity(item.produto_id, 1)}
                                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 transition"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {!hideCheckoutButton && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-500 font-medium">Total Geral</span>
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(total)}</span>
                    </div>

                    <Button
                        onClick={onCheckout}
                        className="w-full"
                        size="lg"
                        leftIcon={<CreditCard className="h-5 w-5" />}
                    >
                        Finalizar Venda
                    </Button>
                </div>
            )}
        </div>
    )
}
