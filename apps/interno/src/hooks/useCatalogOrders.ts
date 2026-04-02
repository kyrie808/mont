import { useQuery } from '@tanstack/react-query'
import { catalogService } from '../services/catalogService'

export function useCatalogOrders(contatoId?: string) {
    const { data: orders, isLoading, error, refetch } = useQuery({
        queryKey: ['catalog-orders', contatoId],
        queryFn: () => contatoId ? catalogService.getPedidosByContato(contatoId) : Promise.resolve([]),
        enabled: !!contatoId
    })

    return {
        orders: orders || [],
        isLoading,
        error,
        refetch
    }
}
