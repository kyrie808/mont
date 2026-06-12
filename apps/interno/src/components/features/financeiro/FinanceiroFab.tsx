import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react'
import { cn } from '@mont/shared'

interface FinanceiroFabProps {
    onEntrada: () => void
    onSaida: () => void
    onTransferencia: () => void
}

const SpeedDialLabel = ({ children }: { children: React.ReactNode }) => (
    <span className="bg-card px-3 py-1.5 rounded-lg shadow-card border border-border text-xs font-black uppercase tracking-wider text-muted-foreground">
        {children}
    </span>
)

/**
 * FAB de movimentação financeira — MOBILE-ONLY (lg:hidden).
 * No desktop a ação vive inline no FinanceiroDashboardDesktop (3 botões).
 * Os modais são geridos no page-level via useLancamentoModals; aqui só disparamos os openers.
 */
export function FinanceiroFab({ onEntrada, onSaida, onTransferencia }: FinanceiroFabProps) {
    const [isFabOpen, setIsFabOpen] = useState(false)

    return createPortal(
        <div className="lg:hidden">
            {/* Backdrop for FAB */}
            {isFabOpen && (
                <div
                    className="fixed inset-0 bg-foreground/20 backdrop-blur-xs z-9998 transition-all duration-300"
                    onClick={() => setIsFabOpen(false)}
                />
            )}

            {/* Floating Action Buttons Area */}
            <div className="fixed right-6 bottom-24 flex flex-col items-end gap-3 z-9999">
                <div className={cn(
                    "flex flex-col items-end gap-3 transition-all duration-300 origin-bottom",
                    isFabOpen ? "scale-100 opacity-100 mb-2" : "scale-0 opacity-0 h-0 pointer-events-none"
                )}>
                    <div className="flex items-center gap-3">
                        <SpeedDialLabel>Transferência</SpeedDialLabel>
                        <button
                            aria-label="Registrar transferência"
                            onClick={() => { onTransferencia(); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-foreground text-background rounded-full shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <ArrowRightLeft size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <SpeedDialLabel>Saída</SpeedDialLabel>
                        <button
                            aria-label="Registrar saída"
                            onClick={() => { onSaida(); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-destructive text-destructive-foreground rounded-full shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <ArrowDownLeft size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <SpeedDialLabel>Entrada</SpeedDialLabel>
                        <button
                            aria-label="Registrar entrada"
                            onClick={() => { onEntrada(); setIsFabOpen(false); }}
                            className="w-12 h-12 bg-success text-success-foreground rounded-full shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                        "w-14 h-14 bg-foreground text-background rounded-full shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isFabOpen && "rotate-45 opacity-90"
                    )}
                >
                    <Plus size={24} />
                </button>
            </div>
        </div>,
        document.body
    )
}
