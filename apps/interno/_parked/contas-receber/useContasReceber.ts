import { useQuery } from '@tanstack/react-query'
import { cashFlowService } from '../services/cashFlowService'

export function useContasReceber() {
    const { data: contasReceber = [], isLoading, error, refetch } = useQuery({
        queryKey: ['contas_receber'],
        queryFn: () => cashFlowService.getContasReceber(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    })

    return {
        contasReceber,
        isLoading,
        error,
        refetch,
    }
}
