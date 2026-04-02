import { useQuery } from '@tanstack/react-query'
import { dashboardService, type DashboardMetrics } from '../services/dashboardService'

export function useDashboardMetrics(month?: number, year?: number) {
    const targetMonth = month || new Date().getMonth() + 1
    const targetYear = year || new Date().getFullYear()

    return useQuery({
        queryKey: ['dashboard_metrics', targetMonth, targetYear],
        queryFn: () => dashboardService.getDashboardMetrics(targetMonth, targetYear),
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    })
}

export type { DashboardMetrics }
