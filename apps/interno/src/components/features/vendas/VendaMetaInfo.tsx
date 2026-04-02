import { FORMA_PAGAMENTO_LABELS } from '@/constants'

interface VendaMetaInfoProps {
    vendaId: string
    formaPagamento: string
}

export function VendaMetaInfo({ vendaId, formaPagamento }: VendaMetaInfoProps) {
    const glassPanel = "bg-white/80 dark:bg-white/5 backdrop-blur-md border border-gray-100 dark:border-border"

    return (
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`${glassPanel} rounded-lg p-3 flex flex-col gap-1`}>
                <span className="text-[10px] text-gray-500 uppercase font-mono">ID Venda</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">#{vendaId.slice(0, 8)}</span>
            </div>
            <div className={`${glassPanel} rounded-lg p-3 flex flex-col gap-1`}>
                <span className="text-[10px] text-gray-500 uppercase font-mono">Pagamento</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                    {FORMA_PAGAMENTO_LABELS[formaPagamento as keyof typeof FORMA_PAGAMENTO_LABELS] || formaPagamento}
                </span>
            </div>
        </div>
    )
}
