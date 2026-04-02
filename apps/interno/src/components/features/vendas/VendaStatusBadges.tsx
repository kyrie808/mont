import { CheckCheck, Hourglass } from 'lucide-react'
import { Badge } from '@/components/ui'
import { cn } from '@mont/shared'
import { VENDA_STATUS_LABELS } from '@/constants'

interface VendaStatusBadgesProps {
    venda: {
        status: string
        pago: boolean
    }
}

export function VendaStatusBadges({ venda }: VendaStatusBadgesProps) {
    if (venda.pago && venda.status === 'entregue') {
        return (
            <div className="flex flex-col items-center animate-in zoom-in duration-500">
                <Badge
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-full shadow-[0_0_20px_rgba(19,236,19,0.4)] flex items-center gap-2 border-none"
                >
                    <CheckCheck className="w-5 h-5" />
                    <span className="tracking-widest font-bold text-sm">CONCLUÍDO</span>
                </Badge>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center gap-3 mb-6">
            <Badge
                variant={
                    venda.status === 'entregue' ? 'success' :
                        venda.status === 'cancelada' ? 'destructive' :
                            'warning'
                }
                className={cn(
                    "px-4 py-1.5 text-xs tracking-wide uppercase shadow-sm transition-colors",
                    venda.status === 'entregue' && "bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success)/0.8)] shadow-lg shadow-success/40 dark:shadow-success/20"
                )}
            >
                {VENDA_STATUS_LABELS[venda.status as keyof typeof VENDA_STATUS_LABELS]}
            </Badge>

            {!venda.pago && venda.status !== 'cancelada' && (
                <Badge
                    variant="warning"
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-500/30"
                >
                    <Hourglass className="w-3.5 h-3.5" />
                    <span>Pagamento Pendente</span>
                </Badge>
            )}
        </div>
    )
}
