import { useQuery } from '@tanstack/react-query'
import { entregadorService, type EntregadorOption } from '../services/entregadorService'

/** Lista os entregadores ativos (seletor de atribuição). Cache generoso — muda pouco. */
export function useEntregadores(): { entregadores: EntregadorOption[]; loading: boolean } {
    const { data, isLoading } = useQuery({
        queryKey: ['entregadores', 'ativos'],
        queryFn: () => entregadorService.listAtivos(),
        staleTime: 1000 * 60 * 10,
    })
    return { entregadores: data ?? [], loading: isLoading }
}
