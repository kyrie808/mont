import { supabase } from '../lib/supabase'

/** Resultado da sincronização de campanhas vindas da Meta (Edge Function meta-ads-sync). */
export interface SyncMetaResult {
    ok: boolean
    upserts?: number
    desativadas?: number
    metricas?: number
    error?: string
}

export const campanhaService = {
    /**
     * Dispara a sincronização das campanhas de tráfego direto da Meta.
     * Invoca a Edge Function `meta-ads-sync` (que lê a Marketing API com o token
     * ads_read e faz upsert em `campanhas` por `meta_campaign_id`).
     * Requer o token configurado como secret + admin autenticado.
     */
    async sincronizarMeta(): Promise<SyncMetaResult> {
        const { data, error } = await supabase.functions.invoke<SyncMetaResult>('meta-ads-sync', { body: {} })
        if (error) throw error
        if (data && data.ok === false) throw new Error(data.error || 'Falha ao sincronizar campanhas da Meta')
        return data ?? { ok: true }
    },
}
