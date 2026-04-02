import { create } from 'zustand'
import { startOfMonth, endOfMonth, getMonth, getYear } from 'date-fns'

interface DashboardFilterState {
    startDate: Date
    endDate: Date
    month: number
    year: number
    setMonth: (date: Date) => void
    resetToCurrentMonth: () => void
}

export const useDashboardFilter = create<DashboardFilterState>((set) => ({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    month: getMonth(new Date()) + 1,
    year: getYear(new Date()),
    setMonth: (date: Date) => {
        set({
            startDate: startOfMonth(date),
            endDate: endOfMonth(date),
            month: getMonth(date) + 1,
            year: getYear(date),
        })
    },
    resetToCurrentMonth: () => {
        const now = new Date()
        set({
            startDate: startOfMonth(now),
            endDate: endOfMonth(now),
            month: getMonth(now) + 1,
            year: getYear(now),
        })
    },
}))
