import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
    showCloseButton?: boolean
}

const sizeClasses = {
    sm: 'max-w-sm mx-4',
    md: 'max-w-md mx-4',
    lg: 'max-w-lg mx-4',
    xl: 'max-w-xl mx-4',
    '2xl': 'max-w-2xl mx-4',
    '3xl': 'max-w-3xl mx-4',
    '4xl': 'max-w-4xl mx-4',
    '5xl': 'max-w-5xl mx-4',
    full: 'max-w-full mx-4',
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
}: ModalProps) {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen) return null

    const modalContent = (
        <>
            {/* Backdrop — own fixed layer */}
            <div
                className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Centering wrapper — pointer-events-none so backdrop click-through works */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
                {/* Panel — pointer-events-auto to capture own interactions */}
                <div
                    className={`
                        pointer-events-auto bg-card border border-border/50 rounded-xl shadow-2xl w-full
                        ${sizeClasses[size]}
                        max-h-[85vh] overflow-y-auto
                        animate-in fade-in zoom-in-95 duration-300
                    `}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                        {showCloseButton && (
                            <button
                                aria-label="Fechar"
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        {children}
                    </div>
                </div>
            </div>
        </>
    )

    return createPortal(modalContent, document.body)
}

interface ModalActionsProps {
    children: ReactNode
}

export function ModalActions({ children }: ModalActionsProps) {
    return (
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            {children}
        </div>
    )
}
