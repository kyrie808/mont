import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { produtoService } from '../services/produtoService'
import type { CreateProduto, UpdateProduto } from '../types/domain'

export function useProdutos(includeInactive: boolean = false) {
    const queryClient = useQueryClient()

    const { data: produtos, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['produtos', includeInactive],
        queryFn: () => produtoService.getAll(includeInactive),
    })

    const createMutation = useMutation({
        mutationFn: (data: CreateProduto) => produtoService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] })
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: UpdateProduto }) =>
            produtoService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] })
        }
    })

    const updateEstoqueMutation = useMutation({
        mutationFn: ({ id, quantidade }: { id: string, quantidade: number }) =>
            produtoService.updateEstoque(id, quantidade),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] })
        }
    })

    const createProduto = useCallback(async (data: CreateProduto) => {
        return createMutation.mutateAsync(data)
    }, [createMutation])

    const updateProduto = useCallback(async (id: string, data: UpdateProduto) => {
        return updateMutation.mutateAsync({ id, data })
    }, [updateMutation])

    const updateEstoque = useCallback(async (id: string, quantidade: number) => {
        return updateEstoqueMutation.mutateAsync({ id, quantidade })
    }, [updateEstoqueMutation])

    return {
        produtos: produtos || [],
        loading,
        error: error ? (error as Error).message : null,
        refetch,
        createProduto,
        updateProduto,
        updateEstoque
    }
}

export function useProduto(id: string | undefined) {
    const { data: produto, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['produto', id],
        queryFn: () => id ? produtoService.getById(id) : null,
        enabled: !!id,
    })

    return {
        produto: produto || null,
        loading,
        error: error ? (error as Error).message : null,
        refetch
    }
}
