'use client'

interface OrderSummaryProps {
    subtotal: number
    frete: number
    total: number
    deliveryMethod: 'entrega' | 'retirada'
    formatCurrency: (value: number) => string
}

export default function OrderSummary({ subtotal, frete, total, deliveryMethod, formatCurrency }: OrderSummaryProps) {
    return (
        <div className="border-t border-mont-surface pt-4 space-y-2">
            <div className="flex justify-between text-mont-gray">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
            </div>

            {deliveryMethod === 'entrega' && (
                <div className="flex justify-between text-mont-gray">
                    <span>Entrega</span>
                    <span>A combinar</span>
                </div>
            )}

            <div className="flex justify-between text-xl font-bold text-mont-espresso pt-2 border-t border-mont-surface">
                <span>Total</span>
                <span className="text-mont-gold">{formatCurrency(total)}</span>
            </div>
        </div>
    )
}
