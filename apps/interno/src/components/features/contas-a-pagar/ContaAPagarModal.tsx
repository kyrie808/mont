import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Repeat, Wallet, Plus, Check, X } from 'lucide-react'
import { Modal, ModalActions, Button, Input, Select } from '../../ui'
import { usePlanoDeContas } from '../../../hooks/usePlanoDeContas'
import { useContas } from '../../../hooks/useContas'
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
    // Despesa já paga (registra a saída no caixa na criação)
    ja_pago: z.boolean(),
    pagamento_conta_id: z.string().optional(),
    pagamento_metodo: z.enum(['pix', 'dinheiro', 'transferencia']).optional(),
    pagamento_data: z.string().optional(),
}).superRefine((val, ctx) => {
    if (val.recorrente) {
        if (val.dia_vencimento == null || Number.isNaN(val.dia_vencimento)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dia_vencimento'], message: 'Informe o dia do vencimento' })
        }
    } else if (!val.data_vencimento) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['data_vencimento'], message: 'Data de vencimento é obrigatória' })
    }
    if (val.ja_pago) {
        if (!val.pagamento_conta_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pagamento_conta_id'], message: 'Selecione a conta de onde saiu' })
        }
        if (!val.pagamento_data) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pagamento_data'], message: 'Informe a data do pagamento' })
        }
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

const hojeISO = () => new Date().toISOString().split('T')[0]

