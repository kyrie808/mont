import { Package, Plus, Minus } from 'lucide-react'
import { cn, formatCurrency } from '@mont/shared'
import { estoqueStatus } from '../../../../../utils/estoqueStatus'
import type { DomainProduto } from '../../../../../types/domain'

interface PosProductGridProps {
    produtos: DomainProduto[]
    getQuantity: (produtoId: string) => number
    onAdd: (produto: DomainProduto) => void
    onUpdateQuantity: (produtoId: string, delta: number) => void
}

// Badge de estoque — INFORMATIVO (o estoque do Mont ainda não foi contado); NUNCA bloqueia
// o "Adicionar" (o Gilmar vende o físico independente do número).
function estoqueBadge(p: DomainProduto): { label: string; cls: string } {
    const atual = p.estoqueAtual ?? 0
    if (atual <= 0) return { label: 'Esgotado', cls: 'bg-destructive/10 text-destructive border-destructive/20' }
    const st = estoqueStatus(p)
    const cls = st === 'baixo'
        ? 'bg-warning/10 text-warning-strong border-warning/20'
        : 'bg-success/10 text-success border-success/20'
    return { label: `${atual} un`, cls }
}

export function PosProductGrid({ produtos, getQuantity, onAdd, onUpdateQuantity }: PosProductGridProps) {
    if (produtos.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                Nenhum produto encontrado.
            </div>
        )
    }

    return (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-4 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {produtos.map((produto) => {
                const qty = getQuantity(produto.id)
                const badge = estoqueBadge(produto)
                return (
                    <div
                        key={produto.id}
                        className={cn(
                            'relative flex flex-col rounded-xl border-2 bg-card p-3 shadow-card transition-all',
                            qty > 0 ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50',
                        )}
                    >
                        <span className={cn('absolute left-2 top-2 z-10 rounded-md border px-1.5 py-0.5 text-[10px] font-bold', badge.cls)}>
                            {badge.label}
                        </span>

                        <div className="mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                            {produto.imagemUrl ? (
                                <img src={produto.imagemUrl} alt={produto.nome} className="h-full w-full object-cover" />
                            ) : (
                                <Package className="h-8 w-8 text-muted-foreground/50" />
                            )}
                        </div>

                        <p className="mb-1 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-foreground">{produto.nome}</p>
                        <p className="mb-2 text-base font-bold tabular-nums text-primary">{formatCurrency(Number(produto.preco))}</p>

                        <div className="mt-auto">
                            {qty > 0 ? (
                                <div className="flex items-center justify-between gap-1 rounded-lg bg-muted p-1">
                                    <button
                                        aria-label="Diminuir"
                                        onClick={() => onUpdateQuantity(produto.id, -1)}
                                        className="flex size-9 items-center justify-center rounded-md border border-border bg-background transition-transform active:scale-95"
                                    >
                                        <Minus className="size-4" />
                                    </button>
                                    <span className="min-w-8 text-center text-sm font-bold tabular-nums">{qty}</span>
                                    <button
                                        aria-label="Aumentar"
                                        onClick={() => onUpdateQuantity(produto.id, 1)}
                                        className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform active:scale-95"
                                    >
                                        <Plus className="size-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => onAdd(produto)}
                                    className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95"
                                >
                                    Adicionar
                                </button>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
