import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/** Um contato trazido por um indicador, com o que ele gastou (produto). */
export interface IndicadoDetalhe {
    contatoId: string
    nome: string
    totalCompras: number
    totalGasto: number
    ultimaCompra: string | null
    comprou: boolean
}

const EMPTY: IndicadoDetalhe[] = []

/**
 * Drill-down: os contatos que UMA pessoa indicou, com o gasto de cada um.
 * Fonte: RPC `rpc_indicados_do_indicador` (produto-only, mesma regra do ranking).
 * `enabled` só dispara quando há um id — usado no expand do ranking e no perfil.
 */
export function useIndicadosDoIndicador(indicadorId: string | null) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['indicados-do-indicador', indicadorId],
        enabled: !!indicadorId,
        queryFn: async (): Promise<IndicadoDetalhe[]> => {
            const { data, error } = await supabase.rpc('rpc_indicados_do_indicador', {
                p_indicador_id: indicadorId as string,
            })
            if (error) throw error
            return (data ?? []).map((r) => ({
                contatoId: r.contato_id,
                nome: r.nome,
                totalCompras: Number(r.total_compras) || 0,
                totalGasto: Number(r.total_gasto) || 0,
                ultimaCompra: r.ultima_compra,
                comprou: r.comprou,
            }))
        },
        staleTime: 1000 * 60 * 5,
    })

    return { indicados: data ?? EMPTY, loading: isLoading, error: error ? 'Erro ao carregar indicados' : null }
}
