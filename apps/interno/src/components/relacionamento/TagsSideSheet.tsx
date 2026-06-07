import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Badge } from '../ui'
import { useTags, useContatoTags, useCriarTag, useAplicarTag, useRemoverTag, type Tag } from '../../hooks/useTags'
import type { RelacionamentoStatus } from '../../hooks/useRelacionamento'

// ─── Config ───────────────────────────────────────────────────────────────────

const RESULTADO_LABEL: Record<string, string> = {
    a_contatar: 'A Contatar',
    contatado: 'Contatado',
    em_negociacao: 'Em Negociação',
    resolvido: 'Resolvido',
}

const STATUS_BADGE: Record<RelacionamentoStatus, 'warning' | 'secondary' | 'default' | 'success'> = {
    a_contatar: 'warning',
    contatado: 'secondary',
    em_negociacao: 'default',
    resolvido: 'success',
}

const GRAIN_BG =
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textColorForBg(hex: string): string {
    const c = hex.replace('#', '')
    if (c.length < 6) return '#ffffff'
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#ffffff'
}

// ─── TagChip ──────────────────────────────────────────────────────────────────

function TagChip({
    tag,
    onRemove,
    disabled,
}: {
    tag: Tag
    onRemove: () => void
    disabled?: boolean
}) {
    const textColor = textColorForBg(tag.cor)
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: tag.cor, color: textColor }}
        >
            {tag.nome}
            <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remover tag ${tag.nome}`}
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
                style={{ color: textColor }}
            >
                <X className="h-2.5 w-2.5" />
            </button>
        </span>
    )
}

// ─── TagsPanel ────────────────────────────────────────────────────────────────

interface PanelProps {
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
}

function TagsPanel({ onClose, contatoId, nomeContato, statusAtual }: PanelProps) {
    const { data: allTags = [], isLoading: tagsLoading } = useTags()
    const { data: allContatoTags = [], isLoading: ctLoading } = useContatoTags()
    const criarTag = useCriarTag()
    const aplicarTag = useAplicarTag()
    const removerTag = useRemoverTag()

    const [novaTagNome, setNovaTagNome] = useState('')
    const [novaTagCor, setNovaTagCor] = useState('#6366f1')
    const [criarError, setCriarError] = useState<string | null>(null)

    const inicial = nomeContato.trim()[0]?.toUpperCase() ?? '?'
    const isLoading = tagsLoading || ctLoading
    const isBusy = criarTag.isPending || aplicarTag.isPending || removerTag.isPending

    const appliedTags = allContatoTags
        .filter((ct) => ct.contato_id === contatoId)
        .map((ct) => ct.tag)

    const appliedTagIds = new Set(appliedTags.map((t) => t.id))
    const availableTags = allTags.filter((t) => !appliedTagIds.has(t.id))

    const handleCriarEAplicar = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!novaTagNome.trim() || isBusy) return
        setCriarError(null)
        criarTag.mutate(
            { nome: novaTagNome.trim(), cor: novaTagCor },
            {
                onSuccess: (newTag) => {
                    aplicarTag.mutate(
                        { contatoId, tagId: newTag.id },
                        {
                            onSuccess: () => {
                                setNovaTagNome('')
                                setNovaTagCor('#6366f1')
                            },
                            onError: (err) => setCriarError(err.message),
                        },
                    )
                },
                onError: (err) => setCriarError(err.message),
            },
        )
    }

    return (
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
                        <Badge
                            variant={STATUS_BADGE[statusAtual]}
                            className="px-2 py-0 text-[10px]"
                        >
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
                    Tags de campanha
                </p>
            </div>

            {/* Body */}
            <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto px-4 py-4">
                {isLoading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="h-2.5 w-1/3 rounded-full bg-foreground/[0.07]" />
                        <div className="flex gap-2">
                            <div className="h-6 w-16 rounded-full bg-foreground/5" />
                            <div className="h-6 w-20 rounded-full bg-foreground/5" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Tags aplicadas */}
                        <div>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.09em] text-muted-foreground/40">
                                Tags aplicadas
                            </p>
                            {appliedTags.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground/50">Nenhuma tag aplicada</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {appliedTags.map((tag) => (
                                        <TagChip
                                            key={tag.id}
                                            tag={tag}
                                            disabled={removerTag.isPending}
                                            onRemove={() =>
                                                removerTag.mutate({ contatoId, tagId: tag.id })
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                            {removerTag.isError && (
                                <p className="mt-1.5 text-[11px] text-destructive">
                                    {removerTag.error.message}
                                </p>
                            )}
                        </div>

                        {/* Picker — tags ainda não aplicadas */}
                        {availableTags.length > 0 && (
                            <div>
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.09em] text-muted-foreground/40">
                                    Aplicar tag
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableTags.map((tag) => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            disabled={aplicarTag.isPending}
                                            onClick={() =>
                                                aplicarTag.mutate({ contatoId, tagId: tag.id })
                                            }
                                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                                            style={{ backgroundColor: tag.cor, color: textColorForBg(tag.cor) }}
                                        >
                                            {tag.nome}
                                        </button>
                                    ))}
                                </div>
                                {aplicarTag.isError && (
                                    <p className="mt-1.5 text-[11px] text-destructive">
                                        {aplicarTag.error.message}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Criar nova tag */}
                        <div>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.09em] text-muted-foreground/40">
                                Criar nova tag
                            </p>
                            <form onSubmit={handleCriarEAplicar} className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={novaTagNome}
                                        onChange={(e) => {
                                            setNovaTagNome(e.target.value)
                                            setCriarError(null)
                                        }}
                                        disabled={isBusy}
                                        placeholder="Nome da tag"
                                        className="min-w-0 flex-1 rounded-lg border border-border bg-foreground/4 px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-hidden focus:border-primary/40 disabled:opacity-50"
                                    />
                                    <input
                                        type="color"
                                        value={novaTagCor}
                                        onChange={(e) => setNovaTagCor(e.target.value)}
                                        disabled={isBusy}
                                        title="Escolher cor"
                                        className="h-[34px] w-9 cursor-pointer rounded-lg border border-border bg-foreground/4 p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                {criarError && (
                                    <p className="text-[11px] text-destructive">{criarError}</p>
                                )}
                                <button
                                    type="submit"
                                    disabled={!novaTagNome.trim() || isBusy}
                                    className="w-full rounded-lg bg-primary/15 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {criarTag.isPending || aplicarTag.isPending ? 'Salvando…' : 'Criar e aplicar'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── TagsSideSheet ────────────────────────────────────────────────────────────

export interface TagsSideSheetProps {
    isOpen: boolean
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
}

export function TagsSideSheet({ isOpen, onClose, ...rest }: TagsSideSheetProps) {
    if (!isOpen) return null

    return createPortal(
        <aside className="fixed right-0 top-0 z-9999 h-screen w-80 animate-slide-in-right overflow-hidden border-l border-border shadow-modal">
            <TagsPanel onClose={onClose} {...rest} />
        </aside>,
        document.body,
    )
}
