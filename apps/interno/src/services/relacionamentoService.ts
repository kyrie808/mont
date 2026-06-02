import type { Database } from '@mont/shared'
import { supabase } from '../lib/supabase'

export type RelacionamentoAba = Database['public']['Enums']['enum_relacionamento_aba']
export type RelacionamentoStatus = Database['public']['Enums']['enum_relacionamento_status']
export type KanbanRow = Database['public']['Views']['view_relacionamento_kanban']['Row']

interface MoverCardInput {
    contatoId: string
    novoStatus: RelacionamentoStatus
    observacao?: string
}

export class RelacionamentoService {
    async getKanbanData(aba: RelacionamentoAba): Promise<KanbanRow[]> {
        const base = supabase
            .from('view_relacionamento_kanban')
            .select('*')
            .eq('aba_atual', aba)
            .is('arquivado_em', null)

        // recompra: mais atrasados primeiro; reativacao: mais tempo sem 2a compra primeiro
        const { data, error } = await (
            aba === 'recompra'
                ? base.order('atraso', { ascending: false, nullsFirst: false })
                : aba === 'reativacao'
                ? base.order('dias_sem_compra', { ascending: false, nullsFirst: false })
                : base.order('nome', { ascending: true })
        )

        if (error) {
            throw new Error(`Erro ao carregar Kanban de relacionamento: ${error.message}`)
        }

        return data ?? []
    }

    async moverCard(input: MoverCardInput): Promise<void> {
        const { contatoId, novoStatus, observacao } = input

        const { error } = await supabase.rpc('fn_mover_card_relacionamento', {
            p_contato_id: contatoId,
            p_novo_status: novoStatus,
            p_observacao: observacao ?? undefined,
        })

        if (error) {
            throw new Error(`Erro ao mover card no relacionamento: ${error.message}`)
        }
    }
}

export const relacionamentoService = new RelacionamentoService()
