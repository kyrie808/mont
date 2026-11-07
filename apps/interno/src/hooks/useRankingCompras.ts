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

/** KPIs do ranking no período, somados no banco sobre TODOS os clientes do ranking. */
export interface RankingComprasResumo {
    totalClientes: number
    somaPontos: number
    totalCompras: number
}

const RESUMO_VAZIO: RankingComprasResumo = { totalClientes: 0, somaPontos: 0, totalCompras: 0 }

/**
 * Ranking de Compras (programa de pontos). Fonte única: RPC `rpc_ranking_compras` (recorte
 * opcional de mês). Vem do banco só o top N que a página mostra; os KPIs (clientes, pontos,
 * compras) saem de `rpc_ranking_compras_resumo`, somados lá sobre o conjunto inteiro — a lista
 * completa passa de 800 linhas e o PostgREST corta em 1000.
 */
export function useRankingCompras(periodo: RankingPeriodo = { ano: null, mes: null }, limite: number) {
    const { ano, mes } = periodo
    const args = { p_ano: ano ?? undefined, p_mes: mes ?? undefined }

    const resumoQuery = useQuery({
        queryKey: ['ranking-compras', 'resumo', ano, mes],
        queryFn: async (): Promise<RankingComprasResumo> => {
            const { data, error } = await supabase.rpc('rpc_ranking_compras_resumo', args)
            if (error) throw error
            const r = data?.[0]
            return r
                ? { totalClientes: Number(r.total_clientes) || 0, somaPontos: Number(r.soma_pontos) || 0, totalCompras: Number(r.total_compras) || 0 }
                : RESUMO_VAZIO
        },
        staleTime: 1000 * 60 * 5,
        placeholderData: (prev) => prev,
    })

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['ranking-compras', 'top', ano, mes, limite],
        queryFn: async (): Promise<RankingComprasStats[]> => {
            const { data, error } = await supabase
                .rpc('rpc_ranking_compras', args)
                .order('total_pontos', { ascending: false })
                .limit(limite)
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
        resumo: resumoQuery.data ?? RESUMO_VAZIO,
        loading: isLoading || resumoQuery.isLoading,
        error: error || resumoQuery.error ? 'Erro ao carregar ranking de compras' : null,
        refetch,
    }
}
