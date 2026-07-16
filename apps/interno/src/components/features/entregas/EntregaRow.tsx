import { cn } from '@mont/shared'
import type { EntregaLista } from '../../../services/entregadorService'

interface EntregaRowProps {
    entrega: EntregaLista
    posicao: number
    /** Mostra o nome do entregador no subtítulo (quando a lista não está filtrada por um só). */
    showEntregador: boolean
    onClick: () => void
}

// Uma linha da rota "Entregas atribuídas": posição na sequência + cliente + endereço +
// status. Clicável → detalhe da venda. Compartilhada entre mobile e o hub desktop.
export function EntregaRow({ entrega, posicao, showEntregador, onClick }: EntregaRowProps) {
    const entregue = entrega.status === 'entregue'
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted active:scale-[0.99]"
        >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-foreground">
                {posicao}
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{entrega.clienteNome}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {entrega.enderecoCurto || 'Sem endereço'}
                    {showEntregador && ` · ${entrega.entregadorNome}`}
                </p>
            </div>
            <span className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                entregue ? 'bg-success/15 text-success' : 'bg-warning-strong/15 text-warning-strong',
            )}>
                {entregue ? 'Entregue' : 'A fazer'}
            </span>
        </button>
    )
}
