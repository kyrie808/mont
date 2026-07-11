import { useQuery } from '@tanstack/react-query'
import { entregasService } from '../services/entregasService'

/** Fonte única das entregas do entregador logado. Compartilhada (mesma queryKey)
 *  entre as abas Entregas/Histórico/Ganhos — o React Query dedupe o fetch. */
export function useEntregas() {
    return useQuery({
        queryKey: ['entregas'],
        queryFn: () => entregasService.listar(),
        // Polling: uma entrega recém-atribuída aparece sozinha (≤15s), sem reload.
        // Só com o app em foco (refetchIntervalInBackground fica false por default).
        refetchInterval: 15000,
    })
}
