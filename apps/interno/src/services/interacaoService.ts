import type { Database } from '@mont/shared'
import { supabase } from '../lib/supabase'

export type Interacao = Database['public']['Tables']['interacoes']['Row']

class InteracaoService {
    async getByContato(contatoId: string): Promise<Interacao[]> {
        const { data, error } = await supabase
            .from('interacoes')
            .select('*')
            .eq('contato_id', contatoId)
            .order('data', { ascending: false })

        if (error) {
            throw new Error(`Erro ao carregar interações: ${error.message}`)
        }

        return data ?? []
    }
}

export const interacaoService = new InteracaoService()
