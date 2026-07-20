import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Badge } from '../ui'
import { InteracoesTimeline } from './InteracoesTimeline'
import type { RelacionamentoStatus } from '../../hooks/useRelacionamento'

// ─── Config ───────────────────────────────────────────────────────────────────

const RESULTADO_LABEL: Record<string, string> = {
    a_contatar: 'A Contatar',
    contatado: 'Aguardando Resposta',
    follow_up: 'Follow-up',
    em_negociacao: 'Em Conversa',
    resolvido: 'Resolvido',
    sem_retorno: 'Sem Retorno',
}

const STATUS_BADGE: Record<RelacionamentoStatus, 'warning' | 'secondary' | 'default' | 'success'> = {
    a_contatar: 'warning',
    contatado: 'secondary',
    follow_up: 'warning',
    em_negociacao: 'default',
    resolvido: 'success',
    sem_retorno: 'secondary',
}

// ─── Grain SVG data URI (fractalNoise, sem blur, apenas textura) ──────────────

const GRAIN_BG =
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── PanelContent ─────────────────────────────────────────────────────────────

interface PanelContentProps {
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
}

function PanelContent({ onClose, contatoId, nomeContato, statusAtual }: PanelContentProps) {
    const inicial = nomeContato.trim()[0]?.toUpperCase() ?? '?'

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-card">
            {/* Grain overlay — fundo sólido + textura, sem blur */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0"
                style={{ backgroundImage: GRAIN_BG, opacity: 0.04 }}
            />

            {/* Header */}
            <div className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[13px] font-bold text-primary">
                    {inicial}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-[1.35] text-foreground">
                        {nomeContato}
                    </p>
                    <div className="mt-0.5">
                        <Badge variant={STATUS_BADGE[statusAtual]} className="px-2 py-0 text-[10px]">
                            {RESULTADO_LABEL[statusAtual] ?? statusAtual}
                        </Badge>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Section label */}
            <div className="relative z-10 shrink-0 border-b border-border px-4 py-2">
                <p className="text-[10.5px] font-black uppercase tracking-[0.09em] text-muted-foreground/50">
                    Histórico de interações
                </p>
            </div>

            {/* Body */}
            <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto">
                <InteracoesTimeline contatoId={contatoId} />
            </div>
        </div>
    )
}

// ─── TimelineSideSheet ────────────────────────────────────────────────────────

export interface TimelineSideSheetProps {
    isOpen: boolean
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
}

export function TimelineSideSheet({ isOpen, onClose, ...rest }: TimelineSideSheetProps) {
    if (!isOpen) return null

    return createPortal(
        <aside className="fixed right-0 top-0 z-9999 h-screen w-80 animate-slide-in-right overflow-hidden border-l border-border shadow-modal">
            <PanelContent onClose={onClose} {...rest} />
        </aside>,
        document.body,
    )
}
