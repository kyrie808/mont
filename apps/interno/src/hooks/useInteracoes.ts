import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interacaoService, type Interacao, type Canal } from '../services/interacaoService'

export function useInteracoes(contatoId: string | null) {
    return useQuery<Interacao[]>({
        queryKey: ['interacoes', contatoId],
        queryFn: () => interacaoService.getByContato(contatoId!),
        enabled: !!contatoId,
        staleTime: 1000 * 60,
    })
}

interface RegistrarFeedbackInput {
    contatoId: string
    canal: Canal
    texto: string
}

export function useRegistrarFeedback() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, RegistrarFeedbackInput>({
        mutationFn: (input) => interacaoService.criarFeedback(input),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: ['interacoes', variables.contatoId] })
        },
    })
}

export type { Interacao, Canal }
