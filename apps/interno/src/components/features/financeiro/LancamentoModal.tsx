import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowUpRight, ArrowDownLeft, Calendar as CalendarIcon, Wallet, Tag, Info } from 'lucide-react'
import { Modal, ModalActions, Button } from '../../ui'
import { useContas } from '../../../hooks/useContas'
import { usePlanoDeContas } from '../../../hooks/usePlanoDeContas'
import { useLancamentos } from '../../../hooks/useLancamentos'
import { useEntregadores } from '../../../hooks/useEntregadores'
import { comprovanteService } from '../../../services/comprovanteService'
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

// Categorias de repasse ao entregador — revelam o seletor de entregador + comprovante.
const REPASSE_CODES = ['TAXA_ENTREGA_ENTREGADOR', 'AJUDA_CUSTO_ENTREGADOR']

interface LancamentoModalProps {
    type: 'entrada' | 'saida'
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

const inputBase = "flex w-full rounded-xl border border-input bg-background text-foreground ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

export function LancamentoModal({ type, isOpen, onClose, onSuccess }: LancamentoModalProps) {
    const toast = useToast()
    const { contas } = useContas()
    const { planoContas } = usePlanoDeContas()
    const { registrarDespesaManual, registrarEntradaManual } = useLancamentos()
    const { entregadores } = useEntregadores()
    const [displayValor, setDisplayValor] = useState('')
    const [entregadorId, setEntregadorId] = useState('')
    const [comprovanteFile, setComprovanteFile] = useState<File | null>(null)

    const {
        register,
        handleSubmit,
        setValue,
        watch,
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

    // Repasse ao entregador? (revela seletor de entregador + comprovante)
    const planoContaId = watch('plano_conta_id')
    const catSelecionada = planoContas.find((c) => c.id === planoContaId)
    const isRepasse = type === 'saida' && REPASSE_CODES.includes(catSelecionada?.codigo ?? '')

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
            if (isRepasse && !entregadorId) {
                toast.error('Selecione o entregador para o repasse.')
                return
            }
            let comprovante_url: string | null = null
            if (isRepasse && comprovanteFile && entregadorId) {
                comprovante_url = await comprovanteService.upload(comprovanteFile, entregadorId)
            }
            const payload = {
                ...data,
                descricao: data.descricao || null,
                entregador_id: isRepasse ? entregadorId : null,
                comprovante_url,
            }
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
            {/* Faixa de cor por tipo */}
            <div className={cn(
                "absolute top-0 left-0 right-0 h-1.5",
                isEntrada ? "bg-success" : "bg-destructive"
            )} />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-xl border border-border mb-2">
                    <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        isEntrada ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    )}>
                        {isEntrada ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                    </div>
                    <div>
                        <h4 className="font-bold text-foreground">
                            {isEntrada ? 'Entrada Manual' : 'Saída Manual'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            Preencha os dados do lançamento abaixo
                        </p>
                    </div>
                </div>

                {/* Valor Field with Mask */}
                <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
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

                <div className="grid grid-cols-2 gap-4">
                    {/* Data Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                            Data
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                {...register('data')}
                                className={cn(
                                    inputBase, "h-12 px-3 py-2 text-sm",
                                    errors.data && "border-destructive px-1"
                                )}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                        </div>
                        {errors.data && <p className="mt-1 text-xs text-destructive px-1">{errors.data.message}</p>}
                    </div>

                    {/* Conta Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                            Conta
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
                </div>

                {/* Categoria Field */}
                <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                        Categoria
                    </label>
                    <div className="relative">
                        <select
                            {...register('plano_conta_id')}
                            className={cn(
                                inputBase, "h-12 px-3 py-2 pl-9 text-sm appearance-none",
                                errors.plano_conta_id && "border-destructive"
                            )}
                        >
                            <option value="">Selecione uma categoria...</option>
                            {filteredCategorias.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.nome}</option>
                            ))}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Tag className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                    {errors.plano_conta_id && <p className="mt-1 text-xs text-destructive px-1">{errors.plano_conta_id.message}</p>}
                </div>

                {/* Repasse ao entregador: entregador + comprovante (só nas categorias de repasse) */}
                {isRepasse && (
                    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                        <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                                Entregador
                            </label>
                            <select
                                value={entregadorId}
                                onChange={(e) => setEntregadorId(e.target.value)}
                                className={cn(inputBase, "h-12 px-3 py-2 text-sm appearance-none")}
                            >
                                <option value="">Selecione o entregador...</option>
                                {entregadores.map((ent) => (
                                    <option key={ent.id} value={ent.id}>{ent.nome}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                                Comprovante (opcional)
                            </label>
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => setComprovanteFile(e.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground"
                            />
                        </div>
                    </div>
                )}

                {/* Descrição Field */}
                <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                        Descrição (Opcional)
                    </label>
                    <div className="relative">
                        <textarea
                            {...register('descricao')}
                            className={cn(inputBase, "min-h-[80px] px-3 py-2 pl-9 text-sm resize-none")}
                            placeholder="Adicione detalhes sobre este lançamento..."
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
                        className={cn(
                            "px-8 font-bold text-success-foreground",
                            isEntrada
                                ? "bg-success hover:bg-success/90 text-success-foreground"
                                : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        )}
                    >
                        {isEntrada ? 'Registrar Entrada' : 'Registrar Saída'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
