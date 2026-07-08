import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalActions, Button, Input, Select } from '../../ui'
import { useToast } from '../../ui/Toast'
import type { Conta } from '@mont/shared'

const schema = z.object({
    nome: z.string().min(1, 'Nome é obrigatório'),
    banco: z.string().min(1, 'Banco é obrigatório'),
    tipo: z.enum(['dinheiro', 'pix', 'banco']),
})

type FormData = z.infer<typeof schema>

export interface EditContaPatch {
    nome: string
    banco: string
    tipo: string
}

interface EditContaModalProps {
    isOpen: boolean
    conta: Conta | null
    onClose: () => void
    onSave: (id: string, patch: EditContaPatch) => Promise<void>
}

export function EditContaModal({ isOpen, conta, onClose, onSave }: EditContaModalProps) {
    const toast = useToast()

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
    })

    // Pré-preenche quando abre com uma conta. Saldo NÃO é editável (derivado dos lançamentos).
    useEffect(() => {
        if (isOpen && conta) {
            reset({
                nome: conta.nome,
                banco: conta.banco ?? '',
                tipo: (conta.tipo as FormData['tipo']) ?? 'banco',
            })
        }
    }, [isOpen, conta, reset])

    const onSubmit = async (data: FormData) => {
        if (!conta) return
        try {
            await onSave(conta.id, {
                nome: data.nome,
                banco: data.banco,
                tipo: data.tipo,
            })
            onClose()
        } catch {
            toast.error('Erro ao atualizar conta')
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Conta" size="sm">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                    label="Nome da Conta"
                    placeholder="Ex: Nubank Principal, Caixa Empresa..."
                    {...register('nome')}
                    error={errors.nome?.message}
                />

                <Input
                    label="Banco"
                    placeholder="Ex: Nubank, Itaú..."
                    {...register('banco')}
                    error={errors.banco?.message}
                />

                <Select
                    label="Tipo de Conta"
                    {...register('tipo')}
                    options={[
                        { value: 'banco', label: 'Conta Bancária' },
                        { value: 'pix', label: 'Pix' },
                        { value: 'dinheiro', label: 'Dinheiro em Mãos' },
                    ]}
                    error={errors.tipo?.message}
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
