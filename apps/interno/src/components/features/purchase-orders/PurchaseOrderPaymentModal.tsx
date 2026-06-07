import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, DollarSign } from 'lucide-react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatCurrency } from '@mont/shared'
import type { DomainPurchaseOrderWithItems } from '../../../types/domain'
import { cashFlowService } from '../../../services/cashFlowService'
import type { Conta } from '@mont/shared'

// Schema similar to sales payment but for purchase orders
const paymentSchema = z.object({
    amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
    payment_method: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia']),
    payment_date: z.string(),
    conta_id: z.string().uuid('Selecione uma conta de origem'),
    notes: z.string().optional()
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface PurchaseOrderPaymentModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (data: PaymentFormData) => Promise<void>
    order: DomainPurchaseOrderWithItems
}

const PAYMENT_METHODS = [
    { value: 'pix', label: 'Pix' },
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'cartao_credito', label: 'Cartão de Crédito' },
    { value: 'cartao_debito', label: 'Cartão de Débito' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'transferencia', label: 'Transferência' }
] as const

export function PurchaseOrderPaymentModal({ isOpen, onClose, onConfirm, order }: PurchaseOrderPaymentModalProps) {
    const remainingAmount = order.totalAmount - (order.amountPaid || 0)
    const [contas, setContas] = useState<Conta[]>([])

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<PaymentFormData>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            amount: 0,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'pix',
            conta_id: '',
            notes: ''
        }
    })

    // eslint-disable-next-line react-hooks/incompatible-library
    const currentAmount = watch('amount')

    // Load accounts
    useEffect(() => {
        async function loadContas() {
            try {
                const data = await cashFlowService.getContas()
                setContas(data.filter((c: Conta) => c.ativo !== false))
            } catch (err) {
                console.error('Erro ao carregar contas:', err)
            }
        }
        if (isOpen) {
            loadContas()
        }
    }, [isOpen])

    // Reset form when opening or accounts loaded
    useEffect(() => {
        if (isOpen && order) {
            reset({
                amount: remainingAmount > 0 ? remainingAmount : 0,
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: 'pix',
                conta_id: contas.length > 0 ? contas[0].id : '',
                notes: ''
            })
        }
    }, [isOpen, order, remainingAmount, reset, contas])

    const handleConfirm: SubmitHandler<PaymentFormData> = async (data) => {
        await onConfirm(data)
        onClose()
    }

    if (!isOpen) return null

    const inputBase = "w-full p-2 bg-background text-foreground border border-input rounded-lg outline-none focus:ring-2 focus:ring-ring"

    const modalContent = (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
                <div className="pointer-events-auto bg-card rounded-lg w-full max-w-md shadow-elevated animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-primary" />
                                Registrar Pagamento
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Pedido #{order.id.slice(0, 8)}
                            </p>
                        </div>
                        <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 bg-muted border-b border-border">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-muted-foreground">Total do Pedido:</span>
                            <span className="font-medium text-foreground tabular-nums">{formatCurrency(order.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-muted-foreground">Já Pago:</span>
                            <span className="font-medium text-success tabular-nums">{formatCurrency(order.amountPaid || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                            <span className="text-sm font-bold text-foreground">Restante:</span>
                            <span className="font-bold text-primary tabular-nums">{formatCurrency(remainingAmount)}</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(handleConfirm)} className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                    Data
                                </label>
                                <input
                                    type="date"
                                    {...register('payment_date')}
                                    className={inputBase}
                                />
                                {errors.payment_date && (
                                    <span className="text-xs text-destructive">{errors.payment_date.message}</span>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                    Método
                                </label>
                                <select
                                    {...register('payment_method')}
                                    className={inputBase}
                                >
                                    {PAYMENT_METHODS.map(method => (
                                        <option key={method.value} value={method.value}>
                                            {method.label}
                                        </option>
                                    ))}
                                </select>
                                {errors.payment_method && (
                                    <span className="text-xs text-destructive">{errors.payment_method.message}</span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Conta de Origem
                            </label>
                            <select
                                {...register('conta_id')}
                                className={inputBase}
                            >
                                <option value="">Selecione uma conta...</option>
                                {contas.map(ct => (
                                    <option key={ct.id} value={ct.id}>
                                        {ct.nome}
                                    </option>
                                ))}
                            </select>
                            {errors.conta_id && (
                                <span className="text-xs text-destructive">{errors.conta_id.message}</span>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Valor Pago (R$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    {...register('amount', { valueAsNumber: true })}
                                    className={`${inputBase} pl-8 font-medium text-lg tabular-nums`}
                                />
                            </div>
                            {errors.amount && (
                                <span className="text-xs text-destructive">{errors.amount.message}</span>
                            )}
                            {currentAmount > remainingAmount + 0.01 && (
                                <p className="text-xs text-warning-strong mt-1">
                                    ⚠️ Atenção: Valor maior que o restante.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Observação
                            </label>
                            <textarea
                                {...register('notes')}
                                className={inputBase}
                                rows={2}
                                placeholder="Ex: Confirmação de transferência…"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                            >
                                <DollarSign className="w-4 h-4" />
                                {isSubmitting ? 'Salvando...' : 'Confirmar Pagamento'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )

    return createPortal(modalContent, document.body)
}
