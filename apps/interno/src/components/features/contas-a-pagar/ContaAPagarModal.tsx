import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Repeat } from 'lucide-react'
import { Modal, ModalActions, Button, Input, Select } from '../../ui'
import { usePlanoDeContas } from '../../../hooks/usePlanoDeContas'
import { useToast } from '../../ui/Toast'
import { formatCurrency, cn } from '@mont/shared'
import { addMonths, format, parseISO } from 'date-fns'

const schema = z.object({
    descricao: z.string().min(1, 'Descrição é obrigatória'),
    credor: z.string().min(1, 'Credor é obrigatório'),
    valor_total: z.number().min(0.01, 'Valor deve ser maior que zero'),
    plano_conta_id: z.string().min(1, 'Categoria é obrigatória'),
    recorrente: z.boolean(),
    data_vencimento: z.string().optional(),
    dia_vencimento: z.number().min(1, 'Dia entre 1 e 31').max(31, 'Dia entre 1 e 31').optional(),
    total_parcelas: z.number().min(1).max(60),
    referencia: z.string().optional(),
    observacao: z.string().optional(),
}).superRefine((val, ctx) => {
    if (val.recorrente) {
        if (val.dia_vencimento == null || Number.isNaN(val.dia_vencimento)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dia_vencimento'], message: 'Informe o dia do vencimento' })
        }
    } else if (!val.data_vencimento) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['data_vencimento'], message: 'Data de vencimento é obrigatória' })
    }
})

export type ContaAPagarFormData = z.infer<typeof schema>
type FormData = ContaAPagarFormData

interface ParcelaPreview {
    numero: number
    valor: number
    vencimento: string
}

interface ContaAPagarModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (data: FormData) => Promise<void>
}

function gerarPreviewParcelas(
    valorTotal: number,
    totalParcelas: number,
    dataVencimento: string,
): ParcelaPreview[] {
    if (!valorTotal || !totalParcelas || totalParcelas < 1 || !dataVencimento) return []

    const valorParcela = Math.floor((valorTotal / totalParcelas) * 100) / 100
    const valorUltima = +(valorTotal - valorParcela * (totalParcelas - 1)).toFixed(2)

    const parcelas: ParcelaPreview[] = []
    const baseDate = parseISO(dataVencimento)

    for (let i = 0; i < totalParcelas; i++) {
        parcelas.push({
            numero: i + 1,
            valor: i === totalParcelas - 1 ? valorUltima : valorParcela,
            vencimento: format(addMonths(baseDate, i), 'dd/MM/yyyy'),
        })
    }

    return parcelas
}

export function ContaAPagarModal({ isOpen, onClose, onSave }: ContaAPagarModalProps) {
    const toast = useToast()
    const { planoContas } = usePlanoDeContas()
    const categoriasDespesa = planoContas.filter(c => c.tipo === 'despesa')

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            descricao: '',
            credor: '',
            valor_total: 0,
            plano_conta_id: '',
            recorrente: false,
            data_vencimento: '',
            dia_vencimento: 5,
            total_parcelas: 1,
            referencia: '',
            observacao: '',
        },
    })

    useEffect(() => {
        if (isOpen) reset()
    }, [isOpen, reset])

    const valorTotal = watch('valor_total')
    const totalParcelas = watch('total_parcelas')
    const dataVencimento = watch('data_vencimento')
    const recorrente = watch('recorrente')
    const isParcelado = !recorrente && totalParcelas > 1

    const parcelas = useMemo(
        () => isParcelado ? gerarPreviewParcelas(valorTotal, totalParcelas, dataVencimento ?? '') : [],
        [valorTotal, totalParcelas, dataVencimento, isParcelado],
    )

    const onSubmit = async (data: FormData) => {
        try {
            await onSave(data)
            toast.success(
                data.recorrente
                    ? 'Despesa fixa criada — vai se repetir todo mês!'
                    : isParcelado
                        ? `${totalParcelas} despesas criadas com sucesso!`
                        : 'Despesa criada com sucesso!',
            )
            onClose()
        } catch {
            toast.error('Erro ao criar despesa')
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nova Despesa" size="md">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        label="Credor"
                        placeholder="Ex: Gilmar, Izaulino..."
                        {...register('credor')}
                        error={errors.credor?.message}
                    />
                    <Input
                        label="Valor Total"
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...register('valor_total', { valueAsNumber: true })}
                        error={errors.valor_total?.message}
                    />
                </div>

                <Input
                    label="Descrição"
                    placeholder="Ex: Empréstimo para capital de giro..."
                    {...register('descricao')}
                    error={errors.descricao?.message}
                />

                {/* Toggle: despesa fixa recorrente */}
                <button
                    type="button"
                    onClick={() => setValue('recorrente', !recorrente, { shouldValidate: true })}
                    className={cn(
                        "w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        recorrente ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/30"
                    )}
                    aria-pressed={recorrente}
                >
                    <span className="flex items-center gap-2 min-w-0">
                        <Repeat className={cn("w-4 h-4 shrink-0", recorrente ? "text-primary" : "text-muted-foreground")} />
                        <span className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-foreground">Repetir todo mês (fixa)</span>
                            <span className="text-xs text-muted-foreground truncate">Ex: assinatura, aluguel — gerada automaticamente todo mês</span>
                        </span>
                    </span>
                    <span className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", recorrente ? "bg-primary" : "bg-muted")}>
                        <span className={cn("inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform", recorrente ? "translate-x-5" : "translate-x-0.5")} />
                    </span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {recorrente ? (
                        <Input
                            label="Dia do vencimento"
                            type="number"
                            min="1"
                            max="31"
                            {...register('dia_vencimento', { valueAsNumber: true })}
                            error={errors.dia_vencimento?.message}
                        />
                    ) : (
                        <Input
                            label="Data de Vencimento"
                            type="date"
                            {...register('data_vencimento')}
                            error={errors.data_vencimento?.message}
                        />
                    )}
                    <Select
                        label="Categoria"
                        {...register('plano_conta_id')}
                        options={categoriasDespesa.map(c => ({
                            value: c.id,
                            label: c.nome,
                        }))}
                        placeholder="Selecione..."
                        error={errors.plano_conta_id?.message}
                    />
                </div>

                {!recorrente && (
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Parcelas"
                            type="number"
                            min="1"
                            max="60"
                            {...register('total_parcelas', { valueAsNumber: true })}
                        />
                        <Input
                            label="Referência"
                            placeholder="Opcional"
                            {...register('referencia')}
                        />
                    </div>
                )}

                <Input
                    label="Observação"
                    placeholder="Opcional"
                    {...register('observacao')}
                />

                {/* Preview de parcelas */}
                {isParcelado && parcelas.length > 0 && (
                    <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            Serão criadas {totalParcelas} despesas:
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {parcelas.map(p => (
                                <div
                                    key={p.numero}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="text-foreground font-medium">
                                        Parcela {p.numero}/{totalParcelas}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-foreground">
                                            {formatCurrency(p.valor)}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {p.vencimento}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between pt-2 border-t border-border text-xs">
                            <span className="text-muted-foreground font-bold">Total</span>
                            <span className="font-bold text-foreground">
                                {formatCurrency(parcelas.reduce((s, p) => s + p.valor, 0))}
                            </span>
                        </div>
                    </div>
                )}

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        {recorrente ? 'Criar Despesa Fixa' : isParcelado ? `Criar ${totalParcelas} Parcelas` : 'Criar Despesa'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
