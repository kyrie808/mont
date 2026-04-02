import { Truck, DollarSign, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui'

import type { DomainVenda } from '../../../types/domain'

interface VendaAcoesPrincipaisProps {
    venda: DomainVenda
    handleEntregar: () => void
    setShowPaymentModal: (val: boolean) => void
    setShowUndoPaymentConfirm: (val: boolean) => void
    loadingAction: boolean
}

export function VendaAcoesPrincipais({
    venda,
    handleEntregar,
    setShowPaymentModal,
    setShowUndoPaymentConfirm,
    loadingAction
}: VendaAcoesPrincipaisProps) {
    return (
        <div className="flex gap-3 mb-6">
            {(venda.status === 'pendente' || venda.status === 'entregue') && (
                <Button
                    className="flex-1"
                    variant={venda.status === 'entregue' ? "secondary" : "primary"}
                    onClick={handleEntregar}
                >
                    <Truck className="h-4 w-4 mr-2" />
                    {venda.status === 'entregue' ? 'Voltar para Pendente' : 'Entregar'}
                </Button>
            )}

            {!venda.pago && venda.status !== 'cancelada' && (
                <Button
                    className="flex-1"
                    variant="primary"
                    onClick={() => setShowPaymentModal(true)}
                >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Quitar
                </Button>
            )}

            {venda.pago && venda.status !== 'cancelada' && (
                <Button
                    className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 border-transparent"
                    variant="outline"
                    onClick={() => setShowUndoPaymentConfirm(true)}
                    disabled={loadingAction}
                >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Desfazer Pagamento
                </Button>
            )}
        </div>
    )
}
