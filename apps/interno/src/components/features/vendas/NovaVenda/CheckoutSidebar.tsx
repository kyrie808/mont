import { useState, useEffect } from 'react'
import { ShoppingCart, Calendar, Gift, Truck, ChevronRight, Store } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format } from 'date-fns'
import { vendaSchema, type VendaFormData } from '../../../../schemas/venda'
import { useEntregadores } from '../../../../hooks/useEntregadores'
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

// Intenção da venda (a forma REAL — pix/dinheiro/cartão — é informada no Quitar).
const SALE_TYPES = [
    { id: 'venda', label: 'Venda', icon: ShoppingCart },
    { id: 'fiado', label: 'Fiado', icon: Calendar },
    { id: 'brinde', label: 'Brinde', icon: Gift },
] as const

export function CheckoutSidebar({
    onBack,
    onConfirm,
    total,
    contatoId,
    contatoNome,
    items
}: CheckoutSidebarProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    // Retirada (default) x Entrega. Só na Entrega atribuímos um entregador — a venda
    // cai no app dele. Retirada mantém entregador_id nulo (não vai pra ninguém).
    const [tipoEntrega, setTipoEntrega] = useState<'retirada' | 'entrega'>('retirada')
    const { entregadores } = useEntregadores()

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
            forma_pagamento: 'venda',
            taxa_entrega: 0,
            parcelas: 1,
            itens: items,
            observacoes: '',
            data_prevista_pagamento: null,
            entregador_id: null,
            observacao_entregador: '',
            dinheiro_na_entrega: false
        }
    })

    const formaPagamento = watch('forma_pagamento')
    const entregadorId = watch('entregador_id')
    const dinheiroNaEntrega = watch('dinheiro_na_entrega')
    const taxaEntregaValue = watch('taxa_entrega') || 0
    const totalGeral = total + taxaEntregaValue

    useEffect(() => {
        setTipoEntrega('retirada')
        reset({
            contato_id: contatoId,
            data: format(new Date(), 'yyyy-MM-dd'),
            forma_pagamento: 'venda',
            taxa_entrega: 0,
            parcelas: 1,
            itens: items,
            observacoes: '',
            data_prevista_pagamento: null,
            entregador_id: null,
            observacao_entregador: '',
            dinheiro_na_entrega: false
        })
    }, [contatoId, items, reset])

    // Alternar Retirada/Entrega. Retirada zera a atribuição e a nota do entregador.
    const handleTipoEntrega = (tipo: 'retirada' | 'entrega') => {
        setTipoEntrega(tipo)
        if (tipo === 'retirada') {
            setValue('taxa_entrega', 0)
            setValue('entregador_id', null)
            setValue('observacao_entregador', '')
            setValue('dinheiro_na_entrega', false)
        }
    }

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

                {/* Tipo de Venda (intenção) */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                        Tipo de Venda
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {SALE_TYPES.map((type) => {
                            const Icon = type.icon
                            const isSelected = formaPagamento === type.id
                            return (
                                <button
                                    key={type.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setValue('forma_pagamento', type.id as VendaFormData['forma_pagamento'])}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                        isSelected
                                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{type.label}</span>
                                </button>
                            )
                        })}
                    </div>
                    <p className="text-[11px] text-muted-foreground italic">
                        A forma de pagamento (PIX, dinheiro, cartão) é informada ao quitar a venda.
                    </p>
                </div>

                {/* Fiado: data de vencimento */}
                {formaPagamento === 'fiado' && (
                    <div className="space-y-4 p-4 bg-warning-strong/10 rounded-xl border border-warning-strong/30 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div>
                            <label className="text-sm font-medium text-warning-strong block mb-1.5">
                                Data de Vencimento
                            </label>
                            <input
                                type="date"
                                {...register('data_prevista_pagamento')}
                                className={cn(
                                    "w-full px-3 py-2 bg-background text-foreground border rounded-lg outline-hidden focus-visible:ring-2",
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

                {/* Método de entrega: Retirada x Entrega (atribui entregador) */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                        Entrega
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { id: 'retirada', label: 'Retirada', icon: Store },
                            { id: 'entrega', label: 'Entrega', icon: Truck },
                        ] as const).map((opt) => {
                            const Icon = opt.icon
                            const isSelected = tipoEntrega === opt.id
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => handleTipoEntrega(opt.id)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                        isSelected
                                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{opt.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    {tipoEntrega === 'entrega' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Frete — só faz sentido na entrega (retirada = R$0). */}
                            <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl border border-border">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Truck className="w-5 h-5" />
                                    <span className="text-sm font-medium">Frete</span>
                                </div>
                                <div className="relative w-28">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                    <input
                                        type="number"
                                        step="0.50"
                                        min="0"
                                        {...register('taxa_entrega', { valueAsNumber: true })}
                                        className={cn(
                                            "w-full pl-9 pr-2 py-2 bg-background text-foreground border rounded-lg text-sm font-bold text-right outline-hidden focus-visible:ring-2 focus-visible:ring-ring tabular-nums",
                                            taxaEntregaValue > 0 ? "border-primary/40 text-primary" : "border-border"
                                        )}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                                    Entregador
                                </label>
                                <select
                                    value={entregadorId ?? ''}
                                    onChange={(e) => setValue('entregador_id', e.target.value || null)}
                                    className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring text-sm"
                                >
                                    <option value="">Selecione o entregador…</option>
                                    {entregadores.map((ent) => (
                                        <option key={ent.id} value={ent.id}>{ent.nome}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                                    Observação para o entregador
                                </label>
                                <textarea
                                    {...register('observacao_entregador')}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring resize-none text-sm placeholder:text-muted-foreground/60"
                                    placeholder="Ex: Aguardar confirmação de pagamento para entregar."
                                />
                            </div>
                            {/* Pagamento em dinheiro na entrega: só aqui o entregador vê "receber R$ X". */}
                            <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-lg border border-border bg-background px-3 py-2.5">
                                <input
                                    type="checkbox"
                                    checked={!!dinheiroNaEntrega}
                                    onChange={(e) => setValue('dinheiro_na_entrega', e.target.checked)}
                                    className="h-4 w-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                                />
                                <span className="text-sm text-foreground">Pagamento em dinheiro na entrega</span>
                            </label>
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
                        className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring resize-none text-sm placeholder:text-muted-foreground/60"
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
                        className="h-14 px-5 rounded-2xl border border-border bg-background text-foreground font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
