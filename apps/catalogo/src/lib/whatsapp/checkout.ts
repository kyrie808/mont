import type { CartItem } from '@/types/cart'

interface CheckoutFormData {
    customer_name: string
    customer_phone: string
    customer_address: string
    delivery_method: 'entrega' | 'retirada'
    payment_method: 'pix' | 'dinheiro'
    referred_by?: string
    notes?: string
}

const paymentMethodLabels = {
    pix: 'PIX',
    dinheiro: 'Dinheiro'
}

/**
 * Gera mensagem formatada para WhatsApp checkout
 * Conforme PRD seção 4.4
 */
export function generateWhatsAppMessage(
    formData: CheckoutFormData,
    items: CartItem[],
    subtotalCents: number,
    deliveryFeeCents: number,
    totalCents: number
): string {
    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(cents / 100)
    }

    // Header
    let message = '🧀 *Novo Pedido — Mont Distribuidora*\n\n'

    // Dados do cliente
    message += `*Cliente:* ${formData.customer_name}\n`
    message += `*Telefone:* ${formData.customer_phone}\n`

    if (formData.delivery_method === 'entrega' && formData.customer_address) {
        message += `*Entrega:* ${formData.customer_address}\n`
    } else {
        message += `*Retirada no local*\n`
    }

    message += '\n━━━━━━━━━━━━━━━━\n\n'

    // Itens
    message += '*Itens:*\n'
    items.forEach(item => {
        const itemTotal = item.product.price_cents * item.quantity
        message += `▸ ${item.product.name} × ${item.quantity} — ${formatCurrency(itemTotal)}\n`
    })

    message += '\n━━━━━━━━━━━━━━━━\n\n'

    // Totais
    message += `*Subtotal:* ${formatCurrency(subtotalCents)}\n`

    if (formData.delivery_method === 'entrega') {
        message += deliveryFeeCents === 0
            ? '*Entrega:* Grátis (SBC)\n'
            : `*Entrega:* ${formatCurrency(deliveryFeeCents)}\n`
    }

    message += `*Total:* ${formatCurrency(totalCents)}\n`
    message += `*Pagamento:* ${paymentMethodLabels[formData.payment_method]}\n`

    // Informações adicionais
    if (formData.referred_by) {
        message += `\n*Indicado por:* ${formData.referred_by}\n`
    }

    if (formData.notes) {
        message += `*Obs:* ${formData.notes}\n`
    }

    message += '\nPedido feito pelo site montdistribuidora.com.br'

    return message
}

/**
 * Gera URL do WhatsApp com mensagem pré-preenchida
 */
export function generateWhatsAppUrl(message: string): string {
    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5511934417085'
    const encodedMessage = encodeURIComponent(message)

    return `https://wa.me/${whatsappNumber}?text=${encodedMessage}`
}
