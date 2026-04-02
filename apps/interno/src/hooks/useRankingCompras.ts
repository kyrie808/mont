import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface RankingComprasStats {
    contatoId: string
    nome: string
    totalPontos: number
    totalCompras: number
    ultimaCompra: string | null
    ranking: number
}

interface UseRankingComprasReturn {
    rankingCompras: RankingComprasStats[]
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function useRankingCompras(): UseRankingComprasReturn {
    const [rankingCompras, setRankingCompras] = useState<RankingComprasStats[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchRankingCompras = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: fetchError } = await supabase
                .from('ranking_compras')
                .select('contato_id, nome, total_pontos, total_compras, ultima_compra')
                .order('total_pontos', { ascending: false })
                .limit(10)

            if (fetchError) throw fetchError

            const stats: RankingComprasStats[] = data.map((item, index) => ({
                contatoId: item.contato_id as string,
                nome: item.nome as string,
                totalPontos: item.total_pontos || 0,
                totalCompras: item.total_compras || 0,
                ultimaCompra: item.ultima_compra,
                ranking: index + 1
            }))

            setRankingCompras(stats)
        } catch (err) {
            console.error(err)
            setError('Erro ao carregar ranking de compras')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRankingCompras()
    }, [fetchRankingCompras])

    return {
        rankingCompras,
        loading,
        error,
        refetch: fetchRankingCompras
    }
}
