import { Modal, ModalActions } from './Modal'
import { Button } from './Button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'default'
    isLoading?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'default',
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <Modal isOpen={open} onClose={onCancel} title={title} size="sm">
            <div className="flex items-start gap-3">
                {variant === 'danger' && (
                    <div className="flex-shrink-0 mt-0.5">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
            </div>
            <ModalActions>
                <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
                    {cancelLabel}
                </Button>
                <Button
                    variant={variant === 'danger' ? 'danger' : 'primary'}
                    onClick={onConfirm}
                    isLoading={isLoading}
                >
                    {confirmLabel}
                </Button>
            </ModalActions>
        </Modal>
    )
}
