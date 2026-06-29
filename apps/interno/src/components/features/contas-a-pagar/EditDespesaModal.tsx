import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalActions, Button, Input, Select } from '../../ui'
import { usePlanoDeContas } from '../../../hooks/usePlanoDeContas'
import { useToast } from '../../ui/Toast'
import { formatCurrency } from '@mont/shared'
import type { ContaAPagarEnriched } from '../../../services/contasAPagarService'

const schema = z.object({
    credor: z.string().min(1, 'Credor é obrigatório'),
    descricao: z.string().min(1, 'Descrição é obrigatória'),
    valor_total: z.number().min(0.01, 'Valor deve ser maior que zero'),
    data_vencimento: z.string().min(1, 'Data de vencimento é obrigatória'),
    plano_conta_id: z.string().min(1, 'Categoria é obrigatória'),
    referencia: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export interface EditDespesaPatch {
    credor: string
    descricao: string
    valor_total?: number
    data_vencimento: string
    plano_conta_id: string
    referencia: string | null
}

interface EditDespesaModalProps {
    isOpen: boolean
    conta: ContaAPagarEnriched | null
    onClose: () => void
    onSave: (id: string, patch: EditDespesaPatch) => Promise<void>
}

export function EditDespesaModal({ isOpen, conta, onClose, onSave }: EditDespesaModalProps) {
    const toast = useToast()
    const { planoContas } = usePlanoDeContas()
    const categoriasDespesa = planoContas.filter(c => c.tipo === 'despesa')

    const podeEditarValor = (conta?.valor_pago ?? 0) === 0

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
    })

    // Pré-preenche quando abre com uma despesa.
    useEffect(() => {
        if (isOpen && conta) {
            reset({
                credor: conta.credor,
                descricao: conta.descricao,
                valor_total: conta.valor_total,
                data_vencimento: conta.data_vencimento,
                plano_conta_id: conta.plano_conta_id ?? '',
                referencia: conta.referencia ?? '',
            })
        }
    }, [isOpen, conta, reset])

    // Display da máscara de centavos derivado do valor (sem state/effect próprio).
    const valorTotal = watch('valor_total')
    const displayValor = valorTotal ? formatCurrency(valorTotal) : ''

    const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '')
        setValue('valor_total', Number(value) / 100, { shouldValidate: true })
    }

    const onSubmit = async (data: FormData) => {
        if (!conta) return
        try {
            await onSave(conta.id, {
                credor: data.credor,
                descricao: data.descricao,
                data_vencimento: data.data_vencimento,
                plano_conta_id: data.plano_conta_id,
                referencia: data.referencia || null,
                ...(podeEditarValor ? { valor_total: data.valor_total } : {}),
            })
            onClose()
        } catch {
            toast.error('Erro ao atualizar despesa')
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Despesa" size="lg">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        label="Credor"
                        {...register('credor')}
                        error={errors.credor?.message}
                    />
                    <div className="w-full">
                        <Input
                            label="Valor Total"
                            type="text"
                            inputMode="numeric"
                            value={displayValor}
                            onChange={handleValorChange}
                            placeholder="R$ 0,00"
                            disabled={!podeEditarValor}
                            error={errors.valor_total?.message}
                        />
                        {!podeEditarValor && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                Para alterar o valor, exclua e recrie (há pagamento registrado).
                            </p>
                        )}
                    </div>
                </div>

                <Input
                    label="Descrição"
                    {...register('descricao')}
                    error={errors.descricao?.message}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        label="Data de Vencimento"
                        type="date"
                        {...register('data_vencimento')}
                        error={errors.data_vencimento?.message}
                    />
                    <Select
                        label="Categoria"
                        {...register('plano_conta_id')}
                        options={categoriasDespesa.map(c => ({ value: c.id, label: c.nome }))}
                        placeholder="Selecione..."
                        error={errors.plano_conta_id?.message}
                    />
                </div>

                <Input
                    label="Observação"
                    placeholder="Ex: NF, nº do boleto, anotação..."
                    {...register('referencia')}
                />

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        Salvar Alterações
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
