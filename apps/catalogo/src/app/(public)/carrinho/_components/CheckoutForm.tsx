'use client'

import { UseFormReturn } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { DELIVERY_CONFIG } from '@/lib/constants/delivery'
import OrderSummary from './OrderSummary'
import type { CheckoutFormData } from '../types'

const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`
    return digits
}

interface CheckoutFormProps {
    form: UseFormReturn<CheckoutFormData>
    onSubmit: (data: CheckoutFormData) => Promise<void>
    isSubmitting: boolean
    phoneValue: string
    onPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    cepDisplayValue: string
    onCepChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    loadingCep: boolean
    subtotalCents: number
    deliveryFeeCents: number
    totalCents: number
}

export default function CheckoutForm({
    form,
    onSubmit,
    isSubmitting,
    phoneValue,
    onPhoneChange,
    cepDisplayValue,
    onCepChange,
    loadingCep,
    subtotalCents,
    deliveryFeeCents,
    totalCents,
}: CheckoutFormProps) {
    const { register, handleSubmit, formState: { errors }, watch } = form
    const deliveryMethod = watch('delivery_method')

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="bg-mont-white p-6 rounded-lg shadow-sm space-y-4">
                <h2 className="font-display text-2xl text-mont-espresso mb-4">
                    Dados de Entrega
                </h2>

                <Input
                    label="Nome completo"
                    {...register('customer_name')}
                    error={errors.customer_name?.message}
                />

                <Input
                    label="Telefone"
                    type="tel"
                    value={phoneValue}
                    {...register('customer_phone', {
                        onChange: onPhoneChange,
                    })}
                    error={errors.customer_phone?.message}
                    placeholder="(11) 99999-9999"
                />

                <div>
                    <label className="block text-mont-gray text-sm mb-2">
                        Método de entrega
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                value="entrega"
                                {...register('delivery_method')}
                                className="text-mont-gold"
                            />
                            <span className="text-mont-espresso">
                                {DELIVERY_CONFIG.SBC_LABEL}
                            </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                value="retirada"
                                {...register('delivery_method')}
                                className="text-mont-gold"
                            />
                            <span className="text-mont-espresso">
                                Retirada no local
                            </span>
                        </label>
                    </div>
                </div>

                <div>
                    <label className="block text-mont-gray text-sm mb-2">
                        Forma de pagamento
                    </label>
                    <div className="space-y-2">
                        {[
                            { id: 'pix', label: 'PIX' },
                            { id: 'dinheiro', label: 'Dinheiro' }
                        ].map(option => (
                            <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value={option.id}
                                    {...register('payment_method')}
                                    className="text-mont-gold"
                                />
                                <span className="text-mont-espresso">
                                    {option.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {deliveryMethod === 'entrega' && (
                    <div className="space-y-3">
                        {/* CEP com máscara e spinner */}
                        <div className="relative">
                            <Input
                                label="CEP"
                                maxLength={9}
                                value={cepDisplayValue}
                                {...register('cep', {
                                    onChange: onCepChange,
                                })}
                                error={errors.cep?.message}
                                placeholder="00000-000"
                            />
                            {loadingCep && (
                                <div className="absolute right-3 top-[42px]">
                                    <Loader2 className="h-4 w-4 animate-spin text-mont-gold" />
                                </div>
                            )}
                        </div>

                        {/* Logradouro — somente leitura, preenchido pelo CEP */}
                        <Input
                            label="Logradouro"
                            readOnly
                            {...register('logradouro')}
                            className="bg-mont-surface cursor-not-allowed opacity-75"
                            placeholder="Preenchido automaticamente"
                        />

                        {/* Número (foco automático após busca) + Complemento */}
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Número"
                                {...register('numero')}
                                error={errors.numero?.message}
                                placeholder="Ex: 123"
                            />
                            <Input
                                label="Complemento"
                                {...register('complemento')}
                                placeholder="Apto, bloco..."
                            />
                        </div>

                        {/* Bairro — somente leitura, preenchido pelo CEP */}
                        <Input
                            label="Bairro"
                            readOnly
                            {...register('bairro')}
                            className="bg-mont-surface cursor-not-allowed opacity-75"
                            placeholder="Preenchido automaticamente"
                        />

                        {/* Cidade + UF — somente leitura, preenchidos pelo CEP */}
                        <div className="grid grid-cols-[1fr_80px] gap-3">
                            <Input
                                label="Cidade"
                                readOnly
                                {...register('cidade')}
                                className="bg-mont-surface cursor-not-allowed opacity-75"
                                placeholder="Preenchida automaticamente"
                            />
                            <Input
                                label="UF"
                                readOnly
                                {...register('uf')}
                                className="bg-mont-surface cursor-not-allowed opacity-75 text-center"
                                placeholder="—"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-sm text-mont-warm-gray mt-1">
                            <span>Problemas com seu endereço?</span>
                            <a
                                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Olá, estou com dificuldade para preencher meu endereço no catálogo Mont.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-mont-gold underline hover:text-mont-espresso transition-colors"
                            >
                                Fale com o suporte
                            </a>
                        </div>

                        <p className="mt-3 text-sm text-[#5C3D2E]">
                            O frete será informado via WhatsApp após o pedido
                        </p>
                    </div>
                )}

                <Input
                    label="Indicado por (opcional)"
                    {...register('referred_by')}
                    placeholder="Nome de quem indicou"
                />

                <div>
                    <label className="block text-mont-gray text-sm mb-2">
                        Observações (opcional)
                    </label>
                    <textarea
                        {...register('notes')}
                        rows={3}
                        className="w-full px-4 py-2 border border-mont-surface rounded-lg focus:outline-none focus:ring-2 focus:ring-mont-gold"
                        placeholder="Alguma observação sobre o pedido?"
                    />
                </div>

                {/* Resumo */}
                <OrderSummary
                    subtotal={subtotalCents}
                    frete={deliveryFeeCents}
                    total={totalCents}
                    deliveryMethod={deliveryMethod}
                    formatCurrency={formatCurrency}
                />

                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isSubmitting}
                    className="w-full"
                >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Enviar pelo WhatsApp
                </Button>
            </form>
        </div>
    )
}
