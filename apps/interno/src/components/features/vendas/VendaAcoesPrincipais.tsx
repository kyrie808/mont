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
    // Brinde NUNCA recebe dinheiro (regra do negócio) — logo, nada de quitar/desfazer.
    // O fluxo de ENTREGA continua normal. O banco também bloqueia (trigger
    // fn_bloquear_pagamento_em_brinde); aqui é só para não oferecer o que vai falhar.
    const ehBrinde = venda.formaPagamento === 'brinde'

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

            {!ehBrinde && !venda.pago && venda.status !== 'cancelada' && (
                <Button
                    className="flex-1"
                    variant="primary"
                    onClick={() => setShowPaymentModal(true)}
                >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Quitar
                </Button>
            )}

            {!ehBrinde && venda.pago && venda.status !== 'cancelada' && (
                <Button
                    className="flex-1 bg-destructive/10 text-destructive hover:bg-destructive/20 border-transparent"
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
