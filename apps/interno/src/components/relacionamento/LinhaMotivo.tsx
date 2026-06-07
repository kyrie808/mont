import { useState } from 'react'
import { cn } from '@mont/shared'
import type { KanbanRow } from '../../services/relacionamentoService'
import { motivoCard } from './motivoCard'

function BaldeGlyph({ cheio }: { cheio: boolean }) {
    return (
        <svg
            width="11"
            height="12"
            viewBox="0 0 12 13"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden="true"
        >
            {/* alça */}
            <path
                d="M4.2 4.2V2.8a1.8 1.8 0 0 1 3.6 0v1.4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* corpo do balde — trapézio */}
            <path
                d="M1.5 4.2h9l-1.3 7.3H2.8L1.5 4.2z"
                stroke="currentColor"
                strokeWidth="1.15"
                strokeLinejoin="round"
                fill={cheio ? 'currentColor' : 'none'}
                fillOpacity={cheio ? 0.28 : 0}
            />
            {/* linha de nível interno — só quando cheio */}
            {cheio && (
                <path
                    d="M3.4 7.5h5.2"
                    stroke="currentColor"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    opacity={0.6}
                />
            )}
        </svg>
    )
}

export function LinhaMotivo({ card }: { card: KanbanRow }) {
    const [tooltipAberto, setTooltipAberto] = useState(false)
    const motivo = motivoCard(card)

    if (!motivo) return null

    return (
        <div
            className="relative mb-1"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setTooltipAberto((v) => !v) }}
            onMouseEnter={() => setTooltipAberto(true)}
            onMouseLeave={() => setTooltipAberto(false)}
        >
            <div
                className={cn(
                    'flex items-center gap-1 cursor-default select-none text-[10.5px] leading-[1.35]',
                    motivo.corClass
                )}
            >
                {motivo.glyph && <BaldeGlyph cheio={motivo.glyph === 'cheio'} />}
                <span className="truncate">{motivo.texto}</span>
            </div>

            {tooltipAberto && (
                <div className="absolute bottom-full left-0 z-tooltip mb-1.5 w-52 rounded-lg border border-border bg-popover px-2.5 py-2 text-[11px] leading-[1.55] text-popover-foreground shadow-modal pointer-events-none">
                    {motivo.tooltip}
                </div>
            )}
        </div>
    )
}
