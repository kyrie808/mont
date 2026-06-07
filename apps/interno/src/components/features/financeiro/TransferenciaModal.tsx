import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRightLeft, Calendar as CalendarIcon, Wallet, Info } from 'lucide-react'
import { Modal, ModalActions, Button } from '../../ui'
import { useContas } from '../../../hooks/useContas'
import { useLancamentos } from '../../../hooks/useLancamentos'
import { useToast } from '../../ui/Toast'
import { cn } from '@mont/shared'
import { formatCurrency } from '@mont/shared'

const transferenciaSchema = z.object({
    valor: z.number().min(0.01, 'O valor deve ser maior que zero'),
    data: z.string().min(1, 'A data é obrigatória'),
    conta_id: z.string().min(1, 'A conta de origem é obrigatória'),
    conta_destino_id: z.string().min(1, 'A conta de destino é obrigatória'),
    descricao: z.string().optional(),
}).refine(data => data.conta_id !== data.conta_destino_id, {
    message: "A conta de destino deve ser diferente da origem",
    path: ["conta_destino_id"]
})

type TransferenciaFormData = z.infer<typeof transferenciaSchema>

interface TransferenciaModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

const inputBase = "flex w-full rounded-xl border border-input bg-background text-foreground ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

export function TransferenciaModal({ isOpen, onClose, onSuccess }: TransferenciaModalProps) {
    const toast = useToast()
    const { contas } = useContas()
    const { createTransferencia } = useLancamentos()
    const [displayValor, setDisplayValor] = useState('')

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<TransferenciaFormData>({
        resolver: zodResolver(transferenciaSchema),
        defaultValues: {
            valor: 0,
            data: new Date().toISOString().split('T')[0],
            conta_id: '',
            conta_destino_id: '',
            descricao: 'Transferência interna',
        },
    })

    // Reset form handled by key in parent

    // Currency Mask Logic
    const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '')
        const numericValue = Number(value) / 100

        setValue('valor', numericValue, { shouldValidate: true })

        if (value === '') {
            setDisplayValor('')
        } else {
            setDisplayValor(formatCurrency(numericValue))
        }
    }

    const onSubmit = async (data: TransferenciaFormData) => {
        try {
            await createTransferencia(data)
            toast.success('Transferência realizada com sucesso!')
            onSuccess?.()
            onClose()
        } catch (error) {
            console.error(error)
            toast.error('Erro ao realizar transferência')
        }
    }

    if (!isOpen) return null

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Transferência entre Contas"
            size="md"
        >
            {/* Faixa neutra (transferência não é entrada nem saída) */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-foreground" />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-xl border border-border mb-2">
                    <div className="w-10 h-10 rounded-lg bg-foreground/10 text-foreground flex items-center justify-center shrink-0">
                        <ArrowRightLeft size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-foreground">
                            Transferência Interna
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            Movimente saldo entre seus caixas/contas
                        </p>
                    </div>
                </div>

                {/* Valor Field with Mask */}
                <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                        Valor da Transferência (R$)
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={displayValor}
                            onChange={handleValorChange}
                            placeholder="R$ 0,00"
                            className={cn(
                                inputBase, "h-14 px-4 py-2 text-2xl font-black",
                                errors.valor && "border-destructive focus-visible:ring-destructive"
                            )}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Wallet className="w-5 h-5 text-muted-foreground/50" />
                        </div>
                    </div>
                    {errors.valor && <p className="mt-1 text-xs text-destructive px-1">{errors.valor.message}</p>}
                </div>

                <div className="space-y-4">
                    {/* Conta Origem Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                            Conta de Origem (Sai de)
                        </label>
                        <select
                            {...register('conta_id')}
                            className={cn(
                                inputBase, "h-12 px-3 py-2 text-sm appearance-none",
                                errors.conta_id && "border-destructive"
                            )}
                        >
                            <option value="">Selecione...</option>
                            {contas.map(conta => (
                                <option key={conta.id} value={conta.id}>{conta.nome}</option>
                            ))}
                        </select>
                        {errors.conta_id && <p className="mt-1 text-xs text-destructive px-1">{errors.conta_id.message}</p>}
                    </div>

                    <div className="flex justify-center -my-2 opacity-50">
                        <ArrowRightLeft className="rotate-90 text-muted-foreground" size={16} />
                    </div>

                    {/* Conta Destino Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                            Conta de Destino (Entra em)
                        </label>
                        <select
                            {...register('conta_destino_id')}
                            className={cn(
                                inputBase, "h-12 px-3 py-2 text-sm appearance-none",
                                errors.conta_destino_id && "border-destructive"
                            )}
                        >
                            <option value="">Selecione...</option>
                            {contas.map(conta => (
                                <option key={conta.id} value={conta.id}>{conta.nome}</option>
                            ))}
                        </select>
                        {errors.conta_destino_id && <p className="mt-1 text-xs text-destructive px-1">{errors.conta_destino_id.message}</p>}
                    </div>
                </div>

                {/* Data Field */}
                <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                        Data da Transferência
                    </label>
                    <div className="relative">
                        <input
                            type="date"
                            {...register('data')}
                            className={cn(
                                inputBase, "h-12 px-3 py-2 text-sm",
                                errors.data && "border-destructive"
                            )}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                    {errors.data && <p className="mt-1 text-xs text-destructive px-1">{errors.data.message}</p>}
                </div>

                {/* Descrição Field */}
                <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                        Descrição (Opcional)
                    </label>
                    <div className="relative">
                        <textarea
                            {...register('descricao')}
                            className={cn(inputBase, "min-h-[60px] px-3 py-2 pl-9 text-sm resize-none")}
                            placeholder="Notas sobre a transferência..."
                        />
                        <div className="absolute left-3 top-3 pointer-events-none">
                            <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                </div>

                <ModalActions>
                    <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                        className="bg-foreground hover:bg-foreground/90 text-background px-8 font-bold"
                    >
                        Realizar Transferência
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
