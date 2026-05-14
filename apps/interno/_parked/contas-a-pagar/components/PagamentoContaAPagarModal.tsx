import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DollarSign, Info } from 'lucide-react'
import { Modal, ModalActions, Button, Input, Select } from '../../ui'
import { useToast } from '../../ui/Toast'
import { useContas } from '../../../hooks/useContas'
import { contasAPagarService } from '../../../services/contasAPagarService'
import { formatCurrency, formatDate } from '@mont/shared'
import { cn } from '@mont/shared'
import type { ContaAPagarWithCategoria } from '../../../services/contasAPagarService'
import type { Database } from '@mont/shared'

type PagamentoRow = Database['public']['Tables']['pagamentos_conta_a_pagar']['Row']

const PAYMENT_METHODS = [
    { value: 'pix', label: 'Pix' },
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'transferencia', label: 'Transferência' },
] as const

const schema = z.object({
    valor: z.number().min(0.01, 'Valor deve ser maior que zero'),
    data_pagamento: z.string().min(1, 'Data é obrigatória'),
    conta_id: z.string().min(1, 'Selecione uma conta'),
    metodo_pagamento: z.string().min(1, 'Selecione um método'),
    observacao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface PagamentoContaAPagarModalProps {
    isOpen: boolean
    onClose: () => void
    conta: ContaAPagarWithCategoria
    onConfirm: (data: {
        contaAPagarId: string
        valor: number
        dataPagamento: string
        contaId: string
        metodoPagamento: string
        observacao?: string
        contaCredorId?: string
    }) => Promise<void>
}

export function PagamentoContaAPagarModal({ isOpen, onClose, conta, onConfirm }: PagamentoContaAPagarModalProps) {
    const toast = useToast()
    const { contas } = useContas()
    const contasAtivas = contas.filter(c => c.ativo !== false)
    const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([])
    const [loadingPagamentos, setLoadingPagamentos] = useState(false)
    const [contaCredorId, setContaCredorId] = useState('')

    const saldoDevedor = conta.saldo_devedor ?? (conta.valor_total - conta.valor_pago)
    const percentualPago = conta.valor_total > 0
        ? Math.round((conta.valor_pago / conta.valor_total) * 100)
        : 0

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            valor: 0,
            data_pagamento: new Date().toISOString().split('T')[0],
            conta_id: '',
            metodo_pagamento: 'pix',
            observacao: '',
        },
    })

    const currentValor = watch('valor')

    // Load pagamentos history
    useEffect(() => {
        if (isOpen && conta.id) {
            setLoadingPagamentos(true)
            contasAPagarService.getPagamentos(conta.id)
                .then(setPagamentos)
                .catch(() => setPagamentos([]))
                .finally(() => setLoadingPagamentos(false))
        }
    }, [isOpen, conta.id])

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            reset({
                valor: saldoDevedor > 0 ? saldoDevedor : 0,
                data_pagamento: new Date().toISOString().split('T')[0],
                conta_id: contasAtivas.length > 0 ? contasAtivas[0].id : '',
                metodo_pagamento: 'pix',
                observacao: '',
            })
            setContaCredorId('')
        }
    }, [isOpen, saldoDevedor, reset, contasAtivas.length])

    const onSubmit = async (data: FormData) => {
        if (data.valor > saldoDevedor + 0.01) {
            toast.error('Valor excede o saldo devedor')
            return
        }
        try {
            await onConfirm({
                contaAPagarId: conta.id,
                valor: data.valor,
                dataPagamento: data.data_pagamento,
                contaId: data.conta_id,
                metodoPagamento: data.metodo_pagamento,
                observacao: data.observacao || undefined,
                contaCredorId: contaCredorId || undefined,
            })
            toast.success('Pagamento registrado!')
            onClose()
        } catch (err) {
            toast.error((err as Error)?.message || 'Erro ao registrar pagamento')
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registrar Pagamento" size="md">
            {/* Header com resumo */}
            <div className="p-4 bg-muted/50 rounded-xl border border-border mb-4 space-y-3">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Credor</p>
                        <p className="font-bold text-foreground">{conta.credor}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-muted-foreground uppercase">Descrição</p>
                        <p className="text-sm text-foreground">{conta.descricao}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Valor Total</p>
                        <p className="font-bold text-foreground">{formatCurrency(conta.valor_total)}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Já Pago</p>
                        <p className="font-bold text-success">{formatCurrency(conta.valor_pago)}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Saldo Devedor</p>
                        <p className="font-bold text-destructive">{formatCurrency(saldoDevedor)}</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{percentualPago}% pago</span>
                        <span>{formatCurrency(saldoDevedor)} restante</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                percentualPago >= 100 ? "bg-success" :
                                percentualPago > 0 ? "bg-primary" : "bg-muted-foreground/20"
                            )}
                            style={{ width: `${Math.min(percentualPago, 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Valor (R$)"
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...register('valor', { valueAsNumber: true })}
                        error={errors.valor?.message}
                    />
                    <Input
                        label="Data"
                        type="date"
                        {...register('data_pagamento')}
                        error={errors.data_pagamento?.message}
                    />
                </div>

                {currentValor > saldoDevedor + 0.01 && (
                    <p className="text-xs text-warning font-medium px-1">
                        Valor excede o saldo devedor de {formatCurrency(saldoDevedor)}
                    </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Conta de Origem"
                        {...register('conta_id')}
                        options={contasAtivas.map(c => ({ value: c.id, label: c.nome }))}
                        placeholder="Selecione..."
                        error={errors.conta_id?.message}
                    />
                    <Select
                        label="Método"
                        {...register('metodo_pagamento')}
                        options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))}
                        error={errors.metodo_pagamento?.message}
                    />
                </div>

                <Input
                    label="Observação"
                    placeholder="Opcional"
                    {...register('observacao')}
                />

                {/* Conta do credor (opcional) */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Creditar conta do credor (opcional)
                        </label>
                        <div className="group relative">
                            <Info className="size-3.5 text-muted-foreground cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 p-2 bg-foreground text-background text-xs rounded-lg shadow-lg z-10">
                                Se o credor possui uma conta no sistema, selecione-a para que o saldo seja atualizado automaticamente.
                            </div>
                        </div>
                    </div>
                    <select
                        value={contaCredorId}
                        onChange={(e) => setContaCredorId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        aria-label="Conta do credor"
                    >
                        <option value="">Nenhuma (pagamento simples)</option>
                        {contasAtivas.map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                    </select>
                </div>

                <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                    <p className="text-xs text-primary font-medium">
                        {contaCredorId
                            ? 'Este pagamento debitará a conta de origem e creditará a conta do credor (transferência).'
                            : 'Este pagamento será registrado automaticamente no Fluxo de Caixa como saída na conta selecionada.'
                        }
                    </p>
                </div>

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={isSubmitting} leftIcon={<DollarSign className="w-4 h-4" />}>
                        Confirmar Pagamento
                    </Button>
                </ModalActions>
            </form>

            {/* Histórico de pagamentos */}
            {pagamentos.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                        Pagamentos Registrados ({pagamentos.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {pagamentos.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-sm py-2 px-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <span>{formatDate(p.data_pagamento)}</span>
                                    <span className="capitalize">{p.metodo_pagamento?.replace('_', ' ')}</span>
                                </div>
                                <span className="font-bold text-foreground">{formatCurrency(p.valor)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {loadingPagamentos && (
                <p className="text-xs text-muted-foreground text-center py-2">Carregando histórico...</p>
            )}
        </Modal>
    )
}
