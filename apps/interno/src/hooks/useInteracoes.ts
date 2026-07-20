import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interacaoService, type Interacao, type Canal, type ResultadoPontoContato } from '../services/interacaoService'

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

interface RegistrarPontoContatoInput {
    contatoId: string
    canal: Canal
    resultado: ResultadoPontoContato | null // null = Aguardando
    observacao?: string
    data?: string // ISO
    campanhaId?: string
}

export function useRegistrarPontoContato() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, RegistrarPontoContatoInput>({
        mutationFn: (input) => interacaoService.criarPontoContato(input),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: ['interacoes', variables.contatoId] })
            // Trigger assistido moveu a coluna do card → refetch do kanban.
            void queryClient.invalidateQueries({ queryKey: ['relacionamento_kanban'] })
        },
    })
}

interface AtualizarPontoContatoInput extends RegistrarPontoContatoInput {
    id: string
}

export function useAtualizarPontoContato() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, AtualizarPontoContatoInput>({
        mutationFn: ({ id, canal, resultado, observacao, data }) =>
            interacaoService.atualizarPontoContato(id, { canal, resultado, observacao, data }),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: ['interacoes', variables.contatoId] })
            void queryClient.invalidateQueries({ queryKey: ['relacionamento_kanban'] })
        },
    })
}

export function useExcluirInteracao() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, { id: string; contatoId: string }>({
        mutationFn: ({ id }) => interacaoService.excluirInteracao(id),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: ['interacoes', variables.contatoId] })
        },
    })
}

export type { Interacao, Canal, ResultadoPontoContato }
