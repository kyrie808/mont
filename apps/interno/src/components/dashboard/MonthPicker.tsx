import { useRef } from 'react'
import { cn } from '@mont/shared'

interface MonthPickerProps {
    selectedMonth: string
    onMonthSelect: (month: string) => void
    className?: string
}

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function MonthPicker({ selectedMonth, onMonthSelect, className }: MonthPickerProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    return (
        <div className={cn("w-full", className)}>
            <div
                ref={scrollContainerRef}
                className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar scroll-smooth rounded-full bg-card p-1 shadow-sm border border-border"
            >
                {months.map((month) => {
                    const isSelected = selectedMonth === month
                    return (
                        <label
                            key={month}
                            className={cn(
                                "flex-1 cursor-pointer min-h-[44px] flex items-center justify-center rounded-full relative z-0 transition-all duration-300 select-none min-w-[3.5rem]",
                                isSelected ? "flex-grow-[1.5]" : ""
                            )}
                            onClick={() => onMonthSelect(month)}
                        >
                            <input
                                type="radio"
                                name="date_filter"
                                className="peer sr-only"
                                checked={isSelected}
                                readOnly
                            />
                            <span className={cn(
                                "absolute inset-0 rounded-full transition-opacity duration-300",
                                isSelected ? "bg-primary opacity-100 shadow-sm" : "opacity-0"
                            )}></span>
                            <span className={cn(
                                "relative z-10 text-sm font-medium transition-colors duration-200",
                                isSelected ? "text-background font-bold" : "text-gray-500 dark:text-gray-400"

                            )}>
                                {month}
                            </span>
                        </label>
                    )
                })}
            </div>
        </div>
    )
}
