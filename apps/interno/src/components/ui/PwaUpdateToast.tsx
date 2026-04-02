/// <reference types="vite-plugin-pwa/client" />
import { createPortal } from 'react-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export function PwaUpdateToast() {
    const {
        offlineReady: [, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r: ServiceWorkerRegistration | undefined) {
            if (r) {
                setInterval(() => {
                    r.update()
                }, 60 * 60 * 1000) // Check for updates every hour
            }
        },
    })

    const close = () => {
        setOfflineReady(false)
        setNeedRefresh(false)
    }

    if (!needRefresh) return null

    return createPortal(
        <div className="fixed bottom-4 right-4 z-[9999] p-4 bg-background border border-border rounded-lg shadow-2xl animate-in slide-in-from-bottom-5 fade-in flex flex-col gap-3 max-w-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-sm">Nova atualização disponível</h3>
                    <p className="text-xs text-muted-foreground">
                        Uma nova versão do app está pronta. Atualize para ver as novidades.
                    </p>
                </div>
                <button
                    onClick={close}
                    className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => updateServiceWorker(true)}
                    className="flex-1 bg-primary text-primary-foreground text-xs font-semibold h-9 rounded-md flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                >
                    <RefreshCw className="w-3 h-3" />
                    Atualizar Agora
                </button>
                <button
                    onClick={close}
                    className="px-3 bg-secondary text-secondary-foreground text-xs font-semibold h-9 rounded-md hover:bg-secondary/80 transition-colors"
                >
                    Depois
                </button>
            </div>
        </div>,
        document.body
    )
}
