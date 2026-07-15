import { useCallback } from 'react'
import { useDashboardFilter } from './useDashboardFilter'

/**
 * Rótulos curtos dos meses — DEVEM casar com a lista interna do `MonthPicker`
 * (components/dashboard/MonthPicker.tsx), que compara por string.
 */
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

/**
 * Liga o `MonthPicker` ao filtro global de período (`useDashboardFilter`).
 * Fonte única do binding — consumido pelo Dashboard e pela página de Vendas.
 *
 * Nota (comportamento preexistente, mantido): o picker só expõe meses, então
 * selecionar um mês sempre navega dentro do ANO CORRENTE.
 */
export function useMonthPickerBinding() {
    const { month, year, setMonth } = useDashboardFilter()

    const selectedMonthStr = MESES_CURTOS[month - 1] ?? MESES_CURTOS[0]

    const handleMonthSelect = useCallback((monthName: string) => {
        const idx = MESES_CURTOS.indexOf(monthName as (typeof MESES_CURTOS)[number])
        if (idx >= 0) setMonth(new Date(new Date().getFullYear(), idx, 1))
    }, [setMonth])

    return { selectedMonthStr, handleMonthSelect, month, year }
}
