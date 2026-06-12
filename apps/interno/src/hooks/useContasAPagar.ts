import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contasAPagarService } from '../services/contasAPagarService'
import type { Database } from '@mont/shared'

type ContaAPagarInsert = Database['public']['Tables']['contas_a_pagar']['Insert']

export function useContasAPagar() {
    const queryClient = useQueryClient()

    const { data: contasAPagar, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['contas_a_pagar'],
        queryFn: () => contasAPagarService.getContasAPagar(),
    })

    const createMutation = useMutation({
        mutationFn: (data: ContaAPagarInsert) =>
            contasAPagarService.createContaAPagar(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contas_a_pagar'] })
        },
    })

    const criarParceladaMutation = useMutation({
        mutationFn: (params: {
            descricao: string
            credor: string
            valor_total: number
            data_vencimento: string
            plano_conta_id: string
            total_parcelas: number
            referencia?: string
            observacao?: string
        }) => contasAPagarService.criarObrigacaoParcelada(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contas_a_pagar'] })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => contasAPagarService.deleteContaAPagar(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contas_a_pagar'] })
            queryClient.invalidateQueries({ queryKey: ['contas'] })
            queryClient.invalidateQueries({ queryKey: ['extrato'] })
            queryClient.invalidateQueries({ queryKey: ['fluxo_resumo'] })
        },
    })

    const registrarPagamentoMutation = useMutation({
        mutationFn: (params: {
            contaAPagarId: string
            valor: number
            dataPagamento: string
            contaId: string
            metodoPagamento?: string
            observacao?: string
            contaCredorId?: string
        }) => contasAPagarService.registrarPagamento(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contas_a_pagar'] })
            queryClient.invalidateQueries({ queryKey: ['contas'] })
            queryClient.invalidateQueries({ queryKey: ['extrato'] })
            queryClient.invalidateQueries({ queryKey: ['fluxo_resumo'] })
        },
    })

    return {
        contasAPagar: contasAPagar || [],
        loading,
        error: error ? (error as Error).message : null,
        refetch,
        createContaAPagar: createMutation.mutateAsync,
        criarObrigacaoParcelada: criarParceladaMutation.mutateAsync,
        registrarPagamento: registrarPagamentoMutation.mutateAsync,
        deleteContaAPagar: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending || criarParceladaMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isRegistrandoPagamento: registrarPagamentoMutation.isPending,
    }
}
