import type { Database } from '@mont/shared'
import { supabase } from '../lib/supabase'

export type Interacao = Database['public']['Tables']['interacoes']['Row']
export type Canal = 'google' | 'instagram' | 'whatsapp' | 'outro'

interface CriarFeedbackInput {
    contatoId: string
    canal: Canal
    texto: string
}

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

    async criarFeedback({ contatoId, canal, texto }: CriarFeedbackInput): Promise<void> {
        const insert: Database['public']['Tables']['interacoes']['Insert'] = {
            contato_id: contatoId,
            tipo: 'feedback',
            canal,
            observacao: texto,
            resultado: null,
        }
        const { error } = await supabase.from('interacoes').insert(insert)
        if (error) {
            throw new Error(`Erro ao registrar feedback: ${error.message}`)
        }
    }
}

export const interacaoService = new InteracaoService()
