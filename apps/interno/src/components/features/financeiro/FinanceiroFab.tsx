import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react'
import { LancamentoModal } from './LancamentoModal'
import { TransferenciaModal } from './TransferenciaModal'
import { cn } from '@mont/shared'

interface FinanceiroFabProps {
    refreshAll: () => void
}

const SpeedDialLabel = ({ children }: { children: React.ReactNode }) => (
    <span className="bg-card px-3 py-1.5 rounded-lg shadow-card border border-border text-xs font-black uppercase tracking-wider text-muted-foreground">
        {children}
    </span>
)

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
                    className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[9998] transition-all duration-300"
                    onClick={() => setIsFabOpen(false)}
                />
            )}

            {/* Floating Action Buttons Area */}
            <div className="fixed right-6 bottom-24 lg:bottom-8 flex flex-col items-end gap-3 z-[9999]">
                <div className={cn(
                    "flex flex-col items-end gap-3 transition-all duration-300 origin-bottom",
                    isFabOpen ? "scale-100 opacity-100 mb-2" : "scale-0 opacity-0 h-0 pointer-events-none"
                )}>
                    <div className="flex items-center gap-3">
                        <SpeedDialLabel>Transferência</SpeedDialLabel>
                        <button
                            aria-label="Registrar transferência"
                            onClick={() => { setIsTransferenciaOpen(true); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-foreground text-background rounded-full shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <ArrowRightLeft size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <SpeedDialLabel>Saída</SpeedDialLabel>
                        <button
                            aria-label="Registrar saída"
                            onClick={() => { setIsSaidaOpen(true); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-destructive text-destructive-foreground rounded-full shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <ArrowDownLeft size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <SpeedDialLabel>Entrada</SpeedDialLabel>
                        <button
                            aria-label="Registrar entrada"
                            onClick={() => { setIsEntradaOpen(true); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-success text-success-foreground rounded-full shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <ArrowUpRight size={24} />
                        </button>
                    </div>
                </div>

                <button
                    aria-label={isFabOpen ? 'Fechar menu de movimentação' : 'Nova movimentação financeira'}
                    aria-expanded={isFabOpen}
                    onClick={() => setIsFabOpen(!isFabOpen)}
                    className={cn(
                        "w-14 h-14 bg-foreground text-background rounded-full shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isFabOpen && "rotate-45 opacity-90"
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
