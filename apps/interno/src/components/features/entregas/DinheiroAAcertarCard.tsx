import { format } from 'date-fns'
import { Banknote, Loader2, Check } from 'lucide-react'
import { formatCurrency, cn } from '@mont/shared'
import type { DinheiroAAcertar } from '../../../services/entregadorService'

interface DinheiroAAcertarCardProps {
    pendentes: DinheiroAAcertar[]
    total: number
    confirmandoId: string | null
    onAcertar: (id: string) => void
    /** Desktop: mostra um placeholder quando não há nada a acertar (no mobile fica null). */
    emptyPlaceholder?: boolean
    className?: string
}

// Alerta "Dinheiro a acertar": dinheiro que o entregador recolheu e a Mont ainda não
// recebeu de volta. Sempre-visível, independe do filtro (dívida não some). No mobile
// some quando vazio (comportamento atual preservado); no desktop pode exibir placeholder.
export function DinheiroAAcertarCard({
    pendentes,
    total,
    confirmandoId,
    onAcertar,
    emptyPlaceholder = false,
    className,
}: DinheiroAAcertarCardProps) {
    if (pendentes.length === 0) {
        if (!emptyPlaceholder) return null
        return (
            <div className={cn('rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground', className)}>
                <Banknote className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
                Nada a acertar no momento.
            </div>
        )
    }

    return (
        <div className={cn('mb-6', className)}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                <Banknote className="h-4 w-4 text-warning-strong" /> Dinheiro a acertar
                <span className="ml-auto font-mono text-warning-strong">{formatCurrency(total)}</span>
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
                Dinheiro que o entregador recolheu do cliente e a Mont ainda não recebeu de volta. Mostra tudo em aberto, independente do filtro.
            </p>
            <div className="space-y-2">
                {pendentes.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-warning-strong/30 bg-warning-strong/5 p-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{v.clienteNome}</p>
                            <p className="text-xs text-muted-foreground">
                                {formatCurrency(v.total)}
                                {v.recebidoEm && ` · recolhido ${format(new Date(v.recebidoEm), 'dd/MM')}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={confirmandoId === v.id}
                            onClick={() => onAcertar(v.id)}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-bold text-success-foreground active:scale-95 disabled:opacity-60"
                        >
                            {confirmandoId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Recebi
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
