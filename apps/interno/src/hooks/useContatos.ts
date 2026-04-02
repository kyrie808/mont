import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contatoService } from '../services/contatoService'
import { useToast } from '../components/ui/Toast'
import type { CreateContato, UpdateContato } from '../types/domain'
import type { ContatoFiltros } from '../schemas/contato'

interface UseContatosOptions {
    filtros?: ContatoFiltros
}

export function useContatos(options: UseContatosOptions = {}) {
    const { filtros } = options
    const queryClient = useQueryClient()
    const toast = useToast()
    const queryKey = ['contatos', filtros]

    const { data: contatos, isLoading: loading, error, refetch } = useQuery({
        queryKey,
        queryFn: () => contatoService.func(
            filtros?.busca,
            filtros?.tipo,
            filtros?.status
        ),
        staleTime: 1000 * 60 * 15,
    })

    const createMutation = useMutation({
        mutationFn: (data: CreateContato) => contatoService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contatos'] })
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: UpdateContato }) =>
            contatoService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contatos'] })
            queryClient.invalidateQueries({ queryKey: ['venda'] })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => contatoService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contatos'] })
        }
    })

    const createContato = useCallback(async (data: CreateContato) => {
        try {
            return await createMutation.mutateAsync(data)
        } catch {
            toast.error('Erro ao criar contato')
            return null
        }
    }, [createMutation])

    const updateContato = useCallback(async (id: string, data: UpdateContato) => {
        try {
            return await updateMutation.mutateAsync({ id, data })
        } catch {
            toast.error('Erro ao atualizar contato')
            return null
        }
    }, [updateMutation])

    const deleteContato = useCallback(async (id: string) => {
        try {
            await deleteMutation.mutateAsync(id)
            return { success: true }
        } catch (e: unknown) {
            toast.error('Erro ao deletar contato')
            return {
                success: false,
                error: (e as Error)?.message?.includes('violates foreign key constraint')
                    ? 'Este contato possui vendas ou pedidos vinculados e não pode ser excluído.'
                    : (e as Error).message
            }
        }
    }, [deleteMutation])

    const searchContatos = useCallback(async (query: string) => {
        return contatoService.func(query)
    }, [])

    const getContatoById = useCallback(async (id: string) => {
        return contatoService.getById(id)
    }, [])

    return {
        contatos: contatos || [],
        loading,
        error: error ? (error as Error).message : null,
        refetch,
        createContato,
        updateContato,
        deleteContato,
        searchContatos,
        getContatoById
    }
}

export function useContato(id: string | undefined) {
    const { data: contato, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['contato', id],
        queryFn: () => id ? contatoService.getById(id) : null,
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    })

    return {
        contato: contato || null,
        indicador: contato?.indicador,
        loading,
        error: error ? (error as Error).message : null,
        refetch: async () => { await refetch() }
    }
}
