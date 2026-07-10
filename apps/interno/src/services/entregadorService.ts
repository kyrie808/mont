import { supabase } from '../lib/supabase'

export interface EntregadorOption {
    id: string
    nome: string
}

export const entregadorService = {
    /** Entregadores ativos, para o seletor de atribuição no checkout. Admin lê via RLS. */
    async listAtivos(): Promise<EntregadorOption[]> {
        const { data, error } = await supabase
            .from('entregadores')
            .select('id, nome')
            .eq('ativo', true)
            .order('nome', { ascending: true })
        if (error) throw error
        return (data ?? []) as EntregadorOption[]
    },
}
