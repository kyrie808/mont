import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowUpRight, ArrowDownLeft, Calendar as CalendarIcon, Wallet, Tag, Info } from 'lucide-react'
import { Modal, ModalActions, Button } from '../../ui'
import { useContas } from '../../../hooks/useContas'
import { usePlanoDeContas } from '../../../hooks/usePlanoDeContas'
import { useLancamentos } from '../../../hooks/useLancamentos'
import { useToast } from '../../ui/Toast'
import { cn } from '@mont/shared'
import { formatCurrency } from '@mont/shared'

const lancamentoSchema = z.object({
    valor: z.number().min(0.01, 'O valor deve ser maior que zero'),
    data: z.string().min(1, 'A data é obrigatória'),
    conta_id: z.string().min(1, 'A conta é obrigatória'),
    plano_conta_id: z.string().min(1, 'A categoria é obrigatória'),
    descricao: z.string().optional(),
})

type LancamentoFormData = z.infer<typeof lancamentoSchema>

interface LancamentoModalProps {
    type: 'entrada' | 'saida'
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

export function LancamentoModal({ type, isOpen, onClose, onSuccess }: LancamentoModalProps) {
    const toast = useToast()
    const { contas } = useContas()
    const { planoContas } = usePlanoDeContas()
    const { registrarDespesaManual, registrarEntradaManual } = useLancamentos()
    const [displayValor, setDisplayValor] = useState('')

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<LancamentoFormData>({
        resolver: zodResolver(lancamentoSchema),
        defaultValues: {
            valor: 0,
            data: new Date().toISOString().split('T')[0],
            conta_id: '',
            plano_conta_id: '',
            descricao: '',
        },
    })

    // Reset form handled by key in parent

    // Filter categories based on type
    const filteredCategorias = planoContas.filter((c) => c.tipo === (type === 'entrada' ? 'receita' : 'despesa'))

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

    const onSubmit = async (data: LancamentoFormData) => {
        try {
            const payload = { ...data, descricao: data.descricao || null }
            if (type === 'saida') {
                await registrarDespesaManual(payload)
            } else {
                await registrarEntradaManual(payload)
            }
            toast.success(`${type === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`)
            onSuccess?.()
            onClose()
        } catch (error) {
            const msg = (error as { message?: string })?.message ?? 'Erro ao registrar lançamento'
            toast.error(msg)
        }
    }

    if (!isOpen) return null

    const isEntrada = type === 'entrada'

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEntrada ? 'Novo Recebimento' : 'Novo Pagamento'}
            size="md"
        >
            {/* Styled Header Overwrite (Visual Rule) */}
            <div className={cn(
                "absolute top-0 left-0 right-0 h-1.5",
                isEntrada ? "bg-emerald-500" : "bg-red-500"
            )} />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                    <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        isEntrada ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                    )}>
                        {isEntrada ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800">
                            {isEntrada ? 'Entrada Manual' : 'Saída Manual'}
                        </h4>
                        <p className="text-xs text-slate-500">
                            Preencha os dados do lançamento abaixo
                        </p>
                    </div>
                </div>

                {/* Valor Field with Mask */}
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                        Valor (R$)
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={displayValor}
                            onChange={handleValorChange}
                            placeholder="R$ 0,00"
                            className={cn(
                                "flex h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-2xl font-black text-slate-900 ring-offset-white placeholder:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                errors.valor && "border-red-500 focus-visible:ring-red-500"
                            )}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Wallet className="w-5 h-5 text-slate-300" />
                        </div>
                    </div>
                    {errors.valor && <p className="mt-1 text-xs text-red-500 px-1">{errors.valor.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Data Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                            Data
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                {...register('data')}
                                className={cn(
                                    "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                                    errors.data && "border-red-500 px-1"
                                )}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                        {errors.data && <p className="mt-1 text-xs text-red-500 px-1">{errors.data.message}</p>}
                    </div>

                    {/* Conta Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                            Conta
                        </label>
                        <select
                            {...register('conta_id')}
                            className={cn(
                                "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 appearance-none",
                                errors.conta_id && "border-red-500"
                            )}
                        >
                            <option value="">Selecione...</option>
                            {contas.map(conta => (
                                <option key={conta.id} value={conta.id}>{conta.nome}</option>
                            ))}
                        </select>
                        {errors.conta_id && <p className="mt-1 text-xs text-red-500 px-1">{errors.conta_id.message}</p>}
                    </div>
                </div>

                {/* Categoria Field */}
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                        Categoria
                    </label>
                    <div className="relative">
                        <select
                            {...register('plano_conta_id')}
                            className={cn(
                                "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pl-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 appearance-none",
                                errors.plano_conta_id && "border-red-500"
                            )}
                        >
                            <option value="">Selecione uma categoria...</option>
                            {filteredCategorias.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.nome}</option>
                            ))}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Tag className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>
                    {errors.plano_conta_id && <p className="mt-1 text-xs text-red-500 px-1">{errors.plano_conta_id.message}</p>}
                </div>

                {/* Descrição Field */}
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                        Descrição (Opcional)
                    </label>
                    <div className="relative">
                        <textarea
                            {...register('descricao')}
                            className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pl-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 resize-none"
                            placeholder="Adicione detalhes sobre este lançamento..."
                        />
                        <div className="absolute left-3 top-3 pointer-events-none">
                            <Info className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>
                </div>

                <ModalActions>
                    <Button type="button" variant="ghost" onClick={onClose} className="text-slate-500">
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                        className={cn(
                            "px-8 font-bold",
                            isEntrada ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                        )}
                    >
                        {isEntrada ? 'Registrar Entrada' : 'Registrar Saída'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
