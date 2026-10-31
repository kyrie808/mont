import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { produtoService } from '../services/produtoService'
import type { CreateProduto, UpdateProduto } from '../types/domain'
import type { MapaPrecos } from '../utils/tabelaPreco'

// Referência estável enquanto carrega: evita recalcular o carrinho a cada render.
const SEM_PRECOS: MapaPrecos = new Map()

export function useProdutos(includeInactive: boolean = false) {
    const queryClient = useQueryClient()

    const { data: produtos, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['produtos', includeInactive],
        queryFn: () => produtoService.getAll(includeInactive),
    })

    const createMutation = useMutation({
        mutationFn: (data: CreateProduto) => produtoService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] })
            // seção/visibilidade do produto muda o conjunto de órfãos do Catálogo
            queryClient.invalidateQueries({ queryKey: ['produtos-orfaos'] })
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: UpdateProduto }) =>
            produtoService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] })
            queryClient.invalidateQueries({ queryKey: ['produtos-orfaos'] })
        }
    })

    const updateEstoqueMutation = useMutation({
        mutationFn: ({ id, quantidade }: { id: string, quantidade: number }) =>
            produtoService.updateEstoque(id, quantidade),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] })
        }
    })

    const createProduto = useCallback(async (data: CreateProduto) => {
        return createMutation.mutateAsync(data)
    }, [createMutation])

    const updateProduto = useCallback(async (id: string, data: UpdateProduto) => {
        return updateMutation.mutateAsync({ id, data })
    }, [updateMutation])

    const updateEstoque = useCallback(async (id: string, quantidade: number) => {
        return updateEstoqueMutation.mutateAsync({ id, quantidade })
    }, [updateEstoqueMutation])

    return {
        produtos: produtos || [],
        loading,
        error: error ? (error as Error).message : null,
        refetch,
        createProduto,
        updateProduto,
        updateEstoque
    }
}

/** Ids dos combos com escolha de sabor (só a loja vende). Vazio enquanto carrega. */
export function useCombosMontagem() {
    const { data, isLoading: loading } = useQuery({
        queryKey: ['combos-montagem'],
        queryFn: () => produtoService.getCombosMontagem(),
    })

    return { combos: data ?? [], loading }
}

/** Preço de cada produto nas três tabelas (Pix/dinheiro, cartão, normal) + a campanha vigente. */
export function usePrecosVigentes() {
    const { data, isLoading: loading } = useQuery({
        queryKey: ['precos-vigentes'],
        queryFn: () => produtoService.getPrecosVigentes(),
        // A campanha vira à meia-noite: rebusca a cada 5 min e ao voltar para a aba.
        staleTime: 1000 * 60 * 5,
        refetchInterval: 1000 * 60 * 5,
    })

    return { precos: data?.precos ?? SEM_PRECOS, campanha: data?.campanha ?? null, loading }
}

const SEM_NOMES = new Map<string, string>()

/** Nome de cada produto pedido (só busca quando há ids). */
export function useNomesProdutos(ids: string[]) {
    const chave = [...new Set(ids)].sort()
    const { data } = useQuery({
        queryKey: ['nomes-produtos', chave],
        queryFn: () => produtoService.getNomes(chave),
        enabled: chave.length > 0,
        staleTime: 1000 * 60 * 30,
    })
    return data ?? SEM_NOMES
}

export function useProduto(id: string | undefined) {
    const { data: produto, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['produto', id],
        queryFn: () => id ? produtoService.getById(id) : null,
        enabled: !!id,
    })

    return {
        produto: produto || null,
        loading,
        error: error ? (error as Error).message : null,
        refetch
    }
}
