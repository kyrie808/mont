import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface CampanhaOption {
    id: string
    nome: string
}

/**
 * Campanhas ativas (tabela `campanhas`), ordenadas por nome.
 * Usadas no cadastro de cliente (origem = 'anuncio'). Cadastráveis inline
 * pelo próprio formulário via `criar`.
 */
export function useCampanhas() {
    const queryClient = useQueryClient()

    const query = useQuery<CampanhaOption[]>({
        queryKey: ['campanhas'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('campanhas')
                .select('id, nome')
                .eq('ativo', true)
                .order('nome')
            if (error) throw error
            return data ?? []
        },
        staleTime: Infinity,
    })

    const criar = useMutation({
        mutationFn: async (nome: string): Promise<CampanhaOption> => {
            const nomeLimpo = nome.trim()
            if (!nomeLimpo) throw new Error('Informe o nome da campanha')
            const { data, error } = await supabase
                .from('campanhas')
                .insert({ nome: nomeLimpo })
                .select('id, nome')
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