export function ContaAPagarModal({ isOpen, onClose, onSave }: ContaAPagarModalProps) {
    const toast = useToast()
    const { planoContas, createPlanoConta, isCreating: isCreatingCategoria } = usePlanoDeContas()
    const { contas } = useContas()
    const categoriasDespesa = planoContas.filter(c => c.tipo === 'despesa')

    const [showNovaCategoria, setShowNovaCategoria] = useState(false)
    const [novaCategoria, setNovaCategoria] = useState('')
    const [displayValor, setDisplayValor] = useState('')

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
            ja_pago: false,
            pagamento_conta_id: '',
            pagamento_metodo: 'pix',
            pagamento_data: hojeISO(),
        },
    })

    useEffect(() => {
        if (isOpen) {
            reset()
            setShowNovaCategoria(false)
            setNovaCategoria('')
            setDisplayValor('')
        }
    }, [isOpen, reset])

    const valorTotal = watch('valor_total')
    const totalParcelas = watch('total_parcelas')
    const dataVencimento = watch('data_vencimento')
    const recorrente = watch('recorrente')
    const jaPago = watch('ja_pago')
    const isParcelado = !recorrente && totalParcelas > 1
    const podeJaPago = !recorrente && totalParcelas === 1

    // Recorrente é template — não tem "já pago".
    useEffect(() => {
        if (recorrente && jaPago) setValue('ja_pago', false)
    }, [recorrente, jaPago, setValue])

    const parcelas = useMemo(
        () => isParcelado ? gerarPreviewParcelas(valorTotal, totalParcelas, dataVencimento ?? '') : [],
        [valorTotal, totalParcelas, dataVencimento, isParcelado],
    )

    // Máscara de centavos (mesmo padrão do LancamentoModal): digita só dígitos, 2 últimos = centavos.
    const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '')
        const numericValue = Number(value) / 100
        setValue('valor_total', numericValue, { shouldValidate: true })
        setDisplayValor(value === '' ? '' : formatCurrency(numericValue))
    }

    const handleCriarCategoria = async () => {
        const nome = novaCategoria.trim()
        if (!nome) return
        try {
            const nova = await createPlanoConta({ nome, tipo: 'despesa', categoria: 'variavel', ativo: true })
            setValue('plano_conta_id', nova.id, { shouldValidate: true })
            setNovaCategoria('')
            setShowNovaCategoria(false)
            toast.success('Categoria criada!')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao criar categoria')
        }
    }

    const onSubmit = async (data: FormData) => {
        try {
            await onSave(data)
            toast.success(
                data.ja_pago
                    ? 'Despesa registrada e paga!'
                    : data.recorrente
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

    const inlineInputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nova Despesa" size="3xl">
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
                        type="text"
                        inputMode="numeric"
                        value={displayValor}
                        onChange={handleValorChange}
                        placeholder="R$ 0,00"
                        error={errors.valor_total?.message}
                    />
                </div>

                <Input
                    label="Descrição"
                    placeholder="Ex: Tráfego pago — campanha Copa..."
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

                    {/* Categoria + criar inline */}
                    <div className="w-full">
                        <Select
                            label="Categoria"
                            {...register('plano_conta_id')}
                            options={categoriasDespesa.map(c => ({ value: c.id, label: c.nome }))}
                            placeholder="Selecione..."
                            error={errors.plano_conta_id?.message}
                        />
                        {showNovaCategoria ? (
                            <div className="mt-1.5 flex items-center gap-1">
                                <input
                                    autoFocus
                                    value={novaCategoria}
                                    onChange={(e) => setNovaCategoria(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); handleCriarCategoria() }
                                        if (e.key === 'Escape') { setShowNovaCategoria(false); setNovaCategoria('') }
                                    }}
                                    placeholder="Nome da categoria (ex: Tráfego Pago)"
                                    className={inlineInputClass}
                                />
                                <button type="button" onClick={handleCriarCategoria} disabled={isCreatingCategoria || !novaCategoria.trim()} className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50" aria-label="Criar categoria">
                                    <Check className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => { setShowNovaCategoria(false); setNovaCategoria('') }} className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md border border-border text-muted-foreground" aria-label="Cancelar">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setShowNovaCategoria(true)} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <Plus className="w-3 h-3" /> Nova categoria
                            </button>
                        )}
                    </div>
                </div>

                {!recorrente && (
                    <div className="grid grid-cols-2 gap-4">
                        {!jaPago && (
                            <Input
                                label="Parcelas"
                                type="number"
                                min="1"
                                max="60"
                                {...register('total_parcelas', { valueAsNumber: true })}
                            />
                        )}
                        <Input
                            label="Observação"
                            placeholder="Ex: NF, nº do boleto, anotação..."
                            {...register('referencia')}
                        />
                    </div>
                )}

                {/* Toggle: despesa já paga (registra a saída no caixa na criação) */}
                {podeJaPago && (
                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={() => setValue('ja_pago', !jaPago, { shouldValidate: true })}
                            className={cn(
                                "w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                                jaPago ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/30"
                            )}
                            aria-pressed={jaPago}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                <Wallet className={cn("w-4 h-4 shrink-0", jaPago ? "text-primary" : "text-muted-foreground")} />
                                <span className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-foreground">Já paguei</span>
                                    <span className="text-xs text-muted-foreground truncate">Registra a saída no caixa agora (ex: tráfego já cobrado no cartão)</span>
                                </span>
                            </span>
                            <span className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", jaPago ? "bg-primary" : "bg-muted")}>
                                <span className={cn("inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform", jaPago ? "translate-x-5" : "translate-x-0.5")} />
                            </span>
                        </button>

                        {jaPago && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-border bg-muted/30 p-4">
                                <Select
                                    label="Conta (de onde saiu)"
                                    {...register('pagamento_conta_id')}
                                    options={contas.map(c => ({ value: c.id, label: c.nome }))}
                                    placeholder="Selecione..."
                                    error={errors.pagamento_conta_id?.message}
                                />
                                <Select
                                    label="Método"
                                    {...register('pagamento_metodo')}
                                    options={[
                                        { value: 'pix', label: 'Pix' },
                                        { value: 'dinheiro', label: 'Dinheiro' },
                                        { value: 'transferencia', label: 'Transferência' },
                                    ]}
                                />
                                <Input
                                    label="Data do pagamento"
                                    type="date"
                                    {...register('pagamento_data')}
                                    error={errors.pagamento_data?.message}
                                />
                            </div>
                        )}
                    </div>
                )}

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
                        {jaPago ? 'Criar e Registrar Pagamento' : recorrente ? 'Criar Despesa Fixa' : isParcelado ? `Criar ${totalParcelas} Parcelas` : 'Criar Despesa'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
