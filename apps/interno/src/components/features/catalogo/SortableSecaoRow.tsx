import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@mont/shared'
import type { SecaoComContagem } from '../../../services/secaoService'

interface Props {
    secao: SecaoComContagem
    selected: boolean
    onSelect: () => void
    onEdit: () => void
    onDelete: () => void
}

export function SortableSecaoRow({ secao, selected, onSelect, onEdit, onDelete }: Props) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: secao.id })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                'flex items-center gap-1.5 rounded-xl border px-2 py-2 transition-colors',
                isDragging
                    ? 'opacity-50 border-dashed border-border bg-transparent'
                    : selected
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-border bg-card hover:bg-muted',
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

            <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span
                    className={cn(
                        'truncate text-sm font-semibold',
                        secao.ativa ? 'text-foreground' : 'text-muted-foreground line-through',
                    )}
                >
                    {secao.nome}
                </span>
                {!secao.ativa && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Oculta
                    </span>
                )}
            </button>

            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {secao.total_itens}
            </span>
            <button
                onClick={onEdit}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Editar seção"
            >
                <Pencil className="size-3.5" />
            </button>
            <button
                onClick={onDelete}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Excluir seção"
            >
                <Trash2 className="size-3.5" />
            </button>
        </div>
    )
}
