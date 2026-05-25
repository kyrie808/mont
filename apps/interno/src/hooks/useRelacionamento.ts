import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    relacionamentoService,
    type KanbanRow,
    type RelacionamentoAba,
    type RelacionamentoStatus,
} from '../services/relacionamentoService'

const RELACIONAMENTO_QUERY_KEY = ['relacionamento_kanban'] as const

interface MoverCardInput {
    contatoId: string
    novoStatus: RelacionamentoStatus
    observacao?: string
}

export function useKanbanData(aba: RelacionamentoAba) {
    return useQuery<KanbanRow[]>({
        queryKey: [...RELACIONAMENTO_QUERY_KEY, aba],
        queryFn: () => relacionamentoService.getKanbanData(aba),
        staleTime: 1000 * 60 * 2,
    })
}

export function useMoverCard() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, MoverCardInput, { previousData: Array<[readonly unknown[], KanbanRow[] | undefined]> }>({
        mutationFn: (input) => relacionamentoService.moverCard(input),
        onMutate: async ({ contatoId, novoStatus }) => {
            await queryClient.cancelQueries({ queryKey: RELACIONAMENTO_QUERY_KEY })

            const previousData = queryClient.getQueriesData<KanbanRow[]>({
                queryKey: RELACIONAMENTO_QUERY_KEY,
            })

            queryClient.setQueriesData<KanbanRow[]>({ queryKey: RELACIONAMENTO_QUERY_KEY }, (current) => {
                if (!current) return current

                return current.map((card) =>
                    card.contato_id === contatoId ? { ...card, status_relacionamento: novoStatus } : card
                )
            })

            return { previousData }
        },
        onError: (_error, _variables, context) => {
            if (!context?.previousData) return

            for (const [queryKey, data] of context.previousData) {
                queryClient.setQueryData(queryKey, data)
            }
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: RELACIONAMENTO_QUERY_KEY })
        },
    })
}

export type { KanbanRow, RelacionamentoAba, RelacionamentoStatus }
