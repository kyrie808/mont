import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface RankingComprasStats {
    contatoId: string
    nome: string
    /** Pontos = R$1 gasto em PRODUTO (frete não conta). Programa Embaixadores. */
    totalPontos: number
    totalCompras: number
    ultimaCompra: string | null
    ranking: number
}

/** Período do ranking. `null/null` = geral (all-time); com ano+mês = só aquele mês. */
export interface RankingPeriodo {
    ano: number | null
    mes: number | null
}

const EMPTY: RankingComprasStats[] = []

/**
 * Ranking de Compras (programa de pontos). Fonte única: RPC `rpc_ranking_compras`,
 * que aceita recorte opcional de mês e devolve TODOS os contatos ordenados por pontos
 * (a página fatia o top-N e calcula os KPIs sobre o conjunto real).
 */
export function useRankingCompras(periodo: RankingPeriodo = { ano: null, mes: null }) {
    const { ano, mes } = periodo
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['ranking-compras', ano, mes],
        queryFn: async (): Promise<RankingComprasStats[]> => {
            const { data, error } = await supabase.rpc('rpc_ranking_compras', {
                p_ano: ano ?? undefined,
                p_mes: mes ?? undefined,
            })
            if (error) throw error
            return (data ?? []).map((item, index) => ({
                contatoId: item.contato_id,
                nome: item.nome,
                totalPontos: Number(item.total_pontos) || 0, // numeric volta como string
                totalCompras: Number(item.total_compras) || 0,
                ultimaCompra: item.ultima_compra,
                ranking: index + 1,
            }))
        },
        staleTime: 1000 * 60 * 5,
        placeholderData: (prev) => prev, // mantém a lista anterior ao trocar mês/geral (sem flash)
    })

    return {
        rankingCompras: data ?? EMPTY,
        loading: isLoading,
        error: error ? 'Erro ao carregar ranking de compras' : null,
        refetch,
    }
}
