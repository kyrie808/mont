import type { Database } from '@mont/shared'
import { supabase } from '../lib/supabase'

export type Interacao = Database['public']['Tables']['interacoes']['Row']
export type Canal = 'google' | 'instagram' | 'whatsapp' | 'outro'
export type ResultadoPontoContato = 'respondeu' | 'sem_resposta' | 'aceitou' | 'recusou'

interface CriarFeedbackInput {
    contatoId: string
    canal: Canal
    texto: string
}

interface CriarPontoContatoInput {
    contatoId: string
    canal: Canal
    resultado: ResultadoPontoContato
    observacao?: string
    data?: string // ISO; omitido → default now() do banco
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

    async criarPontoContato({ contatoId, canal, resultado, observacao, data }: CriarPontoContatoInput): Promise<void> {
        const insert: Database['public']['Tables']['interacoes']['Insert'] = {
            contato_id: contatoId,
            tipo: 'ponto_contato',
            canal,
            resultado,
            observacao: observacao ?? null,
            ...(data ? { data } : {}),
        }
        const { error } = await supabase.from('interacoes').insert(insert)
        if (error) {
            throw new Error(`Erro ao registrar ponto de contato: ${error.message}`)
        }
    }

    async atualizarPontoContato(
        id: string,
        { canal, resultado, observacao, data }: Omit<CriarPontoContatoInput, 'contatoId'>,
    ): Promise<void> {
        const update: Database['public']['Tables']['interacoes']['Update'] = {
            canal,
            resultado,
            observacao: observacao ?? null,
            ...(data ? { data } : {}),
        }
        const { error } = await supabase.from('interacoes').update(update).eq('id', id)
        if (error) {
            throw new Error(`Erro ao atualizar contato: ${error.message}`)
        }
    }

    async excluirInteracao(id: string): Promise<void> {
        const { error } = await supabase.from('interacoes').delete().eq('id', id)
        if (error) {
            throw new Error(`Erro ao excluir interação: ${error.message}`)
        }
    }
}

export const interacaoService = new InteracaoService()
