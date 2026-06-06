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
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-violet-600" />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
                {/* Nome Field */}
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                        Nome da Categoria
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            {...register('nome')}
                            placeholder="Ex: Aluguel, Vendas, etc."
                            className={cn(
                                "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pl-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                                errors.nome && "border-red-500"
                            )}
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Tag className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>
                    {errors.nome && <p className="mt-1 text-xs text-red-500 px-1">{errors.nome.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Tipo Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                            Tipo
                        </label>
                        <select
                            {...register('tipo')}
                            className={cn(
                                "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 appearance-none",
                                errors.tipo && "border-red-500"
                            )}
                        >
                            <option value="receita">Receita</option>
                            <option value="despesa">Despesa</option>
                        </select>
                        {errors.tipo && <p className="mt-1 text-xs text-red-500 px-1">{errors.tipo.message}</p>}
                    </div>

                    {/* Grupo Field */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                            Grupo
                        </label>
                        <select
                            {...register('categoria')}
                            className={cn(
                                "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 appearance-none",
                                errors.categoria && "border-red-500"
                            )}
                        >
                            <option value="">Selecionar...</option>
                            <option value="fixa">Fixa</option>
                            <option value="variavel">Variável</option>
                        </select>
                        {errors.categoria && <p className="mt-1 text-xs text-red-500 px-1">{errors.categoria.message}</p>}
                    </div>
                </div>

                <ModalActions>
                    <Button type="button" variant="ghost" onClick={onClose} className="text-slate-500">
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                        className="bg-violet-600 hover:bg-violet-700 px-8 font-bold text-white"
                    >
                        Criar Categoria
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
