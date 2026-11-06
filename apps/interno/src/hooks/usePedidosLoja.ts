import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CHAVE_CONTATOS_SEGMENTO } from './useContatosSegmento'
import { pedidosLojaService, type ConfirmarPedidoLoja } from '../services/pedidosLojaService'

const CHAVE = ['pedidos-loja'] as const

/** Fila de pedidos da loja esperando confirmação. Rebusca a cada minuto e ao voltar para a aba. */
export function usePedidosLoja() {
    return useQuery({
        queryKey: CHAVE,
        queryFn: () => pedidosLojaService.listarPendentes(),
        refetchInterval: 60_000,
    })
}

/**
 * Contador do item "Pedidos da loja" no menu (celular e desktop). Fica sob a mesma chave da fila,
 * então confirmar ou descartar atualiza na hora; sozinho, rebusca a cada minuto e ao voltar ao app.
 */
export function useContagemPedidosLoja() {
    return useQuery({
        queryKey: [...CHAVE, 'contagem'],
        queryFn: () => pedidosLojaService.contarPendentes(),
        refetchInterval: 60_000,
    })
}

export function useConfirmarPedidoLoja() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ pedidoId, dados }: { pedidoId: string; dados: ConfirmarPedidoLoja }) =>
            pedidosLojaService.confirmar(pedidoId, dados),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CHAVE })
            queryClient.invalidateQueries({ queryKey: ['vendas'] })
            queryClient.invalidateQueries({ queryKey: ['contatos'] })
            queryClient.invalidateQueries({ queryKey: [CHAVE_CONTATOS_SEGMENTO] })
        },
    })
}

export function useDescartarPedidoLoja() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (pedidoId: string) => pedidosLojaService.descartar(pedidoId),
        onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
    })
}
