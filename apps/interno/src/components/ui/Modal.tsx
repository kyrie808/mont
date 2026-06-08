import { type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@mont/shared'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
    showCloseButton?: boolean
}

// max-width por tamanho. O gutter mobile (1rem de cada lado) vem do
// `w-[calc(100%-2rem)]` no Content — não de `mx-4` (que não casa com centralização fixed).
const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-full',
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
}: ModalProps) {
    // Radix cuida de: focus-trap, aria-modal, retorno de foco, scroll-lock do body,
    // ESC e clique no overlay → todos resultam em onOpenChange(false) → onClose().
    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-9998 bg-black/50 backdrop-blur-xs" />
                <Dialog.Content
                    // sem Description: opta por não exigir aria-describedby (evita warning do Radix)
                    aria-describedby={undefined}
                    className={cn(
                        'fixed left-1/2 top-1/2 z-9999 -translate-x-1/2 -translate-y-1/2',
                        'w-[calc(100%-2rem)] bg-card border border-border/50 rounded-xl shadow-2xl',
                        sizeClasses[size],
                        'max-h-[85vh] overflow-y-auto',
                        'animate-in fade-in zoom-in-95 duration-300',
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
                        {showCloseButton && (
                            <Dialog.Close asChild>
                                <button
                                    aria-label="Fechar"
                                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </Dialog.Close>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        {children}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
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
