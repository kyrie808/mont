import { useForm } from 'react-hook-form'
import { Modal, ModalActions, Button, Input, Select } from '../../ui'
import { cashFlowService } from '../../../services/cashFlowService'
import { useToast } from '../../ui/Toast'
import { useState } from 'react'

interface ContaModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

interface ContaFormData {
    nome: string
    banco: string
    tipo: 'dinheiro' | 'pix' | 'banco'
    saldo_inicial: number
}

export function ContaModal({ isOpen, onClose, onSuccess }: ContaModalProps) {
    const toast = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const { register, handleSubmit, reset, formState: { errors } } = useForm<ContaFormData>({
        defaultValues: {
            tipo: 'banco',
            saldo_inicial: 0
        }
    })

    const onSubmit = async (data: ContaFormData) => {
        try {
            setIsLoading(true)
            await cashFlowService.createConta(data)
            toast.success('Conta criada com sucesso!')
            reset()
            onSuccess?.()
            onClose()
        } catch (error) {
            toast.error('Erro ao criar conta')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Nova Conta Bancária"
            size="sm"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                    label="Nome da Conta"
                    placeholder="Ex: Nubank Principal, Caixa Empresa..."
                    {...register('nome', { required: 'Nome é obrigatório' })}
                    error={errors.nome?.message}
                />

                <Input
                    label="Banco"
                    placeholder="Ex: Nubank, Itaú..."
                    {...register('banco', { required: 'Banco é obrigatório' })}
                    error={errors.banco?.message}
                />

                <Select
                    label="Tipo de Conta"
                    {...register('tipo', { required: 'Tipo é obrigatório' })}
                    options={[
                        { value: 'banco', label: 'Conta Bancária' },
                        { value: 'pix', label: 'Pix' },
                        { value: 'dinheiro', label: 'Dinheiro em Mãos' },
                    ]}
                    error={errors.tipo?.message}
                />

                <Input
                    label="Saldo Inicial"
                    type="number"
                    step="0.01"
                    {...register('saldo_inicial', { valueAsNumber: true })}
                    error={errors.saldo_inicial?.message}
                />

                <ModalActions>
                    <Button variant="outline" onClick={onClose} type="button">
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={isLoading}>
                        Criar Conta
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
