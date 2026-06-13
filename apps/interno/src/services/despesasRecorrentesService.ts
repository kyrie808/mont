import { supabase } from '../lib/supabase'
import type { Database } from '@mont/shared'

type DespesaRecorrenteRow = Database['public']['Tables']['despesas_recorrentes']['Row']
type DespesaRecorrenteInsert = Database['public']['Tables']['despesas_recorrentes']['Insert']
type DespesaRecorrenteUpdate = Database['public']['Tables']['despesas_recorrentes']['Update']

/** Template de despesa fixa + nome da categoria (join), consumido pela seção "Fixas". */
export interface DespesaRecorrenteWithCategoria extends DespesaRecorrenteRow {
    plano_de_contas: { nome: string } | null
}

export const despesasRecorrentesService = {
    async getRecorrentes(): Promise<DespesaRecorrenteWithCategoria[]> {
        const { data, error } = await supabase
            .from('despesas_recorrentes')
            .select('*, plano_de_contas(nome)')
            .order('descricao', { ascending: true })

        if (error) throw error
        return data || []
    },

    async createRecorrente(payload: DespesaRecorrenteInsert): Promise<DespesaRecorrenteRow> {
        const { data, error } = await supabase
            .from('despesas_recorrentes')
            .insert(payload)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async updateRecorrente(id: string, patch: DespesaRecorrenteUpdate): Promise<DespesaRecorrenteRow> {
        const { data, error } = await supabase
            .from('despesas_recorrentes')
            .update(patch)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async deleteRecorrente(id: string): Promise<void> {
        const { error } = await supabase
            .from('despesas_recorrentes')
            .delete()
            .eq('id', id)

        if (error) throw error
    },

    /** Materializa (idempotente) as ocorrências do mês informado. Retorna quantas foram criadas. */
    async gerarDoMes(competencia: string): Promise<number> {
        const { data, error } = await supabase.rpc('gerar_despesas_recorrentes', {
            p_competencia: competencia,
        })
        if (error) throw error
        return (data as number) ?? 0
    },
}
