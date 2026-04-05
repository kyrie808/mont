import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, DollarSign, CreditCard, FileText } from 'lucide-react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { pagamentoSchema, type PagamentoFormData } from '../../../schemas/venda'
import type { DomainPagamento } from '../../../types/domain'
import { Button } from '../../ui/Button'
import { Select } from '../../ui/Select'
import { cn } from '@mont/shared'
import { cashFlowService } from '../../../services/cashFlowService'
import { formatCurrency } from '@mont/shared'
import type { Conta } from '@mont/shared'

interface PaymentSidebarProps {
    onBack: () => void
    onConfirm: (data: PagamentoFormData) => Promise<boolean>
    vendaId: string
    total: number
    valorPago: number
    historico: DomainPagamento[]
}

const PAYMENT_METHODS = [
    { value: 'pix', label: 'Pix', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { value: 'dinheiro', label: 'Dinheiro', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { value: 'cartao', label: 'Cart�o', icon: CreditCard, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { value: 'fiado', label: 'Fiado', icon: CalendarIcon, color: 'text-orange-500', bg: 'bg-orange-500/10' },
]

export function PaymentSidebar({
    onBack,
    onConfirm,
    vendaId,
    total,
    valorPago,
    historico,
}: PaymentSidebarProps) {
    const restante = Math.max(0, total - valorPago)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [contas, setContas] = useState<Conta[]>([])

    const formatDateTimeLocal = (isoString: string) => {
        const date = new Date(isoString)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isValid }
    } = useForm<PagamentoFormData>({
        mode: 'onChange',
        resolver: zodResolver(pagamentoSchema) as any,
        defaultValues: {
            venda_id: vendaId,
            valor: restante,
            data: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T').slice(0, 16),
            metodo: 'pix' as const,
            conta_id: '',
            observacao: ''
        }
    })

    const currentData = watch('data')
    const currentMethod = watch('metodo')

    useEffect(() => {
        const now = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T').slice(0, 16)
        reset({
            venda_id: vendaId,
            valor: restante,
            data: now,
            metodo: 'pix',
            conta_id: contas[0]?.id || '',
            observacao: ''
        })
    }, [vendaId, restante, reset, contas])

    useEffect(() => {
        const fetchContas = async () => {
            const data = await cashFlowService.getContas()
            setContas(data)
            if (data.length > 0) {
                setValue('conta_id', data[0].id)
            }
        }
        fetchContas()
    }, [setValue])

    const handleConfirm: SubmitHandler<PagamentoFormData> = async (data) => {
        setIsSubmitting(true)
        try {
            const success = await onConfirm(data)
            if (success) {
                onBack()
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(handleConfirm)} className="p-4 space-y-6">
            {/* Summary Card */}
            <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted p-3 rounded-lg border border-border">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Total</span>
                        <span className="font-semibold text-sm text-foreground">
                            {formatCurrency(total)}
                        </span>
                    </div>
                    <div className="bg-success/10 p-3 rounded-lg border border-success/20">
                        <span className="text-[10px] font-bold text-success uppercase block mb-1">Pago</span>
                        <span className="font-semibold text-sm text-success">
                            {formatCurrency(valorPago)}
                        </span>
                    </div>
                    <div className={cn(
                        "p-3 rounded-lg border",
                        restante > 0
                            ? "bg-destructive/10 border-destructive/20"
                            : "bg-success/10 border-success/20"
                    )}>
                        <span className={cn(
                            "text-[10px] font-bold uppercase block mb-1",
                            restante > 0 ? "text-destructive" : "text-success"
                        )}>Saldo</span>
                        <span className={cn(
                            "font-bold text-sm",
                            restante > 0 ? "text-destructive" : "text-success"
                        )}>
                            {formatCurrency(restante)}
                        </span>
                    </div>
                </div>
                {valorPago > 0 && restante > 0 && (
                    <div className="px-3 py-2 bg-warning/10 rounded-lg border border-warning/20">
                        <p className="text-[11px] font-bold text-warning">
                            Pagamento parcial recebido. Faltam {formatCurrency(restante)}
                        </p>
                    </div>
                )}
            </div>

            {/* Valor Input */}
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Valor do Pagamento
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                    <input
                        type="number"
                        step="0.01"
                        {...register('valor', { valueAsNumber: true })}
                        className="w-full pl-10 pr-4 py-3 bg-card border border-input rounded-xl focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all text-lg font-semibold"
                        placeholder="0,00"
                    />
                </div>
                {errors.valor && <p className="text-destructive text-xs mt-1">{errors.valor.message}</p>}
            </div>

            {/* Metodo Buttons */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">
                    Forma de Pagamento
                </label>
                <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon
                        const isSelected = currentMethod === method.value
                        return (
                            <button
                                key={method.value}
                                type="button"
                                onClick={() => setValue('metodo', method.value as PagamentoFormData['metodo'])}
                                className={cn(
                                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5",
                                    isSelected
                                        ? cn("border-primary ring-1 ring-primary/20", method.bg, method.color)
                                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                                )}
                                aria-label={`Pagamento via ${method.label}`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{method.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Conta, Data & Observacao */}
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-1 block">
                        Conta de Destino
                    </label>
                    <Select
                        {...register('conta_id')}
                        options={contas.map(ct => ({ value: ct.id, label: ct.nome }))}
                        error={errors.conta_id?.message}
                        placeholder="Selecione a conta..."
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Data</label>
                    <input
                        type="datetime-local"
                        value={formatDateTimeLocal(currentData || new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T'))}
                        onChange={(e) => setValue('data', e.target.value)}
                        className={cn(
                            "w-full px-3 py-2 bg-muted border rounded-lg text-sm outline-none transition-all",
                            errors.data ? "border-destructive focus:ring-destructive/20" : "border-input focus:ring-ring"
                        )}
                    />
                    {errors.data && (
                        <p className="text-destructive text-[10px] mt-1 ml-1 font-medium italic">
                            {errors.data.message}
                        </p>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Observa��o (Opcional)</label>
                    <textarea
                        {...register('observacao')}
                        rows={2}
                        placeholder="Ex: Enviado para conta Nubank..."
                        className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm resize-none focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all"
                    />
                </div>
            </div>

            {/* History Section */}
            {historico.length > 0 && (
                <div className="pt-2 border-t border-border">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Hist�rico de Pagamentos</h3>
                    <div className="space-y-2">
                        {historico.map((pag) => (
                            <div key={pag.id} className="flex items-start justify-between p-2.5 bg-muted rounded-lg border border-border">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">
                                            {formatCurrency(pag.valor)}
                                        </span>
                                        <span className="px-1.5 py-0.5 text-[10px] bg-muted-foreground/10 rounded-md text-muted-foreground capitalize">
                                            {pag.metodo}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {format(new Date(pag.data), "dd 'de' MMM '�s' HH:mm", { locale: ptBR })}
                                    </p>
                                    {pag.observacao && (
                                        <p className="text-xs text-muted-foreground mt-1 italic">"{pag.observacao}"</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Submit Button � sticky to bottom of scroll container */}
            <div className="sticky bottom-0 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-card -mx-4 px-4 border-t border-border">
                <Button
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    className="w-full py-6 text-lg font-bold uppercase tracking-tight"
                >
                    {isSubmitting ? 'Processando...' : 'Confirmar Pagamento'}
                </Button>
            </div>
        </form>
    )
}
