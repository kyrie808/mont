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
    { id: 'pix', label: 'Pix', icon: FileText },
    { id: 'dinheiro', label: 'Dinheiro', icon: DollarSign },
    { id: 'cartao', label: 'Cartão', icon: CreditCard },
    { id: 'fiado', label: 'Fiado', icon: Calendar },
    { id: 'brinde', label: 'Brinde', icon: Gift },
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
        <div className="flex flex-col h-full bg-card border-l border-border shadow-elevated overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center gap-3 bg-muted/50">
                <h2 className="font-semibold text-foreground">Finalizar Venda</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Header Info */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
                    <div>
                        <span className="text-xs text-muted-foreground block mb-0.5">Cliente</span>
                        <span className="font-semibold text-foreground">{contatoNome}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-muted-foreground block mb-0.5">Itens</span>
                        <span className="font-semibold text-foreground tabular-nums">{items.length}</span>
                    </div>
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
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
                                    aria-pressed={isSelected}
                                    onClick={() => setValue('forma_pagamento', method.id as VendaFormData['forma_pagamento'])}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                        isSelected
                                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted"
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
                        <div className="p-4 bg-success/10 rounded-xl border border-success/30 space-y-3">
                            <label className="text-sm font-medium text-success block">
                                Calculadora de Troco
                            </label>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs text-success/80 mb-1 block">Valor Recebido</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-success font-medium">R$</span>
                                        <input
                                            type="number"
                                            value={valorRecebido}
                                            onChange={(e) => setValorRecebido(e.target.value ? Number(e.target.value) : '')}
                                            className="w-full pl-9 pr-4 py-2.5 bg-background text-foreground border border-success/30 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-success"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                                <div className="py-2.5 px-4 bg-success/10 rounded-lg border border-success/20">
                                    <span className="text-xs text-success/80 mb-1 block">Troco</span>
                                    <span className={cn("text-lg font-bold tabular-nums", troco >= 0 ? "text-success" : "text-destructive")}>
                                        {troco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {formaPagamento === 'fiado' && (
                        <div className="space-y-4 p-4 bg-warning-strong/10 rounded-xl border border-warning-strong/30">
                            <div>
                                <label className="text-sm font-medium text-warning-strong block mb-1.5">
                                    Data de Vencimento
                                </label>
                                <input
                                    type="date"
                                    {...register('data_prevista_pagamento')}
                                    className={cn(
                                        "w-full px-3 py-2 bg-background text-foreground border rounded-lg outline-none focus-visible:ring-2",
                                        errors.data_prevista_pagamento
                                            ? "border-destructive focus-visible:ring-destructive"
                                            : "border-warning-strong/30 focus-visible:ring-warning-strong"
                                    )}
                                />
                                {errors.data_prevista_pagamento && (
                                    <span className="text-[10px] text-destructive mt-1 font-bold">
                                        {errors.data_prevista_pagamento.message}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center text-[10px] text-warning-strong italic">
                                <ChevronRight className="w-3 h-3 mr-1 shrink-0 px-0" />
                                Alertas financeiros automáticos
                            </div>
                        </div>
                    )}

                    {formaPagamento === 'cartao' && (
                        <div className="p-4 bg-primary/10 rounded-xl border border-primary/30 space-y-3">
                            <div>
                                <label className="text-sm font-medium text-primary block mb-1.5">
                                    Parcelas
                                </label>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        aria-label="Diminuir parcelas"
                                        onClick={() => setValue('parcelas', Math.max(1, numParcelas - 1))}
                                        className="p-1 px-3 bg-background text-foreground border border-primary/30 rounded-lg"
                                    >-</button>
                                    <span className="font-bold text-lg min-w-[20px] text-center text-foreground tabular-nums">{numParcelas}x</span>
                                    <button
                                        type="button"
                                        aria-label="Aumentar parcelas"
                                        onClick={() => setValue('parcelas', Math.min(12, numParcelas + 1))}
                                        className="p-1 px-3 bg-background text-foreground border border-primary/30 rounded-lg"
                                    >+</button>
                                </div>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-xs text-primary/80">Valor da Parcela</span>
                                <span className="font-bold text-lg text-primary tabular-nums">
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
                        className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-xl border border-border text-sm"
                    >
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Truck className="w-5 h-5" />
                            <span>Taxa de Entrega</span>
                        </div>
                        <span className={cn(
                            "font-bold tabular-nums",
                            taxaEntregaValue > 0 ? "text-primary" : "text-muted-foreground"
                        )}>
                            {taxaEntregaValue > 0 ? `+ ${taxaEntregaValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Adicionar'}
                        </span>
                    </button>

                    {showTaxaEntrega && (
                        <div className="p-4 bg-muted/50 rounded-xl border border-border animate-in slide-in-from-top-1 duration-200">
                            <input
                                type="number"
                                step="0.50"
                                {...register('taxa_entrega', { valueAsNumber: true })}
                                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-lg font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums"
                                placeholder="0,00"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Observações
                    </label>
                    <textarea
                        {...register('observacoes')}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none text-sm placeholder:text-muted-foreground/60"
                        placeholder="Ex: Deixar na portaria…"
                    />
                </div>
            </form>

            {/* Summary & Action (Fixed at bottom) */}
            <div className="p-4 border-t border-border bg-card space-y-4 pb-10 md:pb-6">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Total a Pagar</span>
                    <span className="text-2xl font-black text-foreground tabular-nums">
                        {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="h-14 px-5 rounded-2xl border border-border bg-background text-foreground font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <ChevronRight className="h-5 w-5 rotate-180" />
                        Voltar
                    </button>
                    <Button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="flex-1 py-6 text-lg font-black uppercase tracking-tight shadow-elevated shadow-primary/20"
                    >
                        {isSubmitting ? 'Processando...' : 'CONFIRMAR VENDA'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
