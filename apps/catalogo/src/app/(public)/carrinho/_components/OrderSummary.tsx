'use client'

interface OrderSummaryProps {
    subtotal: number
    frete: number
    total: number
    deliveryMethod: 'entrega' | 'retirada'
    freteDisponivel: boolean
    freteLoading: boolean
    cepPreenchido: boolean
    distanciaKm?: number | null
    formatCurrency: (value: number) => string
}

export default function OrderSummary({
    subtotal,
    frete,
    total,
    deliveryMethod,
    freteDisponivel,
    freteLoading,
    cepPreenchido,
    distanciaKm,
    formatCurrency,
}: OrderSummaryProps) {
    const isEntrega = deliveryMethod === 'entrega'

    // Texto do frete conforme o estado
    let freteTexto: string
    if (freteLoading) freteTexto = 'Calculando...'
    else if (!cepPreenchido) freteTexto = 'Informe o CEP'
    else if (freteDisponivel) freteTexto = formatCurrency(frete)
    else freteTexto = 'A combinar'

    return (
        <div className="border-t border-mont-surface pt-4 space-y-2">
            <div className="flex justify-between text-mont-gray">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
            </div>

            {isEntrega && (
                <div className="flex justify-between text-mont-gray">
                    <span>
                        Entrega
                        {freteDisponivel && distanciaKm != null && (
                            <span className="text-mont-gray/70 text-sm"> (~{distanciaKm.toFixed(1)} km)</span>
                        )}
                    </span>
                    <span>{freteTexto}</span>
                </div>
            )}

            <div className="flex justify-between text-xl font-bold text-mont-espresso pt-2 border-t border-mont-surface">
                <span>Total</span>
                <span className="text-mont-gold">
                    {isEntrega && !freteDisponivel
                        ? `${formatCurrency(subtotal)} + frete`
                        : formatCurrency(total)}
                </span>
            </div>
        </div>
    )
}
