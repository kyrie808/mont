import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import { cn, formatCurrency } from '@mont/shared'
import type { SecaoItem } from '../../../services/secaoService'

export function SortableProdutoRow({ item, onRemove }: { item: SecaoItem; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.produto_id })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
                isDragging ? 'opacity-50 border-dashed border-border bg-transparent' : 'border-border bg-card',
            )}
        >
            <button
                {...attributes}
                {...listeners}
                className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
                aria-label="Arrastar para reordenar"
            >
                <GripVertical className="size-4" />
            </button>

            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {item.imagem_url ? (
                    <img src={item.imagem_url} alt="" className="size-full object-cover" />
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                )}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.nome}</p>
                <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.preco)}
                    {item.eh_combo ? ' · combo' : ''}
                </p>
            </div>

            <button
                onClick={onRemove}
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remover item da seção"
            >
                <X className="size-4" />
            </button>
        </div>
    )
}
