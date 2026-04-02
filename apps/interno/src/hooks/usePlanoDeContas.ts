import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cashFlowService } from '../services/cashFlowService'
import type { Database } from '../types/database'

type PlanoContaInsert = Database['public']['Tables']['plano_de_contas']['Insert']

export function usePlanoDeContas() {
    const queryClient = useQueryClient()

    const { data: planoContas = [], isLoading, error, refetch } = useQuery({
        queryKey: ['plano_de_contas'],
        queryFn: () => cashFlowService.getPlanoDeContas(),
    })

    const createMutation = useMutation({
        mutationFn: (data: PlanoContaInsert) => cashFlowService.createPlanoConta(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plano_de_contas'] })
        },
    })

    const createPlanoConta = useCallback(async (data: PlanoContaInsert) => {
        return createMutation.mutateAsync(data)
    }, [createMutation])

    return {
        planoContas,
        isLoading,
        error,
        refetch,
        createPlanoConta,
        isCreating: createMutation.isPending,
    }
}
