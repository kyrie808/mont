import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface OrigemOption {
    slug: string
    label: string
}

/**
 * Lookup de origens ativas (tabela `origens`), ordenadas por `ordem`.
 * Compartilhado entre o cadastro de contato e o checkout de venda.
 * staleTime Infinity — lista praticamente estática.
 */
export function useOrigens() {
    return useQuery<OrigemOption[]>({
        queryKey: ['origens'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('origens')
                .select('slug, label')
                .eq('ativo', true)
                .order('ordem')
            if (error) throw error
            return data ?? []
        },
        staleTime: Infinity,
    })
}
