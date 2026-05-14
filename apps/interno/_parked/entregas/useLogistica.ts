import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logisticaService, type LogisticsMetrics } from '../services/logisticaService'

interface UseLogisticaReturn {
    metrics: LogisticsMetrics
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function useLogistica(): UseLogisticaReturn {
    const [metrics, setMetrics] = useState<LogisticsMetrics>({
        entregasPendentesTotal: 0,
        entregasRealizadasHoje: 0,
        entregasRealizadasTotal: 0,
        taxaEntregaHoje: 0
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchLogistics = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await logisticaService.getLogisticsMetrics()
            setMetrics(data)
        } catch (err) {
            console.error('Erro ao buscar logística:', err)
            setError('Falha ao carregar dados logísticos')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLogistics()
    }, [fetchLogistics])

    // Realtime subscription for logistics updates
    useEffect(() => {
        const channel = supabase
            .channel('logistica-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'vendas' },
                () => fetchLogistics()
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchLogistics])

    return { metrics, loading, error, refetch: fetchLogistics }
}
