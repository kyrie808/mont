import { useQuery } from '@tanstack/react-query'
import { relacionamentoService, type PerfilExtras } from '../services/relacionamentoService'
import type { Tables } from '@mont/shared'

export function usePerfilExtras(contatoId: string | null) {
    return useQuery<PerfilExtras | null>({
        queryKey: ['perfil_extras', contatoId],
        queryFn: () => relacionamentoService.getPerfilExtras(contatoId!),
        enabled: !!contatoId,
        staleTime: 1000 * 60 * 2,
    })
}

export function useLtvContato(contatoId: string | null) {
    return useQuery<Tables<'rpt_ltv_por_cliente'> | null>({
        queryKey: ['ltv_contato', contatoId],
        queryFn: () => relacionamentoService.getLtvContato(contatoId!),
        enabled: !!contatoId,
        staleTime: 1000 * 60 * 5,
    })
}
