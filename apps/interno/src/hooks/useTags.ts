import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tagService, type Tag, type ContatoTagEntry } from '../services/tagService'

export function useTags() {
    return useQuery<Tag[]>({
        queryKey: ['tags'],
        queryFn: () => tagService.listTags(),
        staleTime: 1000 * 60 * 5,
    })
}

export function useContatoTags() {
    return useQuery<ContatoTagEntry[]>({
        queryKey: ['contato_tags'],
        queryFn: () => tagService.listContatoTags(),
        staleTime: 1000 * 60,
    })
}

interface CriarTagInput {
    nome: string
    cor: string
}

export function useCriarTag() {
    const queryClient = useQueryClient()
    return useMutation<Tag, Error, CriarTagInput>({
        mutationFn: (input) => tagService.criarTag(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['tags'] })
        },
    })
}

export interface TagContatoInput {
    contatoId: string
    tagId: string
}

export function useAplicarTag() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, TagContatoInput>({
        mutationFn: (input) => tagService.aplicarTag(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['contato_tags'] })
        },
    })
}

export function useRemoverTag() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, TagContatoInput>({
        mutationFn: (input) => tagService.removerTag(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['contato_tags'] })
        },
    })
}

export type { Tag, ContatoTagEntry }
