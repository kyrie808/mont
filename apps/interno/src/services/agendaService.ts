import { z } from 'zod'
import type { ItemAgenda, ItemSemData, LembreteInsert } from '@mont/shared'
import { supabase } from '../lib/supabase'
import { itemAgendaSchema, itemSemDataSchema, type NovoLembrete } from '../schemas/agenda'
import { filtroBuscaContato } from '../utils/telefone'

// A Agenda lê SÓ as funções do banco (agenda_itens / agenda_atrasados / agenda_sem_data):
// a tela não recalcula valor, atraso nem quem é dono da cobrança. A escrita é só na
// tabela lembretes; o banco carimba auditoria, conclusão e o contador de reagendamentos.

const listaItens = z.array(itemAgendaSchema)
const listaSemData = z.array(itemSemDataSchema)

/** Cliente na busca da criação rápida — com o que a tela precisa para avisar. */
export interface ClienteAgenda {
    id: string
    nome: string
    telefone: string
    cobranca_suspensa: boolean
}

/** Venda em aberto de um cliente, para ligar o lembrete. */
export interface VendaEmAberto {
    id: string
    data: string
    forma_pagamento: string
    status: string
    emAberto: number
    data_prevista_pagamento: string | null
}

export const agendaService = {
    async itens(inicio: string, fim: string): Promise<ItemAgenda[]> {
        const { data, error } = await supabase.rpc('agenda_itens', { p_inicio: inicio, p_fim: fim })
        if (error) throw error
        return listaItens.parse(data ?? [])
    },

    async atrasados(): Promise<ItemAgenda[]> {
        const { data, error } = await supabase.rpc('agenda_atrasados')
        if (error) throw error
        return listaItens.parse(data ?? [])
    },

    async semData(): Promise<ItemSemData[]> {
        const { data, error } = await supabase.rpc('agenda_sem_data')
        if (error) throw error
        return listaSemData.parse(data ?? [])
    },

    async criarLembrete(novo: NovoLembrete): Promise<string> {
        const linha: LembreteInsert = {
            titulo: novo.titulo,
            data: novo.data,
            hora: novo.hora,
            tipo: novo.tipo,
            descricao: novo.descricao || null,
            contato_id: novo.contato_id,
            venda_id: novo.venda_id,
            responsavel: novo.responsavel,
            valor: novo.valor,
            origem: 'manual',
        }
        const { data, error } = await supabase.from('lembretes').insert(linha).select('id').single()
        if (error) throw error
        return data.id
    },

    async concluir(id: string): Promise<void> {
        const { error } = await supabase.from('lembretes').update({ situacao: 'feito' }).eq('id', id)
        if (error) throw error
    },

    async reabrir(id: string): Promise<void> {
        const { error } = await supabase.from('lembretes').update({ situacao: 'pendente' }).eq('id', id)
        if (error) throw error
    },

    /** Muda a data; o banco soma 1 em vezes_reagendado quando o lembrete está pendente. */
    async reagendar(id: string, novaData: string): Promise<void> {
        const { error } = await supabase.from('lembretes').update({ data: novaData }).eq('id', id)
        if (error) throw error
    },

    async excluir(id: string): Promise<void> {
        const { error } = await supabase.from('lembretes').delete().eq('id', id)
        if (error) throw error
    },

    async buscarClientes(termo: string): Promise<ClienteAgenda[]> {
        const filtro = filtroBuscaContato(termo)
        if (!filtro) return []
        const { data, error } = await supabase
            .from('contatos')
            .select('id, nome, telefone, cobranca_suspensa')
            .is('arquivado_em', null)
            .or(filtro)
            .order('nome')
            .limit(8)
        if (error) throw error
        return data ?? []
    },

    async cliente(id: string): Promise<ClienteAgenda | null> {
        const { data, error } = await supabase
            .from('contatos')
            .select('id, nome, telefone, cobranca_suspensa')
            .eq('id', id)
            .maybeSingle()
        if (error) throw error
        return data
    },

    /** Vendas não pagas, não canceladas e não brinde do cliente — as que podem ganhar um lembrete. */
    async vendasEmAberto(contatoId: string): Promise<VendaEmAberto[]> {
        const { data, error } = await supabase
            .from('vendas')
            .select('id, data, forma_pagamento, status, total, valor_pago, data_prevista_pagamento')
            .eq('contato_id', contatoId)
            .eq('pago', false)
            .neq('status', 'cancelada')
            .neq('forma_pagamento', 'brinde')
            .order('data', { ascending: false })
        if (error) throw error
        return (data ?? []).map((v) => ({
            id: v.id,
            data: v.data,
            forma_pagamento: v.forma_pagamento,
            status: v.status,
            emAberto: v.total - (v.valor_pago ?? 0),
            data_prevista_pagamento: v.data_prevista_pagamento,
        }))
    },
}
