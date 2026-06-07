import { Printer, Trash2, Ban } from 'lucide-react'
import { Button } from '@/components/ui'

import type { DomainVenda } from '../../../types/domain'

interface VendaAcoesSecundariasProps {
    venda: DomainVenda
    handleShare: () => void
    setShowDeleteModal: (val: boolean) => void
    setShowCancelModal?: (val: boolean) => void
}

export function VendaAcoesSecundarias({
    venda,
    handleShare,
    setShowDeleteModal,
    setShowCancelModal
}: VendaAcoesSecundariasProps) {
    return (
        <div className="mt-8 mb-6 flex flex-col gap-3">
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    className="flex-1 border-border hover:bg-muted"
                    onClick={handleShare}
                >
                    <Printer className="h-4 w-4 mr-2" />
                    Compartilhar
                </Button>

                {venda.origem === 'catalogo' ? (
                    <>
                        {venda.status !== 'cancelada' && venda.status !== 'entregue' && setShowCancelModal && (
                            <Button
                                variant="outline"
                                className="flex-1 border-warning-strong/30 text-warning-strong hover:bg-warning-strong/10"
                                onClick={() => setShowCancelModal(true)}
                            >
                                <Ban className="h-4 w-4 mr-2" />
                                Cancelar
                            </Button>
                        )}
                        {venda.status === 'cancelada' && (
                            <Button
                                variant="outline"
                                className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => setShowDeleteModal(true)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                            </Button>
                        )}
                    </>
                ) : (
                    <Button
                        variant="outline"
                        className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => setShowDeleteModal(true)}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {venda.status === 'cancelada' ? 'Excluir' : 'Cancelar'}
                    </Button>
                )}
            </div>
        </div>
    )
}
