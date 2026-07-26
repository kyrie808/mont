import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { secaoService } from '../services/secaoService'

export function useSecoes() {
    const queryClient = useQueryClient()

    const { data: secoes, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['secoes'],
        queryFn: () => secaoService.listSecoes(),
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['secoes'] })
        // Excluir seção faz ON DELETE SET NULL → produtos viram órfãos.
        queryClient.invalidateQueries({ queryKey: ['produtos-orfaos'] })
    }

    const createMutation = useMutation({
        mutationFn: (input: { nome: string }) => secaoService.createSecao(input),
        onSuccess: invalidate,
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: { nome?: string; ativa?: boolean } }) =>
            secaoService.updateSecao(id, patch),
        onSuccess: invalidate,
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => secaoService.deleteSecao(id),
        onSuccess: invalidate,
    })

    const reorderMutation = useMutation({
        mutationFn: (ids: string[]) => secaoService.reorderSecoes(ids),
        onSuccess: invalidate,
    })

    const createSecao = useCallback((input: { nome: string }) => createMutation.mutateAsync(input), [createMutation])
    const updateSecao = useCallback((id: string, patch: { nome?: string; ativa?: boolean }) => updateMutation.mutateAsync({ id, patch }), [updateMutation])
    const deleteSecao = useCallback((id: string) => deleteMutation.mutateAsync(id), [deleteMutation])
    const reorderSecoes = useCallback((ids: string[]) => reorderMutation.mutateAsync(ids), [reorderMutation])

    return {
        secoes: secoes || [],
        loading,
        error: error ? (error as Error).message : null,
        refetch,
        createSecao,
        updateSecao,
        deleteSecao,
        reorderSecoes,
    }
}

export function useSecaoItens(secaoId: string | undefined) {
    const queryClient = useQueryClient()

    const { data: itens, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['secao-itens', secaoId],
        queryFn: () => (secaoId ? secaoService.listItens(secaoId) : Promise.resolve([])),
        enabled: !!secaoId,
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['secao-itens', secaoId] })
        // contagem na sidebar depende disto
        queryClient.invalidateQueries({ queryKey: ['secoes'] })
        // remover item zera secao_id → o produto vira órfão
        queryClient.invalidateQueries({ queryKey: ['produtos-orfaos'] })
    }

    const removeMutation = useMutation({
        mutationFn: (produtoId: string) => secaoService.removeItem(produtoId),
        onSuccess: invalidate,
    })

    const reorderMutation = useMutation({
        mutationFn: (produtoIds: string[]) => secaoService.reorderItens(produtoIds),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['secao-itens', secaoId] }),
    })

    const removeItem = useCallback((produtoId: string) => removeMutation.mutateAsync(produtoId), [removeMutation])
    const reorderItens = useCallback((produtoIds: string[]) => reorderMutation.mutateAsync(produtoIds), [reorderMutation])

    return {
        itens: itens || [],
        loading,
        error: error ? (error as Error).message : null,
        refetch,
        removeItem,
        reorderItens,
    }
}

/** Produtos visíveis no catálogo mas sem seção (aparecem em nenhuma aba). */
export function useProdutosOrfaos() {
    const { data } = useQuery({
        queryKey: ['produtos-orfaos'],
        queryFn: () => secaoService.listOrfaos(),
    })
    return data ?? []
}
