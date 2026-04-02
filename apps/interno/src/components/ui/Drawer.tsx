import { createPortal } from 'react-dom'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface DrawerProps {
    isOpen: boolean
    onClose: () => void
    title: string
    subtitle?: string
    children: ReactNode
    footer?: ReactNode
}

export function Drawer({ isOpen, onClose, title, subtitle, children, footer }: DrawerProps) {
    if (!isOpen) return null

    const header = (
        <div className="flex items-center gap-3 p-4 border-b border-border flex-shrink-0">
            <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-accent transition-colors"
                aria-label="Fechar"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
                <h2 className="font-semibold text-base">{title}</h2>
                {subtitle && (
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
            </div>
        </div>
    )

    const footerSlot = footer ? (
        <div className="flex-shrink-0 border-t border-border p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {footer}
        </div>
    ) : null

    return createPortal(
        <>
            {/* Mobile: full-screen slide-in panel */}
            <div className="fixed inset-0 z-[9998] md:hidden flex justify-end">
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                />
                <div className="relative w-[85vw] max-w-sm bg-card h-[100dvh] shadow-2xl transform transition-transform animate-slide-in-right overflow-hidden z-[9999] flex flex-col">
                    {header}
                    <div className="flex-1 overflow-y-auto flex flex-col">
                        {children}
                    </div>
                    {footerSlot}
                </div>
            </div>
            {/* Desktop: fixed sidebar */}
            <aside className="hidden md:flex fixed right-0 top-0 w-96 flex-col border-l border-border bg-card h-screen z-[9999]">
                {header}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {children}
                </div>
                {footerSlot}
            </aside>
        </>,
        document.body
    )
}
