import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { despesasRecorrentesService } from '../services/despesasRecorrentesService'
import type { Database } from '@mont/shared'

type DespesaRecorrenteInsert = Database['public']['Tables']['despesas_recorrentes']['Insert']
type DespesaRecorrenteUpdate = Database['public']['Tables']['despesas_recorrentes']['Update']

export function useDespesasRecorrentes() {
    const queryClient = useQueryClient()

    const { data: recorrentes, isLoading: loading } = useQuery({
        queryKey: ['despesas_recorrentes'],
        queryFn: () => despesasRecorrentesService.getRecorrentes(),
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['despesas_recorrentes'] })
        queryClient.invalidateQueries({ queryKey: ['contas_a_pagar'] })
    }

    const createMutation = useMutation({
        mutationFn: (payload: DespesaRecorrenteInsert) => despesasRecorrentesService.createRecorrente(payload),
        onSuccess: invalidate,
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: DespesaRecorrenteUpdate }) =>
            despesasRecorrentesService.updateRecorrente(id, patch),
        onSuccess: invalidate,
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => despesasRecorrentesService.deleteRecorrente(id),
        onSuccess: invalidate,
    })

    return {
        recorrentes: recorrentes || [],
        loading,
        createRecorrente: createMutation.mutateAsync,
        updateRecorrente: updateMutation.mutateAsync,
        deleteRecorrente: deleteMutation.mutateAsync,
        gerarDoMes: despesasRecorrentesService.gerarDoMes,
        isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    }
}
