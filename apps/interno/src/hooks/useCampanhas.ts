import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { campanhaService } from '../services/campanhaService'

export interface CampanhaOption {
    id: string
    nome: string
    tipo: string
}

/** Contexto de uso: aquisição (cadastro) mostra tipo aquisicao|ambos;
 *  promoção (kanban) mostra promocao|ambos. */
export type FiltroCampanha = 'aquisicao' | 'promocao'

/**
 * Campanhas ativas (`campanhas`), opcionalmente filtradas pelo tipo do contexto e pela
 * origem. Tráfego vem da Meta (`origem: 'meta'`, não cadastrável à mão); promoção é
 * interna (`origem: 'interna'`, cadastrável inline via `criar`).
 */
export function useCampanhas(filtro?: FiltroCampanha, opts?: { origem?: 'interna' | 'meta' }) {
    const queryClient = useQueryClient()
    const origem = opts?.origem
    const tiposVisiveis = filtro === 'aquisicao' ? ['aquisicao', 'ambos']
        : filtro === 'promocao' ? ['promocao', 'ambos'] : null

    const query = useQuery<CampanhaOption[]>({
        queryKey: ['campanhas', filtro ?? 'todas', origem ?? 'qq'],
        queryFn: async () => {
            let q = supabase.from('campanhas').select('id, nome, tipo').eq('ativo', true).order('nome')
            if (tiposVisiveis) q = q.in('tipo', tiposVisiveis)
            if (origem) q = q.eq('origem_campanha', origem)
            const { data, error } = await q
            if (error) throw error
            return data ?? []
        },
        staleTime: Infinity,
    })

    const criar = useMutation({
        mutationFn: async (nome: string): Promise<CampanhaOption> => {
            const nomeLimpo = nome.trim()
            if (!nomeLimpo) throw new Error('Informe o nome da campanha')
            const tipo = filtro === 'promocao' ? 'promocao' : 'aquisicao'
            const { data, error } = await supabase
                .from('campanhas')
                .insert({ nome: nomeLimpo, tipo })
                .select('id, nome, tipo')
                .single()
            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campanhas'] })
        },
    })

    return { ...query, criar }
}

/** Dispara o sync das campanhas de tráfego da Meta e revalida as listas. */
export function useSincronizarCampanhasMeta() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => campanhaService.sincronizarMeta(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['campanhas'] })
            void queryClient.invalidateQueries({ queryKey: ['relatorio', 'campanhas'] })
        },
    })
}

// ── Participação promocional (contato_campanhas) ────────────────────────────────

export interface ContatoCampanhaEntry {
    contato_id: string
    campanha_id: string
    nome: string
}

/** Todas as participações promocionais (cliente ↔ campanha), com o nome da campanha. */
export function useContatoCampanhas() {
    return useQuery<ContatoCampanhaEntry[]>({
        queryKey: ['contato_campanhas'],
        queryFn: async () => {
            const { data: rows, error } = await supabase
                .from('contato_campanhas')
                .select('contato_id, campanha_id')
            if (error) throw error
            if (!rows || rows.length === 0) return []

            const ids = [...new Set(rows.map((r) => r.campanha_id))]
            const { data: camps, error: e2 } = await supabase
                .from('campanhas')
                .select('id, nome')
                .in('id', ids)
            if (e2) throw e2

            const map = new Map((camps ?? []).map((c) => [c.id, c.nome]))
            return rows.map((r) => ({ contato_id: r.contato_id, campanha_id: r.campanha_id, nome: map.get(r.campanha_id) ?? '—' }))
        },
        staleTime: 1000 * 60,
    })
}

interface ParticipacaoInput {
    contatoId: string
    campanhaId: string
}

export function useAplicarCampanha() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, ParticipacaoInput>({
        mutationFn: async ({ contatoId, campanhaId }) => {
            const { error } = await supabase
                .from('contato_campanhas')
                .insert({ contato_id: contatoId, campanha_id: campanhaId })
            if (error && error.code !== '23505') throw new Error(error.message) // ignora duplicata
        },
        onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['contato_campanhas'] }) },
    })
}

export function useRemoverCampanha() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, ParticipacaoInput>({
        mutationFn: async ({ contatoId, campanhaId }) => {
            const { error } = await supabase
                .from('contato_campanhas')
                .delete()
                .eq('contato_id', contatoId)
                .eq('campanha_id', campanhaId)
            if (error) throw new Error(error.message)
        },
        onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['contato_campanhas'] }) },
    })
}
