import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cashFlowService } from '../services/cashFlowService'

type LancamentoManualData = {
    valor: number
    descricao?: string | null
    data: string
    conta_id: string
    plano_conta_id: string
}

export function useLancamentos() {
    const queryClient = useQueryClient()

    const registrarDespesaMutation = useMutation({
        mutationFn: (data: LancamentoManualData) => cashFlowService.registrarDespesaManual(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['extrato'] })
            queryClient.invalidateQueries({ queryKey: ['fluxo_resumo'] })
            queryClient.invalidateQueries({ queryKey: ['contas'] })
        },
    })

    const registrarEntradaMutation = useMutation({
        mutationFn: (data: LancamentoManualData) => cashFlowService.registrarEntradaManual(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['extrato'] })
            queryClient.invalidateQueries({ queryKey: ['fluxo_resumo'] })
            queryClient.invalidateQueries({ queryKey: ['contas'] })
        },
    })

    const createTransferenciaMutation = useMutation({
        mutationFn: (data: {
            valor: number
            data: string
            conta_id: string
            conta_destino_id: string
            descricao?: string
        }) => cashFlowService.createTransferencia(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['extrato'] })
            queryClient.invalidateQueries({ queryKey: ['fluxo_resumo'] })
            queryClient.invalidateQueries({ queryKey: ['contas'] })
        },
    })

    const registrarDespesaManual = useCallback(async (data: LancamentoManualData) => {
        return registrarDespesaMutation.mutateAsync(data)
    }, [registrarDespesaMutation])

    const registrarEntradaManual = useCallback(async (data: LancamentoManualData) => {
        return registrarEntradaMutation.mutateAsync(data)
    }, [registrarEntradaMutation])

    const createTransferencia = useCallback(async (data: {
        valor: number
        data: string
        conta_id: string
        conta_destino_id: string
        descricao?: string
    }) => {
        return createTransferenciaMutation.mutateAsync(data)
    }, [createTransferenciaMutation])

    return {
        registrarDespesaManual,
        isRegistrandoDespesa: registrarDespesaMutation.isPending,
        registrarEntradaManual,
        isRegistrandoEntrada: registrarEntradaMutation.isPending,
        createTransferencia,
        isTransferring: createTransferenciaMutation.isPending,
    }
}
