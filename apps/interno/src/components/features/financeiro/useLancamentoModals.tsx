import { useState, type ReactNode } from 'react'
import { LancamentoModal } from './LancamentoModal'
import { TransferenciaModal } from './TransferenciaModal'

/**
 * Estado + render dos 3 modais financeiros (Entrada/Saída/Transferência),
 * extraído do FinanceiroFab para reuso pelos dois ramos do split responsivo:
 * o FAB (mobile, lg:hidden) e o FinanceiroDashboardDesktop (hidden lg:block).
 *
 * Renderizar `modals` UMA vez no page-level (FluxoCaixa) — um só conjunto serve
 * mobile + desktop, sem double-mount. A `key` força reset do form a cada abertura.
 */
export function useLancamentoModals(refreshAll: () => void): {
    openEntrada: () => void
    openSaida: () => void
    openTransferencia: () => void
    modals: ReactNode
} {
    const [isEntradaOpen, setIsEntradaOpen] = useState(false)
    const [isSaidaOpen, setIsSaidaOpen] = useState(false)
    const [isTransferenciaOpen, setIsTransferenciaOpen] = useState(false)

    const modals = (
        <>
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
        </>
    )

    return {
        openEntrada: () => setIsEntradaOpen(true),
        openSaida: () => setIsSaidaOpen(true),
        openTransferencia: () => setIsTransferenciaOpen(true),
        modals,
    }
}
