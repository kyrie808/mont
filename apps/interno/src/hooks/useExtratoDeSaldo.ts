import { useQuery } from '@tanstack/react-query'
import { cashFlowService } from '../services/cashFlowService'

export function useExtratoDeSaldo() {
    const { data: extratoDeSaldo = [], isLoading, error, refetch } = useQuery({
        queryKey: ['extrato_saldo'],
        queryFn: () => cashFlowService.getExtratoDeSaldo(),
        staleTime: 1000 * 60 * 5,
    })

    return {
        extratoDeSaldo,
        isLoading,
        error,
        refetch,
    }
}
