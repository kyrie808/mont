'use client'

import { useState, useEffect } from 'react'
import { useCartStore } from '@/lib/cart/store'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ui/ToastContainer'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navbar, Footer } from '@/components/catalog'
import { Button } from '@/components/ui'
import { formatCurrency, formatPhone, unformatPhone } from '@/lib/utils/format'
import { generateWhatsAppMessage, generateWhatsAppUrl } from '@/lib/whatsapp/checkout'
import { useCep } from '@/hooks/useCep'
import { DELIVERY_CONFIG } from '@/lib/constants/delivery'
import Link from 'next/link'
import CartItemList from './_components/CartItemList'
import CheckoutForm from './_components/CheckoutForm'
import { checkoutSchema, type CheckoutFormData } from './types'

const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`
    return digits
}

export default function CarrinhoPage() {
    const { items, updateQuantity, removeItem, getTotalPrice, clearCart } = useCartStore()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [phoneValue, setPhoneValue] = useState('')
    const [cepDisplayValue, setCepDisplayValue] = useState('')
    const { toasts, showToast } = useToast()

    const { fetchCep, loading: loadingCep } = useCep()

    const form = useForm<CheckoutFormData>({
        resolver: zodResolver(checkoutSchema),
        defaultValues: {
            delivery_method: 'entrega',
            payment_method: 'pix',
            cep: '',
            logradouro: '',
            numero: '',
            complemento: '',
            bairro: '',
            cidade: '',
            uf: '',
        },
    })

    const { watch, setValue, setFocus } = form

    const deliveryMethod = watch('delivery_method')
    const cepValue = watch('cep')
    const subtotalCents = getTotalPrice()
    const deliveryFeeCents = deliveryMethod === 'entrega' ? DELIVERY_CONFIG.SBC_FEE_CENTS : 0
    const totalCents = subtotalCents + deliveryFeeCents

    // Dispara busca ao completar 8 dígitos — mesmo padrão do ContatoFormModal.tsx
    useEffect(() => {
        if (cepValue && cepValue.replace(/\D/g, '').length === 8) {
            fetchCep(cepValue).then((data) => {
                if (data) {
                    setValue('logradouro', data.street)
                    setValue('bairro', data.neighborhood)
                    setValue('cidade', data.city)
                    setValue('uf', data.state)
                    setTimeout(() => setFocus('numero'), 100)
                }
            })
        }
    }, [cepValue]) // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit = async (data: CheckoutFormData) => {
        setIsSubmitting(true)

        try {
            // Monta customer_address a partir dos campos individuais
            let customer_address: string | undefined
            if (data.delivery_method === 'entrega') {
                const parts: string[] = []
                // Logradouro, Número - Complemento - Bairro - Cidade/UF - CEP
                if (data.logradouro) {
                    parts.push(`${data.logradouro}, ${data.numero || 'S/N'}`)
                }
                if (data.complemento) parts.push(data.complemento)
                if (data.bairro) parts.push(data.bairro)
                if (data.cidade && data.uf) parts.push(`${data.cidade}/${data.uf}`)
                if (data.cep) parts.push(data.cep)
                customer_address = parts.join(' - ')
            }

            const orderPayload = {
                customer_name: data.customer_name,
                customer_phone: unformatPhone(data.customer_phone),
                customer_address,
                delivery_method: data.delivery_method,
                payment_method: data.payment_method,
                items: items.map(item => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                })),
                delivery_fee_cents: deliveryFeeCents,
                referred_by: data.referred_by,
                notes: data.notes,
                customer_cep: data.cep || null,
                customer_logradouro: data.logradouro || null,
                customer_numero: data.numero || null,
                customer_complemento: data.complemento || null,
                customer_bairro: data.bairro || null,
                customer_cidade: data.cidade || null,
                customer_uf: data.uf || null,
            }

            // Salva pedido no Supabase
            const response = await fetch('/api/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload),
            })

            if (!response.ok) {
                throw new Error('Erro ao salvar pedido')
            }

            // Gera mensagem WhatsApp (usa customer_address montado)
            const message = generateWhatsAppMessage(
                { ...data, customer_address: customer_address || '' },
                items,
                subtotalCents,
                deliveryFeeCents,
                totalCents
            )

            const whatsappUrl = generateWhatsAppUrl(message)
            window.open(whatsappUrl, '_blank')
            clearCart()

        } catch (error) {
            console.error('Erro ao finalizar pedido:', error)
            showToast('Erro ao finalizar pedido. Tente novamente.')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Estado vazio
    if (items.length === 0) {
        return (
            <>
                <Navbar />
                <main className="min-h-screen bg-mont-cream py-20">
                    <div className="container mx-auto px-4">
                        <div className="max-w-2xl mx-auto text-center py-20">
                            <svg className="w-24 h-24 mx-auto mb-6 text-mont-gray/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>

                            <h1 className="font-display text-4xl text-mont-espresso mb-4">
                                Seu carrinho está vazio
                            </h1>

                            <p className="text-mont-gray text-lg mb-8">
                                Adicione produtos ao carrinho para continuar
                            </p>

                            <Link href="/produtos">
                                <Button variant="primary" size="lg">
                                    Ver Produtos
                                </Button>
                            </Link>
                        </div>
                    </div>
                </main>
                <Footer />
            </>
        )
    }

    return (
        <>
            <Navbar />

            <main className="min-h-screen bg-mont-cream py-20">
                <div className="container mx-auto px-4">
                    <h1 className="font-display text-4xl md:text-5xl text-mont-espresso mb-12 text-center">
                        Finalizar Pedido
                    </h1>

                    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Lista de Itens */}
                        <CartItemList
                            items={items}
                            onIncrease={(id) => updateQuantity(id, items.find(i => i.product.id === id)!.quantity + 1)}
                            onDecrease={(id) => updateQuantity(id, items.find(i => i.product.id === id)!.quantity - 1)}
                            onRemove={removeItem}
                            formatCurrency={formatCurrency}
                        />

                        {/* Formulário + Resumo */}
                        <CheckoutForm
                            form={form}
                            onSubmit={onSubmit}
                            isSubmitting={isSubmitting}
                            phoneValue={phoneValue}
                            onPhoneChange={(e) => {
                                const formatted = formatPhone(e.target.value)
                                setPhoneValue(formatted)
                            }}
                            cepDisplayValue={cepDisplayValue}
                            onCepChange={(e) => {
                                const masked = formatCep(e.target.value)
                                setCepDisplayValue(masked)
                                form.setValue('cep', masked)
                            }}
                            loadingCep={loadingCep}
                            subtotalCents={subtotalCents}
                            deliveryFeeCents={deliveryFeeCents}
                            totalCents={totalCents}
                        />
                    </div>
                </div>
            </main>

            <Footer />
            <ToastContainer toasts={toasts} />
        </>
    )
}
