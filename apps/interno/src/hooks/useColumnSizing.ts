import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { ColumnSizingState } from '@tanstack/react-table'

/**
 * Larguras de coluna persistidas em localStorage (estilo Excel: gruda no reload).
 * Uso: `const [colSizing, setColSizing] = useColumnSizing('grid-produtos')`,
 * e no useReactTable: `state.columnSizing`, `onColumnSizingChange: setColSizing`.
 */
export function useColumnSizing(
    storageKey: string,
): [ColumnSizingState, Dispatch<SetStateAction<ColumnSizingState>>] {
    const [sizing, setSizing] = useState<ColumnSizingState>(() => {
        try {
            const raw = localStorage.getItem(storageKey)
            return raw ? (JSON.parse(raw) as ColumnSizingState) : {}
        } catch {
            return {}
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(sizing))
        } catch {
            // localStorage indisponível (modo privado/quota) — larguras só não persistem.
        }
    }, [storageKey, sizing])

    return [sizing, setSizing]
}
