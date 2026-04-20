import { useState, useEffect } from 'react'
import { Calendar, DollarSign, CreditCard, FileText, Gift, Truck, ChevronRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format } from 'date-fns'
import { vendaSchema, type VendaFormData } from '../../../../schemas/venda'
import { Button } from '../../../ui/Button'
import { cn } from '@mont/shared'

interface CheckoutSidebarProps {
    onBack: () => void
    onConfirm: (data: VendaFormData) => Promise<void>
    total: number
    contatoId: string
    contatoNome: string
    items: VendaFormData['itens']
}

const PAYMENT_METHODS = [
    { id: 'pix', label: 'Pix', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'dinheiro', label: 'Dinheiro', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { id: 'cartao', label: 'Cartão', icon: CreditCard, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { id: 'fiado', label: 'Fiado', icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { id: 'brinde', label: 'Brinde', icon: Gift, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20' },
]

export function CheckoutSidebar({
    onBack,
    onConfirm,
    total,
    contatoId,
    contatoNome,
    items
}: CheckoutSidebarProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showTaxaEntrega, setShowTaxaEntrega] = useState(false)
    const [valorRecebido, setValorRecebido] = useState<number | ''>('')

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors }
    } = useForm<VendaFormData>({
        resolver: zodResolver(vendaSchema) as any,
        defaultValues: {
            contato_id: contatoId,
            data: format(new Date(), 'yyyy-MM-dd'),
            forma_pagamento: 'pix',
            taxa_entrega: 0,
            parcelas: 1,
            itens: items,
            observacoes: '',
            data_prevista_pagamento: null
        }
    })

    const formaPagamento = watch('forma_pagamento')
    const taxaEntregaValue = watch('taxa_entrega') || 0
    const numParcelas = watch('parcelas') || 1
    const totalGeral = total + taxaEntregaValue

    useEffect(() => {
        reset({
            contato_id: contatoId,
            data: format(new Date(), 'yyyy-MM-dd'),
            forma_pagamento: 'pix',
            taxa_entrega: 0,
            parcelas: 1,
            itens: items,
            observacoes: '',
            data_prevista_pagamento: null
        })
    }, [contatoId, items, reset])

    // Update data_prevista_pagamento automatically for Fiado
    useEffect(() => {
        if (formaPagamento === 'fiado') {
            setValue('data_prevista_pagamento', addDays(new Date(), 30).toISOString())
        } else {
            setValue('data_prevista_pagamento', null)
        }
    }, [formaPagamento, setValue])

    const onSubmit = async (data: VendaFormData) => {
        try {
            setIsSubmitting(true)
            await onConfirm(data)
        } catch (error) {
            console.error('Erro ao finalizar venda:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const troco = typeof valorRecebido === 'number' ? valorRecebido - totalGeral : 0

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Finalizar Venda</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Header Info */}
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                        <span className="text-xs text-zinc-500 block mb-0.5">Cliente</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{contatoNome}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-zinc-500 block mb-0.5">Itens</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{items.length}</span>
                    </div>
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Forma de Pagamento
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map((method) => {
                            const Icon = method.icon
                            const isSelected = formaPagamento === method.id
                            return (
                                <button
                                    key={method.id}
                                    type="button"
                                    onClick={() => setValue('forma_pagamento', method.id as VendaFormData['forma_pagamento'])}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5",
                                        isSelected
                                            ? cn("border-primary-500 ring-1 ring-primary-500/20", method.bg, method.color)
                                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{method.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Conditional Inputs */}
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {formaPagamento === 'dinheiro' && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30 space-y-3">
                            <label className="text-sm font-medium text-emerald-800 dark:text-emerald-400 block">
                                Calculadora de Troco
                            </label>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs text-emerald-600 dark:text-emerald-500 mb-1 block">Valor Recebido</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-medium">R$</span>
                                        <input
                                            type="number"
                                            value={valorRecebido}
                                            onChange={(e) => setValorRecebido(e.target.value ? Number(e.target.value) : '')}
                                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                                <div className="py-2.5 px-4 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                                    <span className="text-xs text-emerald-600 dark:text-emerald-500 mb-1 block">Troco</span>
                                    <span className={cn("text-lg font-bold", troco >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600")}>
                                        {troco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {formaPagamento === 'fiado' && (
                        <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                            <div>
                                <label className="text-sm font-medium text-orange-800 dark:text-orange-400 block mb-1.5">
                                    Data de Vencimento
                                </label>
                                <input
                                    type="date"
                                    {...register('data_prevista_pagamento')}
                                    className={cn(
                                        "w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-lg outline-none",
                                        errors.data_prevista_pagamento
                                            ? "border-red-500 focus:ring-red-500"
                                            : "border-orange-200 dark:border-orange-800"
                                    )}
                                />
                                {errors.data_prevista_pagamento && (
                                    <span className="text-[10px] text-red-500 mt-1 font-bold">
                                        {errors.data_prevista_pagamento.message}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center text-[10px] text-orange-700 dark:text-orange-500 italic">
                                <ChevronRight className="w-3 h-3 mr-1 shrink-0 px-0" />
                                Alertas financeiros automáticos
                            </div>
                        </div>
                    )}

                    {formaPagamento === 'cartao' && (
                        <div className="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-xl border border-violet-100 dark:border-violet-900/30 space-y-3">
                            <div>
                                <label className="text-sm font-medium text-violet-800 dark:text-violet-400 block mb-1.5">
                                    Parcelas
                                </label>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setValue('parcelas', Math.max(1, numParcelas - 1))}
                                        className="p-1 px-3 bg-white dark:bg-zinc-800 border border-violet-200 dark:border-violet-800 rounded-lg"
                                    >-</button>
                                    <span className="font-bold text-lg min-w-[20px] text-center">{numParcelas}x</span>
                                    <button
                                        type="button"
                                        onClick={() => setValue('parcelas', Math.min(12, numParcelas + 1))}
                                        className="p-1 px-3 bg-white dark:bg-zinc-800 border border-violet-200 dark:border-violet-800 rounded-lg"
                                    >+</button>
                                </div>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-xs text-violet-600">Valor da Parcela</span>
                                <span className="font-bold text-lg text-violet-700 dark:text-violet-400">
                                    {numParcelas > 0 ? (totalGeral / numParcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Taxa de Entrega Toggle */}
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => setShowTaxaEntrega(!showTaxaEntrega)}
                        className="flex items-center justify-between w-full p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm"
                    >
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                            <Truck className="w-5 h-5" />
                            <span>Taxa de Entrega</span>
                        </div>
                        <span className={cn(
                            "font-bold",
                            taxaEntregaValue > 0 ? "text-primary-600" : "text-zinc-400"
                        )}>
                            {taxaEntregaValue > 0 ? `+ ${taxaEntregaValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Adicionar'}
                        </span>
                    </button>

                    {showTaxaEntrega && (
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-1 duration-200">
                            <input
                                type="number"
                                step="0.50"
                                {...register('taxa_entrega', { valueAsNumber: true })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-lg font-bold outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="0,00"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Observações
                    </label>
                    <textarea
                        {...register('observacoes')}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm"
                        placeholder="Ex: Deixar na portaria..."
                    />
                </div>
            </form>

            {/* Summary & Action (Fixed at bottom) */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4 pb-10 md:pb-6">
                <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Total a Pagar</span>
                    <span className="text-2xl font-black text-gray-900 dark:text-white">
                        {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="h-14 px-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <ChevronRight className="h-5 w-5 rotate-180" />
                        Voltar
                    </button>
                    <Button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="flex-1 py-6 text-lg font-black uppercase tracking-tight shadow-xl shadow-primary-500/20"
                    >
                        {isSubmitting ? 'Processando...' : 'CONFIRMAR VENDA'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
