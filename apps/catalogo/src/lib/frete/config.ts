import { supabaseAdmin } from '@/lib/supabase/admin'
import type { FreteConfig } from './types'

/** Lê a config de frete (configuracoes.chave='frete_config'). null se não existir. */
export async function getFreteConfig(): Promise<FreteConfig | null> {
    const { data, error } = await supabaseAdmin
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'frete_config')
        .maybeSingle()

    if (error || !data?.valor) return null
    return data.valor as unknown as FreteConfig
}
