import { useQuery } from '@tanstack/react-query'
import { cashFlowService } from '../services/cashFlowService'

export function useFluxoCaixa(month: Date) {
    const { data: resumo, isLoading, error, refetch } = useQuery({
        queryKey: ['fluxo_resumo', month.toISOString().substring(0, 7)],
        queryFn: () => cashFlowService.getFluxoResumo(month),
        staleTime: 1000 * 60 * 5,
    })

    return {
        resumo,
        isLoading,
        error,
        refetch,
    }
}
