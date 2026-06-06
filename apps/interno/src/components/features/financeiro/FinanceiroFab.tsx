import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react'
import { LancamentoModal } from './LancamentoModal'
import { TransferenciaModal } from './TransferenciaModal'
import { cn } from '@mont/shared'

interface FinanceiroFabProps {
    refreshAll: () => void
}

export function FinanceiroFab({ refreshAll }: FinanceiroFabProps) {
    const [isFabOpen, setIsFabOpen] = useState(false)
    const [isEntradaOpen, setIsEntradaOpen] = useState(false)
    const [isSaidaOpen, setIsSaidaOpen] = useState(false)
    const [isTransferenciaOpen, setIsTransferenciaOpen] = useState(false)

    return createPortal(
        <>
            {/* Backdrop for FAB */}
            {isFabOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998] transition-all duration-300"
                    onClick={() => setIsFabOpen(false)}
                />
            )}

            {/* Floating Action Buttons Area */}
            <div className="fixed right-6 bottom-24 flex flex-col items-end gap-3 z-[9999]">
                <div className={cn(
                    "flex flex-col items-end gap-3 transition-all duration-300 origin-bottom",
                    isFabOpen ? "scale-100 opacity-100 mb-2" : "scale-0 opacity-0 h-0 pointer-events-none"
                )}>
                    <div className="flex items-center gap-3">
                        <span className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Transferência
                        </span>
                        <button
                            onClick={() => { setIsTransferenciaOpen(true); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                        >
                            <ArrowRightLeft size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Saída
                        </span>
                        <button
                            onClick={() => { setIsSaidaOpen(true); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                        >
                            <ArrowDownLeft size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Entrada
                        </span>
                        <button
                            onClick={() => { setIsEntradaOpen(true); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                        >
                            <ArrowUpRight size={24} />
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => setIsFabOpen(!isFabOpen)}
                    className={cn(
                        "w-14 h-14 text-white rounded-full shadow-lg shadow-zinc-400 dark:shadow-none flex items-center justify-center hover:scale-110 active:scale-95 transition-all",
                        isFabOpen ? "bg-zinc-800 rotate-45 shadow-none" : "bg-zinc-900 dark:bg-white dark:text-zinc-900"
                    )}
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* Fab Modals */}
            {isEntradaOpen && (
                <LancamentoModal
                    key={`entrada-${isEntradaOpen}`}
                    type="entrada"
                    isOpen={isEntradaOpen}
                    onClose={() => setIsEntradaOpen(false)}
                    onSuccess={refreshAll}
                />
            )}
            {isSaidaOpen && (
                <LancamentoModal
                    key={`saida-${isSaidaOpen}`}
                    type="saida"
                    isOpen={isSaidaOpen}
                    onClose={() => setIsSaidaOpen(false)}
                    onSuccess={refreshAll}
                />
            )}
            {isTransferenciaOpen && (
                <TransferenciaModal
                    key={`transf-${isTransferenciaOpen}`}
                    isOpen={isTransferenciaOpen}
                    onClose={() => setIsTransferenciaOpen(false)}
                    onSuccess={refreshAll}
                />
            )}
        </>,
        document.body
    )
}
