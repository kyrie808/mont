import { Loader2, UserX } from 'lucide-react'
import { formatCurrency, cn } from '@mont/shared'
import { useIndicadosDoIndicador } from '@/hooks/useIndicadosDoIndicador'

interface IndicadosDetalheProps {
    indicadorId: string
    className?: string
}

// Lista dos contatos que uma pessoa trouxe, com o gasto de cada um. Sem header próprio
// (o header é a linha/card que expande). Reusado no Ranking e no perfil do contato.
export function IndicadosDetalhe({ indicadorId, className }: IndicadosDetalheProps) {
    const { indicados, loading } = useIndicadosDoIndicador(indicadorId)

    if (loading) {
        return (
            <div className={cn('flex justify-center py-4 text-muted-foreground', className)}>
                <Loader2 className="h-4 w-4 animate-spin" />
            </div>
        )
    }

    if (indicados.length === 0) {
        return (
            <div className={cn('py-3 text-center text-xs text-muted-foreground', className)}>
                Nenhum indicado registrado.
            </div>
        )
    }

    return (
        <div className={cn('space-y-1.5', className)}>
            {indicados.map((ind) => (
                <div
                    key={ind.contatoId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                >
                    <div className="flex min-w-0 items-center gap-2">
                        {!ind.comprou && <UserX className="size-3.5 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{ind.nome}</p>
                            <p className="text-[11px] text-muted-foreground">
                                {ind.comprou
                                    ? `${ind.totalCompras} ${ind.totalCompras === 1 ? 'compra' : 'compras'}`
                                    : 'ainda não comprou'}
                            </p>
                        </div>
                    </div>
                    <p className={cn(
                        'shrink-0 text-sm font-bold tabular-nums',
                        ind.comprou ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                        {formatCurrency(ind.totalGasto)}
                    </p>
                </div>
            ))}
        </div>
    )
}
