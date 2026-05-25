import { useQuery } from '@tanstack/react-query'
import { interacaoService, type Interacao } from '../services/interacaoService'

export function useInteracoes(contatoId: string | null) {
    return useQuery<Interacao[]>({
        queryKey: ['interacoes', contatoId],
        queryFn: () => interacaoService.getByContato(contatoId!),
        enabled: !!contatoId,
        staleTime: 1000 * 60,
    })
}

export type { Interacao }
