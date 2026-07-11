import { useEffect } from 'react'
import { X, PackageOpen } from 'lucide-react'
import { EntregaCard } from './EntregaCard'
import { dataBR } from '../lib/format'
import type { Entrega } from '../services/entregasService'

interface DiaSheetProps {
    ymd: string
    entregas: Entrega[]
    onClose: () => void
}

/** Bottom sheet com as entregas de um dia (read-only). Fecha no backdrop, no X ou Esc. */
export function DiaSheet({ ymd, entregas, onClose }: DiaSheetProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="animate-slide-up relative mx-auto max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card pb-8 shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-4 py-3">
                    <p className="text-sm font-bold text-foreground">
                        {dataBR(ymd)} · {entregas.length} entrega(s)
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-muted-foreground active:scale-95"
                        aria-label="Fechar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-3 p-4">
                    {entregas.length === 0 ? (
                        <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                            <PackageOpen className="mb-3 h-9 w-9" />
                            <p className="font-medium">Nenhuma entrega nesse dia.</p>
                        </div>
                    ) : (
                        entregas.map((e) => (
                            <EntregaCard
                                key={e.venda_id}
                                entrega={e}
                                onRecebido={() => {}}
                                onEntregue={() => {}}
                                processando={false}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
