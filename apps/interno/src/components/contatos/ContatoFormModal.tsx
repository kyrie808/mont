import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal, ModalActions, Button } from '../ui'
import { contatoSchema, type ContatoFormData } from '../../schemas/contato'
import { useContatos } from '../../hooks/useContatos'
import { useToast } from '../ui/Toast'
import { useCep } from '../../hooks/useCep'
import type { DomainContato, CreateContato } from '../../types/domain'

// Sub-components
import { FormIdentidade } from '../features/contatos/form/FormIdentidade'
import { FormClassificacao } from '../features/contatos/form/FormClassificacao'
import { FormIndicacao } from '../features/contatos/form/FormIndicacao'
import { FormEndereco } from '../features/contatos/form/FormEndereco'

interface ContatoFormModalProps {
    isOpen: boolean
    onClose: () => void
    contato?: DomainContato | null
    onSuccess?: (contato: DomainContato) => void
}

export function ContatoFormModal({
    isOpen,
    onClose,
    contato,
    onSuccess,
}: ContatoFormModalProps) {
    const isEditing = !!contato
    const toast = useToast()
    const { createContato, updateContato, searchContatos } = useContatos()
    const { fetchCep, loading: loadingCep } = useCep()

    const [indicadorSearch, setIndicadorSearch] = useState('')
    const [indicadorResults, setIndicadorResults] = useState<DomainContato[]>([])
    const [selectedIndicador, setSelectedIndicador] = useState<DomainContato | null>(null)
    const [showIndicadorDropdown, setShowIndicadorDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        setFocus,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<ContatoFormData>({
        resolver: zodResolver(contatoSchema),
        defaultValues: {
            nome: '', apelido: '', telefone: '', tipo: 'B2C', status: 'lead', origem: 'direto', subtipo: null,
            indicado_por_id: null, endereco: null, bairro: null, observacoes: null, cep: '', logradouro: '',
            numero: '', complemento: '', cidade: '', uf: '',
        },
    })

    // eslint-disable-next-line react-hooks/incompatible-library
    const tipoValue = watch('tipo')
    const origemValue = watch('origem')
    const cepValue = watch('cep')

    const handleFetchCep = useCallback(async (cep: string) => {
        const data = await fetchCep(cep)
        if (data) {
            setValue('logradouro', data.street)
            setValue('bairro', data.neighborhood)
            setValue('cidade', data.city)
            setValue('uf', data.state)
            setTimeout(() => setFocus('numero'), 100)
        }
    }, [fetchCep, setValue, setFocus])

    useEffect(() => {
        if (cepValue?.replace(/\D/g, '').length === 8) {
            handleFetchCep(cepValue.replace(/\D/g, ''))
        }
    }, [cepValue, handleFetchCep])

    useEffect(() => {
        if (isOpen && contato) {
            reset({
                ...contato,
                indicado_por_id: contato.indicadoPorId,
                cep: contato.cep || '',
                logradouro: contato.logradouro || contato.endereco || '',
                numero: contato.numero || '',
                complemento: contato.complemento || '',
                cidade: contato.cidade || '',
                uf: contato.uf || '',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
        } else if (isOpen) {
            reset()
            setSelectedIndicador(null)
            setIndicadorSearch('')
        }
    }, [isOpen, contato, reset])

    useEffect(() => {
        const searchIndicadores = async () => {
            if (indicadorSearch.length >= 2) {
                const results = await searchContatos(indicadorSearch)
                setIndicadorResults(results.filter((c) => c.id !== contato?.id))
                setShowIndicadorDropdown(true)
            } else {
                setIndicadorResults([])
                setShowIndicadorDropdown(false)
            }
        }
        const debounce = setTimeout(searchIndicadores, 300)
        return () => clearTimeout(debounce)
    }, [indicadorSearch, searchContatos, contato?.id])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowIndicadorDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const onSubmit = async (data: ContatoFormData) => {
        try {
            const rawValues = getValues()
            const formDataKeyed = { ...data, ...rawValues }
            const cleanPayload: CreateContato = {
                ...formDataKeyed,
                indicadoPorId: formDataKeyed.indicado_por_id,
                cep: formDataKeyed.cep?.replace(/\D/g, '') || null,
            } as unknown as CreateContato

            if (!cleanPayload.endereco && cleanPayload.logradouro) {
                cleanPayload.endereco = `${cleanPayload.logradouro}, ${cleanPayload.numero || 'S/N'}${cleanPayload.complemento ? ' - ' + cleanPayload.complemento : ''} - ${cleanPayload.cidade}/${cleanPayload.uf}`
            }

            const result = isEditing && contato ? await updateContato(contato.id, cleanPayload) : await createContato(cleanPayload)

            if (result) {
                toast.success(isEditing ? 'Contato atualizado!' : 'Contato criado!')
                onSuccess?.(result)
                onClose()
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao salvar contato')
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar Contato' : 'Novo Contato'} size="4xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <FormIdentidade register={register} errors={errors} />
                        <FormClassificacao register={register} errors={errors} tipoValue={tipoValue} />
                        {origemValue === 'indicacao' && (
                            <div ref={dropdownRef}>
                                <FormIndicacao 
                                    selectedIndicador={selectedIndicador}
                                    handleClearIndicador={() => { setSelectedIndicador(null); setValue('indicado_por_id', null); }}
                                    indicadorSearch={indicadorSearch}
                                    setIndicadorSearch={setIndicadorSearch}
                                    showIndicadorDropdown={showIndicadorDropdown}
                                    indicadorResults={indicadorResults}
                                    handleSelectIndicador={(c) => { setSelectedIndicador(c); setValue('indicado_por_id', c.id); setShowIndicadorDropdown(false); }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <FormEndereco register={register} errors={errors} loadingCep={loadingCep} />
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Observações</label>
                            <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none"
                                {...register('observacoes')}
                            />
                        </div>
                    </div>
                </div>

                <ModalActions>
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" isLoading={isSubmitting} variant="primary">
                        {isEditing ? 'Salvar Alterações' : 'Criar Contato'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
