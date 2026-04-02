'use client'
import { Toast } from '@/hooks/useToast'

const colors = {
    error: 'bg-red-500',
    success: 'bg-green-500',
    info: 'bg-blue-500',
}

export default function ToastContainer({
    toasts
}: {
    toasts: Toast[]
}) {
    if (toasts.length === 0) return null
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`${colors[toast.type]} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm animate-fade-in`}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    )
}
