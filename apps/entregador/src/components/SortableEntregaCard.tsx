import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { EntregaCard } from './EntregaCard'
import type { Entrega } from '../services/entregasService'

interface SortableEntregaCardProps {
    entrega: Entrega
    posicao: number
    onRecebido: (vendaId: string) => void
    onEntregue: (vendaId: string) => void
    onSalvarNota: (vendaId: string, nota: string) => void
    processando: boolean
}

/** Envolve o EntregaCard (intacto) numa linha sortable: só o handle (grip)
 *  inicia o arrasto → o resto do card continua rolando/tocando normal. */
export function SortableEntregaCard({ entrega, posicao, ...cardProps }: SortableEntregaCardProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
        useSortable({ id: entrega.venda_id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-10 opacity-90' : 'relative'}>
            <div className="mb-1 flex items-center justify-between px-1">
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-white">
                    {posicao}ª
                </span>
                <button
                    ref={setActivatorNodeRef}
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label="Arrastar para reordenar"
                    className="touch-none rounded-lg p-1 text-slate-400 active:text-slate-700"
                >
                    <GripVertical className="h-5 w-5" />
                </button>
            </div>
            <EntregaCard entrega={entrega} {...cardProps} />
        </div>
    )
}
