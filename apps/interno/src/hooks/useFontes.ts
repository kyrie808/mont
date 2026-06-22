import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface FonteOption {
    slug: string
    label: string
}

/**
 * Lookup de fontes de anúncio ativas (tabela `fontes`), ordenadas por `ordem`.
 * Usado no cadastro de cliente (origem = 'anuncio') e na exibição do perfil.
 * Mesmo shape e padrão de [[useOrigens]].
 */
export function useFontes() {
    return useQuery<FonteOption[]>({
        queryKey: ['fontes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fontes')
                .select('slug, label')
                .eq('ativo', true)
                .order('ordem')
            if (error) throw error
            return data ?? []
        },
        staleTime: Infinity,
    })
}
