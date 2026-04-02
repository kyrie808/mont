import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@mont/shared'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastStore {
    toasts: Toast[]
    addToast: (toast: Omit<Toast, 'id'>) => void
    removeToast: (id: string) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (toast) => {
        const id = Math.random().toString(36).substring(2, 9)
        set((state) => ({
            toasts: [...state.toasts, { ...toast, id }],
        }))

        // Auto remove after duration
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id),
            }))
        }, toast.duration || 2500)
    },
    removeToast: (id) =>
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        })),
}))

// Hook for easy toast usage
function useToast() {
    const addToast = useToastStore((state) => state.addToast)

    return {
        success: (message: string, duration?: number) =>
            addToast({ type: 'success', message, duration }),
        error: (message: string, duration?: number) =>
            addToast({ type: 'error', message, duration: duration ?? 4000 }),
        info: (message: string, duration?: number) =>
            addToast({ type: 'info', message, duration }),
        warning: (message: string, duration?: number) =>
            addToast({ type: 'warning', message, duration }),
    }
}

// eslint-disable-next-line react-refresh/only-export-components
export { useToast }

const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
}

const styles = {
    success: 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    error: 'border-red-500/20 text-red-600 dark:text-red-400',
    info: 'border-blue-500/20 text-blue-600 dark:text-blue-400',
    warning: 'border-amber-500/20 text-amber-600 dark:text-amber-400',
}

function ToastItem({ toast }: { toast: Toast }) {
    const removeToast = useToastStore((state) => state.removeToast)
    const Icon = icons[toast.type]

    return (
        <div
            className={cn(
                "pointer-events-auto flex items-center gap-3 py-2.5 px-4 pr-3 rounded-full border shadow-xl bg-white dark:bg-gray-800 animate-in slide-in-from-top-full duration-300",
                styles[toast.type]
            )}
        >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <p className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                {toast.message}
            </p>
            <button
                onClick={() => removeToast(toast.id)}
                className="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1 text-gray-400 hover:text-gray-600"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}

export function ToastContainer() {
    const toasts = useToastStore((state) => state.toasts)

    if (toasts.length === 0) return null

    return createPortal(
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 w-full pointer-events-none px-4">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} />
            ))}
        </div>,
        document.body
    )
}
