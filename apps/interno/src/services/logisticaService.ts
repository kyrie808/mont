import { supabase } from '../lib/supabase'
import { startOfDay, endOfDay } from 'date-fns'

export interface LogisticsMetrics {
    entregasPendentesTotal: number
    entregasRealizadasHoje: number
    entregasRealizadasTotal: number
    taxaEntregaHoje: number
}

export const logisticaService = {
    async getLogisticsMetrics(): Promise<LogisticsMetrics> {
        // 1. Fetch ALL pending deliveries (Global Backlog)
        const { count: pendingCount, error: pendingError } = await supabase
            .from('vendas')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pendente')
            .neq('status', 'cancelada')

        if (pendingError) throw pendingError

        // 2. Fetch deliveries completed TODAY
        const hoje = new Date()
        const startStr = startOfDay(hoje).toISOString()
        const endStr = endOfDay(hoje).toISOString()

        const { count: doneTodayCount, error: doneError } = await supabase
            .from('vendas')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'entregue')
            .gte('data', startStr)
            .lte('data', endStr)

        if (doneError) throw doneError

        const totalWorkload = (doneTodayCount || 0) + (pendingCount || 0)
        const rate = totalWorkload > 0 ? ((doneTodayCount || 0) / totalWorkload) * 100 : 0

        return {
            entregasPendentesTotal: pendingCount || 0,
            entregasRealizadasHoje: doneTodayCount || 0,
            entregasRealizadasTotal: 0,
            taxaEntregaHoje: Math.round(rate)
        }
    }
}
