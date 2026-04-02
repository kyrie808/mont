import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface IndicadorStats {
    indicadorId: string
    nome: string
    totalIndicados: number
    totalVendasIndicados: number
    ranking: number
}

interface UseTopIndicadoresReturn {
    topIndicadores: IndicadorStats[]
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function useTopIndicadores(enabled: boolean = true): UseTopIndicadoresReturn {
    const [topIndicadores, setTopIndicadores] = useState<IndicadorStats[]>([])
    const [loading, setLoading] = useState(enabled)
    const [error, setError] = useState<string | null>(null)

    const fetchTopIndicadores = useCallback(async () => {
        if (!enabled) return

        setLoading(true)
        setError(null)

        try {
            const { data, error: fetchError } = await (supabase
                .from('ranking_indicacoes'))
                .select('indicador_id, nome, total_indicados, total_vendas_indicados')
                .order('total_indicados', { ascending: false })
                .limit(10)

            if (fetchError) throw fetchError

            const stats: IndicadorStats[] = (data || []).map((item, index: number) => ({
                indicadorId: (item as Record<string, unknown>).indicador_id as string || '',
                nome: (item as Record<string, unknown>).nome as string || 'Indicador sem nome',
                totalIndicados: (item as Record<string, unknown>).total_indicados as number || 0,
                totalVendasIndicados: Number((item as Record<string, unknown>).total_vendas_indicados) || 0,
                ranking: index + 1
            }))

            setTopIndicadores(stats)
        } catch (err) {
            console.error(err)
            setError('Erro ao carregar ranking de indicações')
        } finally {
            setLoading(false)
        }
    }, [enabled])

    useEffect(() => {
        fetchTopIndicadores()
    }, [fetchTopIndicadores])

    return {
        topIndicadores,
        loading,
        error,
        refetch: fetchTopIndicadores
    }
}
