import { supabase } from '../lib/supabase'
import type { Database } from '@mont/shared'

/** Uma entrega curada, exatamente como a RPC entregador_minhas_entregas devolve. */
export type Entrega = Database['public']['Functions']['entregador_minhas_entregas']['Returns'][number]

/** Um repasse que a Mont pagou ao entregador (RPC entregador_meus_repasses). */
export type Repasse = Database['public']['Functions']['entregador_meus_repasses']['Returns'][number]

export const entregasService = {
    async listar(): Promise<Entrega[]> {
        const { data, error } = await supabase.rpc('entregador_minhas_entregas')
        if (error) throw error
        return data ?? []
    },

    /** Baixa "recebido em dinheiro" (única escrita financeira do entregador). */
    async marcarRecebidoDinheiro(vendaId: string): Promise<void> {
        const { error } = await supabase.rpc('entregador_marcar_recebido_dinheiro', { p_venda_id: vendaId })
        if (error) throw error
    },

    /** Confirma a entrega → vira status='entregue' de verdade no sistema. */
    async marcarEntregue(vendaId: string): Promise<void> {
        const { error } = await supabase.rpc('entregador_marcar_entregue', { p_venda_id: vendaId })
        if (error) throw error
    },

    /** Salva a observação/declaração do entregador na entrega (via RPC própria). */
    async salvarNota(vendaId: string, nota: string): Promise<void> {
        const { error } = await supabase.rpc('entregador_salvar_nota', {
            p_venda_id: vendaId,
            p_nota: nota,
        })
        if (error) throw error
    },

    /** Perfil do entregador logado (lê a própria linha — policy own-row do Stage 0). */
    async meuPerfil(): Promise<{ nome: string; repasse_por_entrega: number } | null> {
        const { data: userData } = await supabase.auth.getUser()
        const uid = userData.user?.id
        if (!uid) return null
        const { data, error } = await supabase
            .from('entregadores')
            .select('nome, repasse_por_entrega')
            .eq('user_id', uid)
            .maybeSingle()
        if (error) throw error
        return data
    },

    /** Repasses que a Mont já pagou a ele (pra aba Ganhos). Curado via RPC. */
    async meusRepasses(): Promise<Repasse[]> {
        const { data, error } = await supabase.rpc('entregador_meus_repasses')
        if (error) throw error
        return data ?? []
    },

    /** Signed URL do comprovante (o entregador lê só a própria pasta — RLS do bucket). */
    async comprovanteUrl(path: string): Promise<string> {
        const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(path, 3600)
        if (error) throw error
        return data.signedUrl
    },
}
