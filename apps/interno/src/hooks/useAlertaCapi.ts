import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * "Envio para o Meta parado" no sino do Dashboard.
 *
 * Existe por causa de um apagão real: entre 07 e 10/08/2026 a fila `meta_eventos`
 * parou de escoar e NINGUÉM percebeu por 3 dias. Um deploy de Edge Function ligou o
 * `verify_jwt`, o gateway do Supabase passou a devolver 401 antes do worker rodar, e
 * 25 vendas (R$ 1.485) ficaram sem chegar à Meta.
 *
 * O que torna esse tipo de falha traiçoeiro é que ela é MUDA: o `cron.job_run_details`
 * marca sucesso (o pg_net só enfileira a requisição; o 401 vem depois), e a resposta
 * HTTP some do banco em ~6h. Não havia como saber sem ir procurar.
 *
 * Este alerta é a rede. Não é acionável pelo Gilmar — ele não conserta cron —, mas ele
 * é quem abre o Dashboard todo dia, então é o único lugar onde o aviso é visto a tempo
 * de alguém agir. Sem faturamento errado na tela, só a campanha otimizando às cegas.
 *
 * Limiar de 24h porque o worker roda 1x/dia (06:00). Evento criado hoje à tarde está
 * pendente por projeto, não por falha — só vira alerta quando perde a janela seguinte.
 */
export interface AlertaCapi {
    pendentes: number
    /** Dias desde o evento pendente mais antigo. */
    dias_parado: number
    /** Soma em R$ das conversões que não chegaram à Meta. */
    valor_represado: number
}

/** Horas de fila parada a partir das quais vira alerta (o worker roda 1x/dia). */
export const HORAS_PARA_ALERTAR = 24

export function useAlertaCapi() {
    const { data, refetch } = useQuery({
        queryKey: ['alerta-capi'],
        queryFn: async (): Promise<AlertaCapi | null> => {
            const limite = new Date(Date.now() - HORAS_PARA_ALERTAR * 3_600_000).toISOString()

            // `meta_eventos` é admin-only na RLS; entregador/cliente nunca lê.
            const { data, error } = await supabase
                .from('meta_eventos')
                .select('criado_em, valor')
                .eq('status', 'pendente')
                .lt('criado_em', limite)
                .order('criado_em', { ascending: true })

            if (error) throw error
            if (!data || data.length === 0) return null

            const maisAntigo = new Date(data[0].criado_em).getTime()

            return {
                pendentes: data.length,
                dias_parado: Math.floor((Date.now() - maisAntigo) / 86_400_000),
                valor_represado: data.reduce((s, e) => s + Number(e.valor ?? 0), 0),
            }
        },
        staleTime: 1000 * 60 * 15,
    })

    const alerta = data ?? null
    // Conta como 1 no badge: é um aviso de sistema, não uma lista de tarefas.
    return { alerta, count: alerta ? 1 : 0, refetch }
}
