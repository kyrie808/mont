import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Tag } from 'lucide-react'
import { Modal, ModalActions, Button } from '../../ui'
import { usePlanoDeContas } from '../../../hooks/usePlanoDeContas'
import { useToast } from '../../ui/Toast'
import { cn } from '@mont/shared'

const planoContaSchema = z.object({
    nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
    tipo: z.enum(['receita', 'despesa']),
    categoria: z.string().min(1, 'O grupo é obrigatório'),
    ativo: z.boolean(),
})

type PlanoContaFormData = z.infer<typeof planoContaSchema>

interface PlanoContaModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
    defaultType?: 'receita' | 'despesa'
}

const inputBase = "flex h-12 w-full rounded-xl border border-input bg-background text-foreground ring-offset-background placeholder:text-muted-foreground/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export function PlanoContaModal({ isOpen, onClose, onSuccess, defaultType = 'receita' }: PlanoContaModalProps) {
    const toast = useToast()
    const { createPlanoConta } = usePlanoDeContas()

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<PlanoContaFormData>({
        resolver: zodResolver(planoContaSchema),
        defaultValues: {
            nome: '',
            tipo: defaultType,
            categoria: '',
            ativo: true,
        },
    })

    // Reset form when modal opens or defaultType changes
    useEffect(() => {
        if (isOpen) {
            reset({
                nome: '',
                tipo: defaultType,
                categoria: '',
                ativo: true,
            })
        }
    }, [isOpen, defaultType, reset])

    const onSubmit = async (data: PlanoContaFormData) => {
        try {
            await createPlanoConta(data)
            toast.success('Categoria criada com sucesso!')
            onSuccess?.()
            onClose()
        } catch (error) {
            console.error(error)
            toast.error('Erro ao criar categoria')
        }
    }

    if (!isOpen) return null

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Nova Categoria"
            size="md"
        >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-foreground" />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
                {/* Nome Field */}
                <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                        Nome da Categoria
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            {...register('nome')}
                            placeholder="Ex: Aluguel, Vendas, etc."
                            className={cn(inputBase, "pl-9", errors.nome && "border-destructive")}
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Tag className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                    {errors.nome && <p className="mt-1 text-xs text-destructive px-1">{errors.nome.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Tipo Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                            Tipo
                        </label>
                        <select
                            {...register('tipo')}
                            className={cn(inputBase, "appearance-none", errors.tipo && "border-destructive")}
                        >
                            <option value="receita">Receita</option>
                            <option value="despesa">Despesa</option>
                        </select>
                        {errors.tipo && <p className="mt-1 text-xs text-destructive px-1">{errors.tipo.message}</p>}
                    </div>

                    {/* Grupo Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                            Grupo
                        </label>
                        <select
                            {...register('categoria')}
                            className={cn(inputBase, "appearance-none", errors.categoria && "border-destructive")}
                        >
                            <option value="">Selecionar...</option>
                            <option value="fixa">Fixa</option>
                            <option value="variavel">Variável</option>
                        </select>
                        {errors.categoria && <p className="mt-1 text-xs text-destructive px-1">{errors.categoria.message}</p>}
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
                        Criar Categoria
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
