import { useQuery } from '@tanstack/react-query'
import { cashFlowService } from '../services/cashFlowService'

export function useExtrato(month: Date) {
    const { data: extrato = [], isLoading, error, refetch } = useQuery({
        queryKey: ['extrato', month.toISOString().substring(0, 7)],
        queryFn: () => cashFlowService.getExtratoMensal(month),
        staleTime: 1000 * 60 * 5,
    })

    return {
        extrato,
        isLoading,
        error,
        refetch,
    }
}
