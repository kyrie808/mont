import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useRegistrarFeedback, type Canal } from '../../hooks/useInteracoes'
import { StatusRelacionamentoBadge } from './StatusRelacionamentoBadge'
import type { RelacionamentoStatus } from '../../hooks/useRelacionamento'

// ─── Config ───────────────────────────────────────────────────────────────────

const CANAL_OPTIONS: Array<{ value: Canal; label: string }> = [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'google', label: 'Google' },
    { value: 'outro', label: 'Outro' },
]

const GRAIN_BG =
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── FeedbackForm ─────────────────────────────────────────────────────────────

function FeedbackForm({ contatoId, onClose }: { contatoId: string; onClose: () => void }) {
    const [canal, setCanal] = useState<Canal>('whatsapp')
    const [texto, setTexto] = useState('')
    const { mutate, isPending, error: mutError } = useRegistrarFeedback()

    const canSubmit = texto.trim().length > 0 && !isPending

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return
        mutate(
            { contatoId, canal, texto: texto.trim() },
            { onSuccess: () => { setTexto(''); onClose() } },
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-2 px-4 py-3">
            <select
                value={canal}
                onChange={(e) => setCanal(e.target.value as Canal)}
                disabled={isPending}
                className="w-full rounded-lg border border-border bg-foreground/4 px-2.5 py-1.5 text-[12px] text-foreground outline-hidden focus:border-primary/40 disabled:opacity-50"
            >
                {CANAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-card">
                        {opt.label}
                    </option>
                ))}
            </select>
            <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={isPending}
                placeholder="Escreva o feedback…"
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-foreground/4 px-2.5 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-hidden focus:border-primary/40 disabled:opacity-50"
            />
            {mutError && (
                <p className="text-[11px] text-destructive">{mutError.message}</p>
            )}
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-1 rounded-lg bg-primary/15 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isPending ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                    Cancelar
                </button>
            </div>
        </form>
    )
}

// ─── FeedbackSideSheet ────────────────────────────────────────────────────────

export interface FeedbackSideSheetProps {
    isOpen: boolean
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
}

export function FeedbackSideSheet({ isOpen, onClose, contatoId, nomeContato, statusAtual }: FeedbackSideSheetProps) {
    if (!isOpen) return null

    const inicial = nomeContato.trim()[0]?.toUpperCase() ?? '?'

    return createPortal(
        <aside className="fixed right-0 top-0 z-9999 h-screen w-80 animate-slide-in-right overflow-hidden border-l border-border shadow-modal">
            <div className="relative flex h-full flex-col overflow-hidden bg-card">
                {/* Grain overlay */}
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
                            <StatusRelacionamentoBadge contatoId={contatoId} fallback={statusAtual} className="px-2 py-0 text-[10px]" />
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
                        Registrar feedback
                    </p>
                </div>

                {/* Form */}
                <div className="relative z-10 flex-1 overflow-y-auto">
                    <FeedbackForm contatoId={contatoId} onClose={onClose} />
                </div>
            </div>
        </aside>,
        document.body,
    )
}
