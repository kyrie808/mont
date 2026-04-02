
import { Modal, ModalActions, Button } from '../../../../components/ui'
import type { DomainContato } from '../../../../types/domain'

interface ContatoDeleteModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    isDeleting: boolean
    contato: DomainContato
}

export function ContatoDeleteModal({ isOpen, onClose, onConfirm, isDeleting, contato }: ContatoDeleteModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Excluir Contato"
            size="sm"
        >
            <div className="space-y-4">
                <p className="text-gray-600">
                    Tem certeza que deseja excluir <strong>{contato.nome}</strong>?
                    <br />
                    <span className="text-sm text-gray-500">
                        Esta ação removerá todo o histórico e não pode ser desfeita.
                    </span>
                </p>
                <ModalActions>
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button variant="danger" onClick={onConfirm} isLoading={isDeleting}>Excluir Definitivamente</Button>
                </ModalActions>
            </div>
        </Modal>
    )
}
