import { useQuery } from '@tanstack/react-query'
import { relacionamentoService, type PerfilExtras, type KanbanRow } from '../services/relacionamentoService'
import type { Tables } from '@mont/shared'

/** Ritmo (dias sem compra / atraso / próxima esperada) de um contato, standalone
 *  — permite o perfil rico funcionar fora do kanban. */
export function useKanbanRowContato(contatoId: string | null) {
    return useQuery<KanbanRow | null>({
        queryKey: ['kanban_row_contato', contatoId],
        queryFn: () => relacionamentoService.getKanbanRowByContato(contatoId!),
        enabled: !!contatoId,
        staleTime: 1000 * 60 * 2,
    })
}

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
