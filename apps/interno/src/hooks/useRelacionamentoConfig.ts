import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface RelacionamentoConfig {
    janelaRespostaHoras: number
    limiarReativacao: number
    multiplicadorSumido: number
}

const DEFAULTS: RelacionamentoConfig = { janelaRespostaHoras: 24, limiarReativacao: 30, multiplicadorSumido: 1.5 }

/** Config do relacionamento (janela de resposta, limiar de reativação…) — leitura. */
export function useRelacionamentoConfig(): RelacionamentoConfig {
    const { data } = useQuery({
        queryKey: ['config', 'relacionamento'],
        queryFn: async (): Promise<RelacionamentoConfig> => {
            const { data, error } = await supabase
                .from('configuracoes').select('valor').eq('chave', 'relacionamento').maybeSingle()
            if (error) throw error
            const v = (data?.valor ?? {}) as Record<string, unknown>
            return {
                janelaRespostaHoras: Number(v.janela_resposta_horas) || DEFAULTS.janelaRespostaHoras,
                limiarReativacao: Number(v.limiar_reativacao) || DEFAULTS.limiarReativacao,
                multiplicadorSumido: Number(v.multiplicador_sumido) || DEFAULTS.multiplicadorSumido,
            }
        },
        staleTime: 1000 * 60 * 10,
    })
    return data ?? DEFAULTS
}
