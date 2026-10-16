import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../services/dashboardService'

/** Meta fixa do mês (null = mês sem meta cadastrada). */
export function useMetaMensal(ano: number, mes: number) {
    return useQuery({
        queryKey: ['meta_mensal', ano, mes],
        queryFn: () => dashboardService.getMetaMensal(ano, mes),
        staleTime: 1000 * 60 * 5,
    })
}

/** Pedidos do dia de Brasília (`dia` = 'AAAA-MM-DD'). */
export function usePedidosDoDia(dia: string) {
    return useQuery({
        queryKey: ['pedidos_do_dia', dia],
        queryFn: () => dashboardService.getPedidosDoDia(dia),
        staleTime: 1000 * 60,
    })
}

/** Sugestão de metas pro mês informado — só busca quando `enabled` (últimos 5 dias). */
export function useSugestaoMetas(ano: number, mes: number, enabled: boolean) {
    return useQuery({
        queryKey: ['sugestao_metas', ano, mes],
        queryFn: () => dashboardService.getSugestaoMetas(ano, mes),
        staleTime: 1000 * 60 * 5,
        enabled,
    })
}
