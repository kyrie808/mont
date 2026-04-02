import { useState, useCallback } from 'react'

export type ToastType = 'error' | 'success' | 'info'

export interface Toast {
    id: number
    message: string
    type: ToastType
}

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback(
        (message: string, type: ToastType = 'error') => {
            const id = Date.now()
            setToasts(prev => [...prev, { id, message, type }])
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id))
            }, 4000)
        },
        []
    )

    return { toasts, showToast }
}
