import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cashFlowService } from '../services/cashFlowService'
import type { Database } from '../types/database'

type ContaInsert = Database['public']['Tables']['contas']['Insert']

export function useContas() {
    const queryClient = useQueryClient()

    const { data: contas = [], isLoading, error, refetch } = useQuery({
        queryKey: ['contas'],
        queryFn: () => cashFlowService.getContas(),
    })

    const createMutation = useMutation({
        mutationFn: (data: ContaInsert) => cashFlowService.createConta(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contas'] })
        },
    })

    const createConta = useCallback(async (data: ContaInsert) => {
        return createMutation.mutateAsync(data)
    }, [createMutation])

    return {
        contas,
        isLoading,
        error,
        refetch,
        createConta,
        isCreating: createMutation.isPending,
    }
}
